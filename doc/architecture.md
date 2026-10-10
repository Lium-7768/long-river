# 长河 · 技术架构

> 决策日期：2026-10-10

## 总览

前后端分离。前端只渲染，数据全部经 API 获取；API 不暴露数据库直连；
未来第三方亦通过同一套 API 查询。

```
        ┌──────────────────┐        ┌──────────────────┐
        │  前端 (Web SPA)  │        │  第三方消费者     │
        └────────┬─────────┘        └────────┬─────────┘
                 │  HTTP / JSON              │
                 ▼                           ▼
        ┌────────────────────────────────────────────┐
        │   long-river-api  (Cloudflare Workers)     │
        │   /api/*   只读 REST                        │
        └────────────────────┬───────────────────────┘
                             │ SQL (D1 binding)
                             ▼
        ┌────────────────────────────────────────────┐
        │   Cloudflare D1 (SQLite)                    │
        │   lr-song … 按时期分库                       │
        └────────────────────────────────────────────┘
                             ▲
                             │ 由 ETL 脚本导入
        ┌────────────────────┴───────────────────────┐
        │   etl/  (CBDB → 结构化数据)                  │
        └────────────────────────────────────────────┘
```

## 为什么这样选

| 需求 | 方案 | 理由 |
|---|---|---|
| 零预算 | Cloudflare 免费层 | D1 免费 5GB 总存储 / 500MB 单库 / 10 库 |
| 前后分离 | Workers 提供 `/api/*` | 前端不碰 DB，只 fetch |
| 三方复用 | 标准 REST + CORS | 任何客户端都能调 |
| 数据规模 | 按时期分库 | 单库 500MB 上限，全史拆多库 |
| 部署 | Workers 全球边缘 | 免费、快、免运维 |

### 未选 Next.js 的原因
需求是「前后端分离 + API 复用」，本质是**数据服务**，不是 SSR 页面。
Workers + D1 更贴合：轻、免费、天然边缘。若将来需要 SEO/长文详情页，
再叠加静态前端（Pages）即可，后端 API 不变。

## 数据层

### D1 库规划
| 库名 | 内容 | 状态 |
|---|---|---|
| `lr-song` | 宋辽金夏（CBDB 宋段 86,669 人） | ✅ 已建，34 MB |

全史扩展时按时期加库（明、清各一库），注意单库 ≤500MB、总计 ≤5GB、≤10 库。

### 表结构（每库相同）
```sql
persons(  id PK, cbdb_id, name, surname, birth, death, dynasty, polity,
          zi, hao JSON, shi JSON, addr JSON, role, prominence, summary, source )
kinships( a, b, rel, source )          -- 亲属边，含反向
offices(  person_id, office, year )
entries(  person_id, entry, year )
works(    person_id, title, category )
```

- `prominence` 0–6：分层呈现用（谁上时间轴），**不删任何数据**
- `summary`：LLM 生成散文（CBDB 没有），2,197 人
- 硬事实（生卒/字号/亲属/官职）来源均为 CBDB cbdb_20261003

### 导入脚本
```bash
bash etl/fetch.sh                              # 下载 CBDB
bash etl/run_all.sh                            # CBDB → build/*.jsonl
export CF_TOKEN=...
python3 etl/load_d1.py       --account <ACC> --db <UUID> --only persons,kinships
python3 etl/load_d1_facts.py --account <ACC> --db <UUID>
```

**D1 导入的坑（已解决）**：
- 绑定参数上限 ~100 → 用**内联字面量**而非 `?` 占位
- `statement too long` 在 ~90KB 触发 → 按 SQL 长度上限 **40KB** 分批
- 每批约 1,000 行，86,669 人约 7.5 分钟

## API（线上）

Base: `https://long-river-api.yumei-c11.workers.dev`

| 端点 | 说明 |
|---|---|
| `GET /` | 服务信息 |
| `GET /api/persons?q=&polity=&min_prom=&limit=&offset=` | 人物列表 |
| `GET /api/persons/:id` | 人物详情（含亲属/官职/入仕/作品） |
| `GET /api/search?q=` | 搜索（姓名/字/简介） |
| `GET /api/polities` | 政权列表 + 人数 |
| `GET /api/stats` | 数据统计 |

返回统一为 `{ok, data, ...}`，均带 `access-control-allow-origin: *`。

### 示例
```bash
curl 'https://long-river-api.yumei-c11.workers.dev/api/persons/su-shi'
# → 苏轼：39 条亲属 / 35 条官职 / 2 条入仕
```

## 待办
- [ ] 亲属关系 `rel` 繁体化（`從祖;伯叔祖`）→ 简体 + 友好标签
- [ ] 作品表导入（works 已有结构，待补 title 映射）
- [ ] 全史扩展：按时期建库
- [ ] 前端接入 API（替换 prototype/data-cbdb.js）
- [ ] API Key + 限流（面向三方时）
