# 长河 (long-river)

> 把中国历史用 3D 时间轴展示出来 —— 朝代 · 人物 · 事件。

中国通史知识图谱：三层下钻（朝代 → 朝代档案 → 条目详情），数据全部来自
可核验的公开史料（CBDB / Wikidata / 维基文库 / 正史全文）。

## 结构

```
long-river/
├── web/            前端（Next.js 15 + React Three Fiber）
├── server/         后端（Node + better-sqlite3，端口 8787，唯一后端）
├── etl/            数据流水线（脚本 + archive/）
├── data/           数据（见 data/README.md）
│   ├── db/         主库 + 备份 + cbdb/ 原料库
│   └── build/      ETL 中间产物
├── docs/           全部文档
│   ├── design/     架构 / 数据模型 / 需求 / CBDB / 视觉
│   ├── reports/    数据报告（可信度 / 史料互证 / 诗词核验 / 全量展示专项 …）
│   └── archive/    归档（调研稿 + 原型数据）
├── README.md       本文件
└── AGENTS.md       协作规则（改代码前必读）
```

## 快速开始

```bash
# 1. 后端（本地 SQLite，端口 8787）
node server/src/index.js          # 默认读 data/db/lr-song.sqlite3，可用 LR_DB 覆盖

# 2. 前端（Next dev，端口 3000）
cd web && pnpm install && pnpm dev
```

## 核心约定

- **本地 SQLite 是默认数据源**（`data/db/lr-song.sqlite3`，已弃用 Cloudflare D1）。
- **Turso（推荐）**：设 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` 即切到云端单库
  （SQLite 兼容、Free 5 GB，**不需要分片**）。全量 1.5 GB / 136 表已验证，22 端点响应与 SQLite 逐字节一致。
  远端单次往返约 335 ms，故服务端带 TTL 缓存 + 启动预热。配置见 `.env.example`。
- **也支持 PostgreSQL**：设 `DATABASE_URL`（单库）或 `DATABASE_URLS`（按朝代 4 分片，
  适配 Neon Free 每项目 1 GB）即切换；迁移见 `etl/migrate_pg/`；什么都不设则走 SQLite，可随时回滚。
- 数据全部落入**自有表**；`cbdb_` 原始表仅作原料，不直连前端。
- **数据必须全展示**：有数据就要能看到（分页/换 UI），不隐藏、不因复杂度丢弃。
- **3D 是增强而非唯一路径**：3D 组件须处理 WebGL 不可用（`web/lib/webgl.ts`），回退 2D 列表，不崩页。
- **二进制/备份不含 git**（见 `data/.gitignore`）。数据与文档分离：`data/` 放数据，`docs/` 放文档。
- 年份展示一律带纪年前缀（`公元前221` / `公元960`），走 `web/components/river/year.ts`。
- 每条数据可回溯至具体史料出处。

## 仓库维护

- 不提交数据库二进制、备份分卷与 ETL 中间产物（见 `data/.gitignore`、`etl/.gitignore`）。
- 2026-10-12 曾用 `git filter-repo` 重写历史，移除误入库的 ~264MB 数据库备份（.git 13GB → 8MB）。
  重写后**所有 commit SHA 变更**，需 `git fetch && git reset --hard origin/dev` 重新同步。
