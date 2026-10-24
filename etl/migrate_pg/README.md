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

---

# 按朝代 4 分片（Neon Free 用这个）

单库 1.25 GB 超过 Neon Free 每项目 1 GB 上限。按朝代拆 4 片后每片都装得下。

```bash
export DATABASE_URLS='{"qing":"postgresql://...","ming":"...","tangsong":"...","rest":"..."}'
bash etl/migrate_pg/migrate_shards.sh
DATABASE_URLS="$DATABASE_URLS" node server/src/index.js   # 用分片启动
```

## 分片结果（本地实测）

| 分片 | 朝代 | 体积 | 余量 |
|---|---|---|---|
| qing | 清 | 700 MB | 324 MB |
| ming | 明 | 696 MB | 328 MB |
| tangsong | 唐 + 宋（北宋/南宋/泛宋） | 671 MB | 353 MB |
| **rest** | 其余 18 朝 + 无朝代 | 624 MB | 400 MB |

## 分类规则（`shards.py`）

| 类型 | 表 | 说明 |
|---|---|---|
| **复制**（每片一份） | persons、poems、aliases、person_geo、全部小表 | 任一分片数据完整 |
| **分片**（按人物朝代） | evid、kinships、offices、office_addrs、entries、assocs、works、poem_persons | 只按 person_id 查询 |
| **分片**（按 dynasty_id 列） | person_canonical | — |
| **单分片** | texts（93 MB 古籍全文） | API 从不查询，只放 rest 留档 |

## 为什么这样分

1. **persons 复制到所有分片** —— 这是关键设计。代码里 8 处 `JOIN persons p ON p.id = X`
   （社会关系、亲属、师徒都要显示对方姓名）因此全部变成本地查询，
   跨分片人名解析问题直接消失，不需要 person_index 表。
2. **poems 也复制** —— 135 MB。这样 `poem_persons ⋈ poems` 同样是本地 JOIN，
   诗词端点（`/api/poems`、`/api/poems/[id]`、`/api/dynasty-poems`）零 fan-out。
3. **只有 11 张表真正分片** —— 全是按 `person_id` 查的大表。
4. **aliases / person_geo 也复制** —— 它们的端点（别名查找、籍贯地图聚合）需要全局视角，
   fan-out 合并容易出错，各 11/15 MB 复制更稳。

## 路由（`server/src/pg-shard.js`）

只有 2 个端点需要路由 + 1 个端点跨片求和：

| 端点 | 做法 |
|---|---|
| `/api/person-assocs?person=X` | 先查 `persons.dynasty_id`（复制表，本地）→ 路由到分片 |
| `/api/persons/[id]` | 同上：人物行本地取，evid/kinships/offices/... 路由 |
| `/api/stats` | kinships/offices/entries/works 四个计数跨 4 片求和 |
| 其余 19 个端点 | 复制表，本地查询，**无需改动** |

## 验证（本地实测）

| 项 | 结果 |
|---|---|
| 分片表 4 片行数之和 | 9/9 张表 == 源库 |
| 复制表各片行数 | 全部一致 |
| 内容抽样 | 11/11 一致 |
| 路由抽查（4 分片各一人） | 4/4 正确 |
| **API 端点对比 SQLite** | **57/57 字节级一致** |
| 前端 link-check | 420 通过 · 0 失败 |
| 性能 | 分片后比 SQLite **快 3–7 倍** |

## 分片环境变量格式

`DATABASE_URLS` 支持两种写法：

```bash
# 推荐：JSON（键名固定）
DATABASE_URLS='{"qing":"...","ming":"...","tangsong":"...","rest":"..."}'

# 或：逗号分隔 4 个 URL（顺序 qing,ming,tangsong,rest）
DATABASE_URLS='postgresql://.../lr_qing,postgresql://.../lr_ming,postgresql://.../lr_tangsong,postgresql://.../lr_rest'
```

优先级：`DATABASE_URLS`（4 分片）> `DATABASE_URL`（单库 PG）> SQLite。
三种模式随时切换，改环境变量即可回滚。

## Neon 实测结果（2026-10-24）

在 org `org-aged-dream-78530307`、区域 **aws-ap-southeast-1** 建了 4 个 Free 项目：

| 分片 | 项目名 | 项目 ID | 导入耗时 | 体积 |
|---|---|---|---|---|
| qing | lr-qing | `royal-field-92097946` | 361s | 700 MB |
| ming | lr-ming | `shiny-river-52349718` | 270s | 697 MB |
| tangsong | lr-tangsong | `lively-bar-04871780` | 276s | 671 MB |
| rest | lr-rest | `red-sunset-42947950` | 292s | 625 MB |

全量导入 **1213s（约 20 分钟）**，服务端 PostgreSQL **18.6**（本地验证用的是 16.14，
DDL 103 条语句在 18.6 上全部成功）。

### 验证结果

- 分片校验 `verify_shards.py`：**全部通过**（分片和、复制表、内容抽样、路由抽查、体积）
- API 57 端点对比 SQLite：**57/57 字节级一致**
- 前端 link-check：**420 通过 · 0 失败**

### Neon 特有的两个坑

1. **自动挂起**：Free 项目空闲 5 分钟挂起，空闲连接被对端掐断。
   连接池必须设 `idleTimeoutMillis`（本项目取 20s，小于 5 分钟）+ `keepAlive` +
   `pool.on('error')`，否则下一次查询报 `Connection terminated unexpectedly`。
   见 `server/src/pg-compat.js`。
2. **冷启动**：挂起后首个请求要 5–20s（实测单分片详情 9–16s）。
   因为 `/api/persons/[id]` 只唤醒 1 个分片，而 `/api/stats` 要唤醒全部 4 个。
   如果觉得慢，可以定时 ping 保活（会消耗 CU-hours），或用 Neon 的付费档关掉挂起。

### 连接串注意

Neon 给的连接串带 `?sslmode=require`，`pg` 会打印一条 SECURITY WARNING，
说明当前版本把 `require` 当作 `verify-full`、未来 v9 会改语义。功能上无影响。
