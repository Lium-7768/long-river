# 长河 · 本地后端 (server)

Node + better-sqlite3，直接从本地 SQLite 提供 API。路由/返回结构与 CF Worker 完全一致。

## 为什么不用 D1
D1 免费层有**每日写入行数限额**（实测导入 373,000 行即触顶），无法承载全史（66 万人）
的定期导入。本地 SQLite 无此限制。

## 启动
```bash
cd server && pnpm install
pnpm dev          # http://localhost:8787
```

环境变量：
- `LR_DB`  SQLite 路径（默认 `../data/lr-song.sqlite3`）
- `PORT`  端口（默认 8787）

## 端点（与 Worker 相同）
`/api/persons` `/api/persons/:id` `/api/search` `/api/polities` `/api/stats`

## 前端如何切换数据源
`web/.env.local`：
```
NEXT_PUBLIC_API_BASE=http://localhost:8787      # 本地 SQLite
# NEXT_PUBLIC_API_BASE=https://...workers.dev    # 线上 D1
```
