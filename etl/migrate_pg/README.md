# SQLite → PostgreSQL 迁移

把 `data/db/lr-song.sqlite3` 的 **58 张自有表**迁到 PostgreSQL，取代 SQLite 成为后端数据源。

> **为什么不迁 `cbdb_*` 78 张原料表**：前端不直连（项目铁律），它们只是 ETL 的输入，
> 继续留在本地 SQLite 即可。PG 侧只放前端真正读取的数据。

---

## 快速开始

```bash
# 0. 前置
pip install psycopg2-binary
cd server && pnpm add pg && cd ..

# 1. 在 PG 里建库（一次性）
psql "postgresql://user:pass@host:5432/postgres" -c "CREATE DATABASE longriver;"

# 2. 一键迁移（幂等，可重复执行）
export DATABASE_URL="postgresql://user:pass@host:5432/longriver"
bash etl/migrate_pg/migrate.sh

# 3. 用 PG 启动后端
DATABASE_URL="postgresql://user:pass@host:5432/longriver" node server/src/index.js
```

**回滚**：不设 `DATABASE_URL` 启动，立即回到 SQLite。双轨并存，随时可切。

---

## 文件

| 文件 | 作用 |
|---|---|
| `convert_schema.py` | SQLite DDL → PG DDL（58 表 + 46 索引） |
| `import_data.py` | 数据导入（`COPY` 协议，流式，不占内存） |
| `verify.py` | 迁移校验（行数 + 内容抽样 + 空串/NULL 语义） |
| `migrate.sh` | 串起以上三步 |
| `asyncify.py` | `index.js` 的同步→async 机械转换（历史工具，已执行过） |

---

## 实测结果（2026-10-14，本地 PG 16）

| 指标 | 值 |
|---|---|
| 表 / 索引 | 57 表 + 64 索引 |
| 总行数 | **7,505,001** |
| 导入耗时 | ~40–80 s |
| PG 库体积 | ~1.25 GB（数据 870 MB + 索引 264 MB） |
| 行数校验 | 57 表全部一致 |
| 内容抽样 | 11 项全部一致 |
| **双后端 API 对比** | **38/38 端点字节级一致** |
| 前端 link-check | 420 通过 · 0 失败 |

**结论：2 GB 在线服务完全够用**（余 ~750 MB）。

---

## 踩过的坑（重要，改动这些文件前先读）

### 1. `Atomics.wait` 同步封装会死锁
早期想让 `db.prepare(sql).all()` 保持**同步**调用形态，用 `Atomics.wait` 阻塞线程等 Promise。
**结果：阻塞事件循环 → pg 的 socket 通信无法进行 → 死锁**。
最终改为 async：`handle` 改 async，69 处调用全部 `(await db.prepare(...).all(...))`。

### 2. `await` 位置错了也会炸
`await db.prepare(sql).all(x).map(f)` 的解析是 `await (…all(x).map(f))` ——
`.map()` 先作用在 Promise 上 → `all(...).map is not a function`。
**必须写成 `(await db.prepare(sql).all(x)).map(f)`**。

### 3. 空串 ≠ NULL（最隐蔽）
`COPY ... WITH (FORMAT csv, NULL '')` 会把**真空字符串**也当成 NULL。
项目里 `poems.author` 有 77 行空串，被错误转成 NULL，
导致 `COUNT(DISTINCT author)` 少 1（19506 → 19505）。
**改用 `NULL '\N'` 哨兵**区分「真空字符串」与「NULL」。

### 4. 保留字列名
`desc` / `role` / `start` / `end` 是 PG 保留字，必须加双引号。
由 `pg-compat.js` 的 `convertPlaceholders()` **自动**处理（整词匹配，
`endYear` 不会被误拆成 `"end"Year`）。

### 5. 驼峰别名会被折叠
`end_year AS endYear` 在 PG 里变成 `endyear`，前端读 `endYear` 直接 undefined。
**SQL 里必须写 `AS "endYear"`**。

### 6. 排序必须有平局裁决
SQLite 与 PG 对**并列行**的返回顺序不同，会导致分页错乱、前后端不一致。
所有 `ORDER BY` 都补了稳定第二键（`id ASC` / 唯一列）。
涉及：poems、persons、offices、entries、emperors、nianhao、search、
ref_dict、person_geo、office_addrs、assocs、region_stats、bibliography 等。

### 7. NULL 排序方向相反
SQLite `ASC` 默认 **NULLS FIRST**，PG 默认 **NULLS LAST**。
武则天官职表因此顺序错乱 → 所有可空排序列显式写 `NULLS FIRST/LAST`。

### 8. GROUP BY 严格度不同
SQLite 允许 `GROUP BY addr` 时 select 裸列 `lon, lat`；**PG 直接报错**。
已改为 `GROUP BY addr, lon, lat`（同一 addr 的坐标唯一，语义不变）。

---

## 后端架构

`server/src/index.js` 启动时按环境变量选数据源：

```
DATABASE_URL 未设置  →  better-sqlite3（原路径，零改动）
DATABASE_URL 已设置  →  pg-compat.js 薄兼容层
```

`server/src/pg-compat.js` 职责：
- `?` → `$1..$n` 占位符转换（跳过字符串/标识符内的 `?`）
- 保留字自动加引号
- 按 PG 字段类型 OID 决定是否把 string 转 number
  （**不能盲猜**：SQLite text 列里可能存 `'0'`，一律转会破坏 API 契约）

---

## 后续

- [ ] 在线 PG 上正式迁移（用 `migrate.sh`）
- [ ] 定期备份策略（`pg_dump`）
- [ ] `/api/stats` 两个后端都 ~0.7s，可加物化视图或缓存优化
