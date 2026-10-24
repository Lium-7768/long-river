/**
 * pgCompat — better-sqlite3 → PostgreSQL 薄兼容层（async）
 * ------------------------------------------------------------
 * 目的：让既有 `await db.prepare(sql).all(...binds)` 代码在 PostgreSQL 上工作。
 *
 * ⚠️ 为什么不是同步封装：
 *    早期版本用 Atomics.wait 阻塞线程模拟同步，但**阻塞事件循环会导致
 *    pg 的 socket 通信无法进行 → 死锁**。故改为 async，调用方需 await。
 *
 * 占位符：SQLite 用 `?`，PG 用 `$1..$n` —— 自动转换（跳过字符串/标识符内的 ?）。
 * 类型：bigint/numeric 由 pg 驱动以 string 返回 → 统一转回 number。
 */
import { Pool } from 'pg';

/**
 * PostgreSQL 保留字列名 —— 仅当**完整标识符**命中时才加双引号。
 * 覆盖项目 schema 里真实用到的：possessions.desc / persons.role / dynasty_meta.start
 */
const RESERVED = new Set(['desc', 'role', 'start', 'end', 'order', 'group', 'user', 'table']);

/** 把 SQLite 的 `?` 占位符转成 PG 的 `$1..$n`，并给保留字标识符加引号 */
export function convertPlaceholders(sql) {
  let out = '';
  let n = 0;
  let i = 0;
  const L = sql.length;
  while (i < L) {
    const ch = sql[i];
    if (ch === "'") {
      // 单引号字符串（处理 '' 转义）
      let j = i + 1;
      while (j < L) {
        if (sql[j] === "'") {
          if (j + 1 < L && sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      // 双引号标识符（已是引用态，原样保留）
      let j = i + 1;
      while (j < L) {
        if (sql[j] === '"') {
          if (j + 1 < L && sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '?') {
      n += 1;
      out += `$${n}`;
      i += 1;
      continue;
    }
    // 裸标识符：完整命中保留字才加引号（endYear 不受影响）
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < L && /[a-zA-Z0-9_$]/.test(sql[j])) j += 1;
      const word = sql.slice(i, j);
      const next = sql[j];
      if (RESERVED.has(word) && next !== '(') {
        out += `"${word}"`;
      } else {
        out += word;
      }
      i = j;
      continue;
    }
    out += ch;
    i += 1;
  }
  return { sql: out, count: n };
}

/**
 * PG numeric/bigint 以 string 返回 → 转回 number。
 *
 * ⚠️ 不能盲猜：SQLite 是动态类型，text 列里可能存 '0'/'123' 这类字符串，
 *    一律转 number 会改变 API 输出（"0" → 0），前端契约被破坏。
 *
 * 正确做法：用 pg 驱动的**字段类型 OID** 判断。
 *   20=int8, 21=int2, 23=int4, 700=float4, 701=float8, 1700=numeric → 转 number
 *   25=text, 1042=varchar, 1043=char 等 → 保持 string
 */
const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700]);

function normalizeRows(result) {
  const fields = result.fields || [];
  const numeric = fields.map((f) => NUMERIC_OIDS.has(f.dataTypeID));
  return result.rows.map((row) => {
    const o = {};
    for (let i = 0; i < fields.length; i++) {
      const k = fields[i].name;
      const v = row[k];
      if (v === null || v === undefined) {
        o[k] = v;
      } else if (numeric[i] && typeof v === 'string') {
        o[k] = Number(v);
      } else if (typeof v === 'bigint') {
        o[k] = Number(v);
      } else {
        o[k] = v;
      }
    }
    return o;
  });
}

export function createPgCompat(dsn) {
  // Neon 等 serverless PG 会自动挂起（5 分钟空闲），届时空闲连接被对端掐断。
  // 若不设置 idleTimeoutMillis，池里会留下死连接，下一次查询直接报
  // "Connection terminated unexpectedly"。因此：
  //   idleTimeoutMillis  —— 在对方挂起前主动回收空闲连接
  //   connectionTimeoutMillis —— 允许 scale-to-zero 冷启动（实测 3–20s）
  //   keepAlive          —— 探测半开连接
  // 同时必须有 pool.on('error')，否则空闲连接的错误会变成未捕获事件。
  const pool = new Pool({
    connectionString: dsn,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 45_000,
    keepAlive: true,
    application_name: 'long-river',
  });
  pool.on('error', (e) => {
    console.warn('[pg] 空闲连接被回收:', e.message);
  });

  const prepare = (sql) => {
    const { sql: pgSql, count } = convertPlaceholders(sql);
    return {
      all: async (...binds) => {
        const r = await pool.query(pgSql, binds.slice(0, count));
        return normalizeRows(r);
      },
      get: async (...binds) => {
        const r = await pool.query(pgSql, binds.slice(0, count));
        return r.rows.length ? normalizeRows(r)[0] : undefined;
      },
    };
  };

  return {
    prepare,
    exec: async () => {
      throw new Error('pgCompat: exec 不支持（只读层）');
    },
    close: () => pool.end(),
    _pool: pool,
  };
}
