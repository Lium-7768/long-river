# 长河 · 视觉方向（已定）

## 方向：情绪化 3D 叙事 · 滚动即时间
参考：Codrops《Emotional Experiences with Three.js》(andrewwoan)
演示 https://demo-emotional-experiences-part-one.vercel.app/
源码 https://github.com/andrewwoan/demo-emotional-experiences-part-one

### 它的核心技术（已读源码确认）
1. `CatmullRomCurve3` 手工调一条**相机路径曲线**
2. 滚轮 → `scrollProgress`(0→1) → 相机沿曲线飞
3. `rotationTargets[]`：每个进度点配注视方向 → 相机转头
4. `lerpFactor 0.1`：相机滞后于输入 → **丝滑惯性**
5. 分章节（First/Second/Third/Fourth 模型）= 每段一个情绪场景
6. 入场加载进度条 = 仪式感

### 我们怎么做（无美术资源）
- 河道 = CatmullRomCurve3（朝代节点沿曲线分布）
- 朝代 = 程序化几何 + 发光（不用 .glb）
- 滚动/拖动 = 时间推进
- 每到一个朝代：镜头停留 + 文字浮出 + 节奏变化

## 已否决的方向
- 3D 时间轴方块阵 / 粒子光河 / 玻璃碑 / 转轮 / 星汉 / 卷轴
- Apple 官网式极简网格（太朴素）
