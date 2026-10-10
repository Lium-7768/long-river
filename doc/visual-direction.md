# 长河 · 视觉方向（第一层已定稿）

## 第一层「时间长河」—— 已定稿 ✅

### 核心机制：滚动 = 时间，相机沿河飞行
参考 Codrops《Emotional Experiences with Three.js》(andrewwoan)
- 演示 https://demo-emotional-experiences-part-one.vercel.app/
- 源码 https://github.com/andrewwooan/demo-emotional-experiences-part-one

### 技术实现（web/components/river/）
| 文件 | 职责 |
|---|---|
| `curve.ts` | CatmullRomCurve3 河道曲线（8 控制点，S 型蜿蜒）+ 朝代 t 分布 |
| `cameraModes.ts` | 两种视角：fly 沿河飞行 / side 侧览全景 |
| `starTexture.ts` | Canvas 生成圆形径向渐变星点贴图（解决 Points 默认方形） |
| `year.ts` | 统一年份格式 fmtYear/fmtRange → 「公元前2070」 |
| `Scene.tsx` | 星空 + 朝代光点 + 相机飞行 rig |
| `RiverExperience.tsx` | 滚动驱动 + DOM 覆盖层 |

### 视觉元素
- **星空**：远景星 4500（幂律星等 + 暗小/亮大双层 + 真实星色板）
       近景星 1100（60% 蓝白 + 40% 主题色）；全部圆形柔光点
- **无银河**（试过后移除，纯星空）
- **朝代节点 = 光点 + 光晕（极简）**：
  核心光球（脉冲） + 柔光 Sprite + 双扩散光晕环（涟漪） + 尘埃微粒
  有数据=大亮青；无数据=小暗灰蓝
- **覆盖层（DOM，中文绝对清晰）**：
  左上「长河」；右上 [视角按钮] + 朝代名/年份/说明（右对齐）；右下进度条
- **相机**：沿曲线飞行 62 单位，缓动惯性 k=1-e^(-6dt) + 鼠标视差
- **后处理**：ACESFilmic(exposure1.0) + Bloom + Vignette

### 已否决方向（勿重做）
- 3D 方块阵 / 粒子光河 / 玻璃碑 / 转轮 / 星汉 / 卷轴 / Apple 极简网格
- 银河（背景固定光带）—— 用户明确不要

## 待做
- 第二层：点击朝代 → 该朝代代表人物/事件（分类星群 + 搜索框）
- 第三层：点击人物 → 3D 点线关系图
- 人物 bio 弹窗
