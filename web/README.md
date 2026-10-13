# 长河 · 前端 (web)

Next.js + React Three Fiber 前端。数据经后端 API（本地 SQLite，见 `../server/`）获取，不直连数据库。

## 技术栈
- **Next.js 15**（App Router）+ TypeScript
- **pnpm** 包管理
- **Tailwind CSS**（双主题 CSS 变量）
- **React Three Fiber** + drei + postprocessing（3D）
- **ESLint + Prettier**（代码规范）
- **husky + lint-staged + commitlint**（Git 钩子）

## 开发
```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 生产构建
pnpm lint         # ESLint
pnpm format       # Prettier 格式化
pnpm typecheck    # tsc --noEmit
```

## 主题系统
两套主题定义在 `app/globals.css`（CSS 变量），切换 `<html class="theme-*">`：

| 主题 | class | 风格 |
|---|---|---|
| 深空 | `theme-deep` | 深色 + 青/紫（科技感，默认） |
| 水墨 | `theme-ink` | 浅色 + 朱/黛（素雅） |

- **Tailwind 工具类**：`bg-lr-bg`、`text-lr-accent`、`border-lr-line`…（见 `tailwind.config.ts`）
- **Three.js**：WebGL 不能用 CSS 变量，用 `lib/theme.ts` 的 `cssRgb()` 运行时读取；
  `lib/use-theme-color.ts` 提供 hook，主题切换自动重读 → 3D 同步变色
- **朝代色**：`--lr-dynasty-*`，DOM 与 3D 共用；变量名由后端 `dynasty_meta.color_var` 提供

## Git 钩子（重要）
本仓库 `web/.husky` 作为 hooks 目录。**新克隆后需执行一次**：
```bash
git config core.hooksPath web/.husky
```
之后 commit 会自动跑 lint-staged，commit message 需符合 Conventional Commits。

## 目录
```
app/                路由（L1 时间长河在 page.tsx；/dynasty/* 为 L2/L3）
components/
  river/            R3F 3D 时间长河（首页）
  profile/          朝代档案 / 人物详情 / 疆域 / 面包屑
  persons/          人物卡片 / 全量列表 / 诗词列表 / 社会关系块
lib/
  api.ts            API 客户端（唯一数据入口）
  dynasty-data.ts   客户端 hook（朝代/人物）
  dynasty-server.ts 服务端 fetch（构建期 + SSR）
  webgl.ts          WebGL 能力探测（3D 降级）
  slug.ts / territory-coverage.ts / theme.ts
```

> **前端零硬编码**：所有内容数据经 `lib/api.ts` 从后端取，不在前端写死（见 `AGENTS.md`）。
> **3D 降级**：3D 组件必须处理 WebGL 不可用（`lib/webgl.ts`），回退 2D 列表，不崩页。
