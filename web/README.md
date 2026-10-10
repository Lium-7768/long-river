# 长河 · 前端 (web)

Next.js + React Three Fiber 前端。数据经后端 API（CF Workers）获取，不直连数据库。

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
- **朝代色**：`--lr-dynasty-*`，DOM 与 3D 共用，`content/dynasties.ts` 引用变量名而非 hex

## Git 钩子（重要）
本仓库 `web/.husky` 作为 hooks 目录。**新克隆后需执行一次**：
```bash
git config core.hooksPath web/.husky
```
之后 commit 会自动跑 lint-staged，commit message 需符合 Conventional Commits。

## 目录
```
app/            路由（第一层时间轴在 page.tsx）
components/     canvas/ 为 R3F 场景组件；ui/ 为 shadcn 组件
content/        静态数据（朝代轴）
lib/            api 客户端、主题桥接、工具
```
