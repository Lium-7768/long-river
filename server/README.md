# 长河 · 本地后端 (server)

Node + better-sqlite3，直接从本地 SQLite 提供 API。**唯一后端**。

## 为什么不用 D1
D1 免费层有**每日写入行数限额**（实测导入 373,000 行即触顶），无法承载全史（66 万人）
的定期导入。本地 SQLite 无此限制。**已弃用 Cloudflare D1/Worker 方案。**

## 启动
```bash
cd server && pnpm install
node src/index.js        # http://localhost:8787
```

环境变量（优先级从高到低）：
- `TURSO_DATABASE_URL` Turso 库地址（`libsql://...`），设置则用 Turso
- `TURSO_AUTH_TOKEN`   配套 token（`turso db tokens create <db>`）
- `TURSO_REPLICA`      可选，本地副本路径；设了走嵌入式副本（本地读）
- `DATABASE_URLS`      4 分片 JSON（Neon Free 用）
- `DATABASE_URL`       单库 PostgreSQL
- `LR_DB`              SQLite 路径（默认 `../data/db/lr-song.sqlite3`）
- `LR_CACHE_TTL_MS`    响应缓存 TTL（仅 Turso 模式生效，默认 3600000 = 1h）
- `PORT`               端口（默认 8787）

> 全不设 → 本地 SQLite，可随时回滚。
> Turso 迁移实测：1.5 GB 全量导入约 1h9m（`turso db import`），22 端点与 SQLite 逐字节一致。
> Turso 网关单次往返固定 ~335 ms，故 GET 响应带 TTL 缓存 + 启动预热（4 个热点端点）。
> SQLite → PG（单库 / 4 分片）迁移见 [`../etl/migrate_pg/README.md`](../etl/migrate_pg/README.md)。

## 端点

> 数据全部来自本地 SQLite 自建表；`cbdb_` 原始表**不直接暴露**给前端。

| 端点 | 说明 |
|---|---|
| `GET /api/stats` | 全库统计 |
| `GET /api/dynasties` | 朝代列表（L1）|
| `GET /api/dynasty-profile?dynasty=` | 朝代档案（L2 分块）|
| `GET /api/persons?dynasty=&sort=&limit=&offset=` | 人物列表（`sort`: fame/birth/birth_desc/name）|
| `GET /api/persons/:id` | 人物详情（含 `assocCount` / `nPoems` / `evid` 等）|
| `GET /api/person-assocs?person=&offset=&limit=&rel=` | 人物社会关系（分页 + 类型筛选 + 分布）|
| `GET /api/search?q=` | 全站检索 |
| `GET /api/poems?q=&author=&dynasty=&genre=&limit=&offset=` | 诗词（分页）|
| `GET /api/poems/:id` | 单首诗词（含同作者相邻作品）|
| `GET /api/poem-authors?limit=` | 诗词作者榜 |
| `GET /api/dynasty-poems?dynasty=` | 朝代诗词概览 |
| `GET /api/emperors` | 帝王世系 |
| `GET /api/nianhao` / `GET /api/nianhao-lookup?name=` | 年号表 / 年号查询 |
| `GET /api/territory-coverage` | 疆域覆盖 |
| `GET /api/evidence-sources` | 史料来源总览 |
| `GET /api/bibliography` / `GET /api/book-editions?titles=` | 书目 / 版本 |
| `GET /api/person-geo` / `GET /api/region-stats` | 人物地理 / 地区统计 |
| `GET /api/person-lookup?name=` | 人名消歧查询 |
| `GET /api/ref-dict` | 参考字典 |
| `GET /api/polities` | 政权列表 |

> 返回统一 `{ ok: true, data, total?, limit?, offset? }`；出错 `{ ok: false, error }`。
> 分页 `limit` 均有上限（人物 500、诗词 200、社会关系 500）。

## 前端如何连接
`web/.env.local`：
```
NEXT_PUBLIC_API_BASE=http://localhost:8787      # 本地 SQLite（唯一选项）
```
