# 长河 (long-river)

> 把中国历史用 3D 时间轴展示出来 —— 朝代 · 人物 · 事件。

中国通史知识图谱：三层下钻（朝代 → 朝代档案 → 条目详情），数据全部来自
可核验的公开史料（CBDB / Wikidata / 维基文库 / 正史全文）。

## 结构

| 目录 | 说明 |
|---|---|
| `web/` | 前端（Next.js 15 App Router + React Three Fiber）|
| `server/` | 后端（Node + better-sqlite3，端口 8787，**唯一后端**）|
| `etl/` | 数据流水线（CBDB/Wikidata/维基 → SQLite）；见 [`etl/README.md`](etl/README.md) |
| `data/` | 主库与数据报告；见 [`data/README.md`](data/README.md) |
| `doc/` | 设计文档（架构/数据模型/需求）；见 [`doc/architecture.md`](doc/architecture.md) |

## 快速开始

```bash
# 1. 后端（本地 SQLite，端口 8787）
node server/src/index.js

# 2. 前端（Next dev，端口 3000）
cd web && pnpm install && pnpm dev
```

前端默认连 `http://localhost:8787`，可用 `NEXT_PUBLIC_API_BASE` 覆盖。

## 核心约定

- **本地 SQLite 是唯一数据源**（已弃用 Cloudflare D1）。
- 数据全部落入**自有表**；`cbdb_` 原始表仅作原料，不直连前端。
- 年份展示一律带纪年前缀（`公元前221` / `公元960`），走 `web/components/river/year.ts`。
- 每条数据可回溯至具体史料出处。

详见 [`AGENTS.md`](AGENTS.md)（协作规则）与 [`data/数据来源与可信度总报告.md`](data/数据来源与可信度总报告.md)（数据溯源）。
