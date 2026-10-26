/**
 * tursoCompat — better-sqlite3 → Turso/libSQL 兼容层（async，只读）
 * ------------------------------------------------------------
 * 与 pg-compat 的区别（也是迁移 Turso 的核心收益）：
 *   · Turso 是 SQLite 方言 → `?` 占位符**原生支持**，不需要 convertPlaceholders
 *   · 不需要「保留字加引号」（desc/role/start 在 SQLite 里本就不是保留字）
 *   · 不需要 numeric OID 判断 → 不需要 normalizeRows 的类型回填
 *   · 没有连接池、没有 serverless 自动挂起 → 不需要 idleTimeout/keepAlive 加固
 *
 * 两种运行模式：
 *   1) 远端     url = libsql://xxx.turso.io          每条查询走 HTTPS
 *   2) 嵌入式副本 url = file:./data/replica.db
 *                syncUrl = libsql://xxx.turso.io     读本地（快），启动时 sync 一次
 *
 * 嵌入式副本是本项目的最优解：数据集 1.6GB、只读、几乎不变，
 * 用远端模式每次 /api/persons 都要跨网，延迟不可接受；副本模式下是本机 mmap。
 */
import { createClient } from '@libsql/client';

/** libSQL 可能把超安全范围整数返回成 bigint → 统一回 number（与 SQLite 路径一致） */
function normalizeRow(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.url        libsql://... 或 file:...
 * @param {string} [opts.authToken]
 * @param {string} [opts.syncUrl]  仅在嵌入式副本模式使用
 * @param {number} [opts.syncInterval] 秒；0 = 只在启动时同步
 */
export function createTursoCompat({ url, authToken, syncUrl, syncInterval = 0 }) {
  const client = createClient({ url, authToken, syncUrl, syncInterval });

  const prepare = (sql) => ({
    all: async (...binds) => {
      const rs = await client.execute({ sql, args: binds });
      return rs.rows.map(normalizeRow);
    },
    get: async (...binds) => {
      const rs = await client.execute({ sql, args: binds });
      return rs.rows.length ? normalizeRow(rs.rows[0]) : undefined;
    },
  });

  return {
    prepare,
    /**
     * 批量执行：把 N 条查询合并成**一次往返**。
     * 动机：Turso 网关每次往返固定 ~335ms（与 SQL 复杂度无关），
     * 人物详情页有 25 条串行查询 → 32s；合并后降到 ~1s 级。
     * 返回与入参同序的 rows 数组。
     */
    batchAll: async (queries) => {
      if (!queries.length) return [];
      const results = await client.batch(
        queries.map((q) => ({ sql: q.sql, args: q.args || [] })),
        'read',
      );
      return results.map((rs) => rs.rows.map(normalizeRow));
    },
    /** 嵌入式副本：手动触发一次远端同步（启动时调用一次即可） */
    sync: async () => {
      if (typeof client.sync === 'function') return client.sync();
      return undefined;
    },
    exec: async (sql) => client.execute(sql),
    close: () => client.close(),
    _client: client,
  };
}

/** 打码 DSN，用于启动日志（不泄露 token） */
export function maskTursoUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.replace(/authToken=[^&]*/gi, 'authToken=***');
  }
}
