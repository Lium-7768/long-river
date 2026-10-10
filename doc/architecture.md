# 长河 · 技术架构

> 最后更新：2026-10-10
> 本文是项目的权威架构文档，记录**已决策**与**已实现**。范围：数据层 → 后端 → 前端工程化 → 呈现层。

---

## 0. 一页总览

```
┌────────────────────────────────────────────────────────────────┐
│  Next.js (前端)  web/                                            │
│    · App Router + React + TypeScript                            │
│    · Tailwind CSS（主题变量） + shadcn/ui                         │
│    · React Three Fiber（三层 3D 呈现）                            │
│    · 只负责渲染；数据全部经 API 获取                               │
└───────────────────────────┬────────────────────────────────────┘
                            │  fetch  HTTPS / JSON
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (后端)  api/                                 │
│    · 只读 REST  /api/*                                           │
│    · 线 上：https://long-river-api.yumei-c11.workers.dev          │
│    · 前端与第三方共用同一套接口                                    │
└───────────────────────────┬────────────────────────────────────┘
                            │  SQL (D1 binding)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  Cloudflare D1 (数据库)                                          │
│    · lr-song（宋辽金夏）已上线，86,669 人 / 34 MB                 │
│    · 按时期分库（全史扩展时加库）                                  │
└───────────────────────────▲────────────────────────────────────┘
                            │  ETL 导入
┌───────────────────────────┴────────────────────────────────────┐
│  etl/  CBDB → 结构化数据 → D1                                     │
│    · 来源：CBDB cbdb_20261003（CC 授权）                          │
└────────────────────────────────────────────────────────────────┘
```

**核心原则**：前端不碰数据库；所有数据经 API；同一套 API 服务网页与第三方。

---

## 1. 决策记录（含讨论过程）

### 1.1 为什么前后端分离

用户诉求（原话）：
> "不能用 nextjs 前后分离的架构方式吗？前端只需要管数据，server 从数据库拿数据。
> 前端不能直接去操作数据库数据，以后后端还可以用于其他三方的数据查询。"

**决策**：前端（Next.js）↔ 后端 API（Workers）↔ 数据库（D1）三层分离。
**好处**：前端只管渲染；数据操作集中在一处；第三方可直接复用 API。

### 1.2 为什么用 Next.js

用户确认："我们当前的技术架构不就是 next 前后端分离 + CF D1 吗？"

- Next.js 擅长"内容站 + 数据 API"的重前端场景
- App Router 支持 SSG/SSR/CSR 混用，读多的内容页可预渲染
- 与 React Three Fiber 生态天然契合（三层 3D）

### 1.3 为什么数据库选 Cloudflare D1

| 候选 | 免费额度 | 结论 |
|---|---|---|
| Supabase | 500 MB | 偏小 |
| Neon | 0.5 GB | 偏小 |
| **Cloudflare D1** | **总 5 GB / 单库 500 MB / 10 库** | ✅ 选中 |
| Fly.io | 3 GB 卷 | 备选 |
| Oracle Free | 200 GB | 需运维，暂不用 |

**实测确认（2026-10-10）**：当前账户 `lr-song` 库实际大小 **34 MB**，远低于单库 500 MB 上限。

### 1.4 为什么后端用 Workers（而非自建服务器）

- 零成本、全球边缘、免运维
- 与 D1 同平台，绑定即用
- 只读 API 场景下，Workers 完全够用

### 1.5 为什么 3D 用 React Three Fiber

用户："前端我希望用 threejs 完全重构"。
既然前端是 React，Three.js 的正确用法是 **React Three Fiber (R3F)**：

| 层 | 技术 |
|---|---|
| 场景 | React Three Fiber |
| 工具 | @react-three/drei（相机/文字/加载器） |
| 特效 | @react-three/postprocessing（辉光/扫描线） |
| 动画 | @react-spring/three |

**不采用**：裸 Three.js 单文件 / DOM+CSS3D 旧方案（已由 R3F 取代）。

---

## 2. 三层呈现设计（核心交互）

**严格聚焦**：每一层只显示该层内容，不叠加。

### 第一层 · 时间长河
- 3D 透视时间轴，横贯屏幕，**从公元前 2070（夏）到 1912（清）**
- 每个朝代 = 一个发光时间块，长度 ∝ 实际年数
- 悬停高亮 + 朝代名浮出；点击 → 镜头推进进入第二层
- 数据：`web/content/dynasties.ts`（22 个朝代，本地静态）

### 第二层 · 分类星群
- 进入朝代后，该朝代的代表人物 / 事件 / 著作等**按类别分组**
- 3D 空间中类别为"星系"，条目为"星"
- 顶部有**搜索框**（人物太多，默认只显示代表人物，其余靠搜）
- 数据：`/api/persons?polity=X`、`/api/persons?min_prom=N`

### 第三层 · 3D 关系点线
- 选中人物/事物居中，亲属 / 官职 / 作品连成发光 3D 网络
- 力导向布局，可旋转
- 数据：`/api/persons/:id`

### 弹层 · 介绍
- 点击节点 → 抽屉/模态显示介绍（summary 等）

---

## 3. 视觉主题系统

**要求**：主题尽量在 Tailwind 里定义好；**支持两套主题**；**Three.js 也吃主题色**。

### 3.1 做法
主题色全部定义为 **CSS 变量**（Tailwind `@theme`），运行时切换 `<html class="theme-*">`：

```css
/* web/app/globals.css */
:root, .theme-deep {          /* 主题一：深空青 */
  --lr-bg: 5 7 13;
  --lr-fg: 226 232 240;
  --lr-accent: 0 229 255;      /* 青 */
  --lr-accent-2: 124 77 255;   /* 紫 */
  --lr-dynasty-song: 62 123 94;
}
.theme-ink {                   /* 主题二：水墨 */
  --lr-bg: 244 241 234;
  --lr-fg: 30 30 30;
  --lr-accent: 176 86 60;
  --lr-accent-2: 106 122 74;
  --lr-dynasty-song: 62 123 94;
}
```

Tailwind 把它们暴露为工具类（`bg-lr-bg`、`text-lr-accent` 等）。

### 3.2 Three.js 如何吃主题色
WebGL 里不能用 CSS 变量，必须**运行时把 CSS 变量读成数值**：

```ts
// web/lib/theme.ts
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function cssRgb(name: string): [number, number, number] {
  // --lr-accent: 0 229 255  →  [0, 0.898, 1]
  return cssVar(name).split(/\s+/).map(Number).map(v => v / 255) as [number, number, number];
}
```

Three.js 材质颜色从 `cssRgb('--lr-accent')` 取，主题切换时重新读取 → **两套主题 3D 同步变色**。
`dynasties.ts` 里每个朝代的 color 也走 CSS 变量（`--lr-dynasty-*`），保证 3D 与 DOM 一致。

---

## 4. 前端工程化规范

| 关注点 | 选型 |
|---|---|
| 包管理 | **pnpm** |
| 框架 | Next.js（App Router）+ TypeScript |
| 样式 | **Tailwind CSS v4** |
| 组件库 | **shadcn/ui** |
| 代码规范 | ESLint + Prettier |
| Git 钩子 | **husky + lint-staged** |
| 提交规范 | commitlint（Conventional Commits） |
| 3D | React Three Fiber + drei + postprocessing |

目录规划：

```
web/
  app/
    layout.tsx              主题 Provider、字体
    page.tsx                第一层：时间长河
    dynasty/[id]/page.tsx   第二层：朝代内分类
    entity/[id]/page.tsx    第三层：关系图
    globals.css             Tailwind + 主题 CSS 变量
  components/
    canvas/                 R3F 场景组件
      Timeline.tsx
      Cluster.tsx
      Graph.tsx
    ui/                     shadcn 组件
    theme-provider.tsx
  content/
    dynasties.ts            朝代轴数据（22 个）
  lib/
    api.ts                  API 客户端（封装 CF Worker）
    theme.ts                CSS 变量 → Three.js 颜色
    utils.ts                cn() 等
  .husky/                   git 钩子
  eslint.config.mjs
  .prettierrc
  package.json
```

---

## 5. 数据层（已实现）

### 5.1 D1 库规划
| 库名 | 内容 | 状态 |
|---|---|---|
| `lr-song` | 宋辽金夏（86,669 人） | ✅ 已上线，34 MB |
| （明/清/唐…） | 全史扩展时按时期加库 | 待建 |

约束：单库 ≤500 MB、账户总 ≤5 GB、≤10 库。

### 5.2 表结构（每库相同）
```sql
persons(  id PK, cbdb_id, name, surname, birth, death, dynasty, polity,
          zi, hao JSON, shi JSON, addr JSON, role, prominence, summary, source )
kinships( a, b, rel, source )          -- 亲属边，含反向
offices(  person_id, office, year )
entries(  person_id, entry, year )
works(    person_id, title, category )
```
- `prominence` 0–6：分层呈现（谁上时间轴），**不删数据**
- `summary`：LLM 生成散文（CBDB 无），2,197 人
- 硬事实来源：CBDB cbdb_20261003

### 5.3 导入脚本
```bash
bash etl/fetch.sh                              # 下载 CBDB
bash etl/run_all.sh                            # CBDB → build/*.jsonl
export CF_TOKEN=...
python3 etl/load_d1.py       --account <ACC> --db <UUID> --only persons,kinships
python3 etl/load_d1_facts.py --account <ACC> --db <UUID>
```

**D1 导入三个坑（已解决）**：
- 绑定参数上限 ~100 → 用**内联字面量**而非 `?` 占位
- `statement too long` 在 ~90 KB 触发 → 按 SQL 长度 **40 KB** 分批
- 每批约 1,000 行，86,669 人约 7.5 分钟

---

## 6. 后端 API（已上线）

Base: `https://long-river-api.yumei-c11.workers.dev`

| 端点 | 说明 |
|---|---|
| `GET /` | 服务信息 |
| `GET /api/persons?q=&polity=&min_prom=&limit=&offset=` | 人物列表 |
| `GET /api/persons/:id` | 人物详情（含亲属/官职/入仕/作品） |
| `GET /api/search?q=` | 搜索（姓名/字/简介） |
| `GET /api/polities` | 政权列表 + 人数 |
| `GET /api/stats` | 数据统计 |

返回统一 `{ok, data, ...}`，均带 `access-control-allow-origin: *`。

```bash
curl 'https://long-river-api.yumei-c11.workers.dev/api/persons/su-shi'
# → 苏轼：39 条亲属 / 35 条官职 / 2 条入仕
```

---

## 7. 待办

- [ ] 前端工程 `web/`：pnpm + Next.js + Tailwind(双主题) + shadcn + husky
- [ ] 第一层：R3F 时间长河（22 朝代，公元前~1912）
- [ ] 第二层：分类星群 + 搜索
- [ ] 第三层：3D 关系点线
- [ ] Three.js 主题色桥接验证（双主题切换 3D 同步）
- [ ] 亲属 `rel` 繁体 → 简体 + 友好标签
- [ ] 全史扩展：按时期建库
- [ ] API Key + 限流（面向第三方时）

---

## 附：安全的临时提醒
- CF API Token 曾以明文出现，**应尽快在 CF 后台轮换/删除**
- `wrangler.toml` 仅含库 ID（非密钥），可入库
- 后端目前无鉴权，公开可用；对第三方开放前需加 API Key
