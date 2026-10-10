# AGENTS.md · 长河 (long-river) 协作规则

本文件是 **agent / 协作者必须遵守的约定**。改代码前先读这里。

---

## 一、年份展示规则（强制）

**任何时间数据展示到前端，必须带朝代纪年前缀：**

| 数据类型 | 展示格式 | 例子 |
|---|---|---|
| **公元前** | `公元前{年}` | `公元前2070`、`公元前221` |
| **公元** | `公元{年}` | `公元960`、`公元1127` |

- **公元年也要写「公元」**（不省略）。
- 范围用 ` — `（em dash）连接：`公元前2070 — 公元前1600`、`公元960 — 公元1127`。

### 代码约定
- 统一走 `web/components/river/year.ts`，禁止在组件里手写年份拼接。
- **展示用**：`fmtYear()`（单年）/ `fmtRange()`（范围）—— 永远带前缀。
- `fmtYearBP()` / `fmtRangeBP()` 为「只在公元前带前缀」的变体；**当前需求改为全带前缀，故展示层一律用 `fmtYear` / `fmtRange`**。
- 数据库内仍存**有符号整数**（负数 = 公元前），展示时再格式化。

> 注：`fmtYearShort()`（`前2070` / `960`）仅用于空间极紧张处（3D 节点标签），
> 页面正文/卡片标题等**必须**用完整 `fmtYear`。

---

## 二、UI 定制基线（强制）

以下是已确定的 UI 规范，**新页面一律遵守**，不要各页自创。

### 内容层级与背景
- 内容页整体是 **深色底 + 网格底纹**（固定深色，**不随主题变浅**）。
- 结构：`<main>` 深色 + 网格纹理 → **中间一个不透明深色卡片**（`max-w-*` 容器）。
  - `<main>`：`relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white`，
    网格用 CSS `background-image: linear-gradient(...)` 画在 main 上。
  - 内容卡片：`mx-auto max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8`
  - 卡片宽度：第二层/人物页 `max-w-4xl`；条目详情 `max-w-3xl`；疆域页 `max-w-5xl`。
- 网格只在**边距**可见（卡片不透明，挡住卡片内的网格）。

### 字号（最小 16px）
- **全站最小字号 `text-base`（16px）**，禁止 `text-xs`（12px）/ `text-sm`（14px）/ `text-[<16px]`。
- 层级参考：
  - 页标题 `text-6xl`，块标题 `text-2xl`，正文/卡片/标签 `text-base`。

### 间距
- 页容器块之间：`space-y-6`（24px）。
- 卡片网格：`gap-2`（8px）；卡片内边距 `px-4 py-3`。
- 块标题：`mb-4 ... border-b border-white/10 pb-2`。
- **单处间距上限 24px**，不要更大。

### 导航（层级可见）
- 每页顶部必须有 **面包屑 `Breadcrumb`**（`长河 › 朝代 › 条目`），用真实路由 `Link`。
- 路由结构（真 URL）：
  ```
  /                                  L1 时间长河
  /dynasty/[id]                      L2 朝代档案（分块）
  /dynasty/[id]/person/[pid]         L3 人物
  /dynasty/[id]/event/[slug]         L3 事件
  /dynasty/[id]/system/[slug]        L3 制度
  /dynasty/[id]/culture/[slug]       L3 文化
  /dynasty/[id]/territory            L3 疆域
  ```

### 分层下钻（强制）
- **三层下钻，每层只展示当前层信息**，不越层塞内容。
- 第二层各块（人物/制度/事件/文化/疆域）**行为一致**：都是**卡片格子**，
  点**整个格子** → 进**第三层独立页**。不要给某一类做特殊交互（如内嵌地图）。

---

## 三、其他既有约定
- 主题：`theme-deep`（深空，默认）/ `theme-ink`（水墨），CSS 变量见 `web/app/globals.css`。
  但**内容页固定深色**，不跟随主题。
- 3D：WebGL 无法读 CSS 变量，用 `web/lib/theme.ts` 的 `cssRgb()` 运行时读取。
- DLC：数据经后端 API 获取，前端不直连 DB。
- Git：commit 走 Conventional Commits；新克隆执行 `git config core.hooksPath web/.husky`。
