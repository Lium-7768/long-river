# 长河 · 视觉设计参考研究报告

> 研究日期：2026-10-10 ｜ 来源：Codrops 案例研究（8 篇，均实际抓取）+ Wikipedia + ChronoZoom
> 说明：本报告只引用**实际抓取到**的来源；未能验证的一律标注 ⚠️ uncertain。

---

## 0. 结论先行：推荐方向

**推荐：以「Unwoven (Codrops)」的丝线美学 + 「Batched Mesh」的实体块 + 「Volatile Nexus」的发光玻璃」三者融合的
"深空玻璃长卷" 方向。** 核心变化（相对现方案）：

1. **放弃"方块/球/面板"这类几何原语** —— 用**连续几何 + 程序化微扰**（ribbon / tube），这是"craft"与"programmer art"的分界线。
2. **呼吸式动效**（breathing/flow）而非静态排列 —— 所有抓取到的获奖案例都是**持续的、缓慢的、有机的**运动。
3. **统一色域 + 极少强调色** —— 主体用近黑的冷蓝灰，仅高光用 1 个发光色。
4. **后期处理是"premium"的关键**：bloom（仅高光）+ vignette + 轻微 DOF + 抗锯齿。裸 Three.js 不开后期必然显得廉价。

---

## 1. 实际抓取的案例研究（8 篇）

| # | 案例 | URL | 抓取状态 |
|---|------|-----|---------|
| 1 | Volatile Nexus (玻璃/焦散/音) | codrops/2026/08/31/volatile-nexus-... | ✅ |
| 2 | Drawing With Light (发光管 TSL) | codrops/2026/09/07/drawing-with-light-... | ✅ |
| 3 | WebGPU Scanning Effect (深度图扫描) | codrops/2025/03/31/webgpu-scanning-effect-... | ✅ |
| 4 | Infinite Loom / Unwoven (丝线) | codrops/2026/09/05/building-an-infinite-loom-... | ✅ |
| 5 | Isle Thorne (奢侈品电商模板) | codrops/2026/10/07/isle-thorne-collective-... | ✅ |
| 6 | Wide (网格 + WebGL 抖动) | codrops/2026/09/28/wide-template/ | ✅ |
| 7 | On-Scroll 3D Carousel | codrops/2025/05/07/on-scroll-3d-carousel/ | ✅ |
| 8 | BatchedMesh + WebGPU 后期 | codrops/2024/10/30/interactive-3d-with-three-js-batchedmesh-... | ✅ |
| — | Wikipedia《Timeline》 | en.wikipedia.org/wiki/Timeline | ✅ |
| — | Wikipedia《ChronoZoom》 | en.wikipedia.org/wiki/ChronoZoom | ✅ |
| — | awwwards WebGL / data-viz 分类页 | awwwards.com/websites/(webgl|data-visualization)/ | ⚠️ 仅确认分类存在，正文被截断，无法提取个案 |

---

## 2. 从案例中提取的设计语言

### 2.1 Volatile Nexus（玻璃 · 焦散）—— 来源 #1
- **隐喻**：不稳定的玻璃环，漂浮的方块穿过环心。
- **材质**：`MeshPhysicalMaterial` 级玻璃（transmission / iridescence / caustics）+ 地面镜面反射（floor reflection）。
- **发光策略**：**emissive-only bloom** —— "Emissive goes to its own MRT target, and bloom blurs only that. The pale weave stays crisp while accent strands glow."
  - ⭐ **关键可复用点**：bloom 只作用于 emissive 通道，主体保持锐利。这直接解决"全屏糊"问题。
- **折射技巧**：refracted layer 用 **facing term 加权**（正面强、掠射角衰减为镜面）——"kills the additive 'wash'"。
- **交互**：鼠标射线→局部斥力（squared falloff + damped spring），位移有上限防止飞出场。
- **色调**：作者自述结果"looked sort of like an 80s album metal cover" —— 高饱和玻璃 + 暗背景 + 强反射。

### 2.2 Drawing With Light（发光管）—— 来源 #2
- **隐喻**：用"光"画出的线，围成双手。
- **技术核心**：geometry **永不重建**，positions/normals 在 TSL(shader) 里算 —— "move the definition of your geometry into the shader"。
- **发光策略**（可直接照搬）：
  - "Bloom reads a **G-buffer**, not the frame. Emissive goes to its own MRT target."
  - "**About 12% of strands are accented**, chosen by hashing their seed, with bright packets running along them (a sharpened sine of progress and time)."
  - ⭐ **12% 强调比例** 是非常具体的数字，值得直接采用。
- **入场动画**："The reveal is a **radius**, not a fade." —— 用半径 0→1 生长，而非透明度渐变（更高级、无 blend 排序问题）。
- **相机**："eases frame-rate-independently" 用 `k = 1 - e^(-damping * dt)`。
- **相机参数**：管状 90 tubular × 3 radial segments；三角截面（"at this thickness lighting sells roundness long before geometry needs to"）。
- **后期**：emissive-only bloom + SMAA。注意 "renderer-level MSAA quietly does nothing once you render through a post pipeline"。

### 2.3 WebGPU Scanning Effect（深度图扫描）—— 来源 #3（React Three Fiber！）
- ⭐ **这是唯一一篇用 R3F 的案例**，与你的技术栈完全一致。
- **效果**：基于 base image + depth map，UV 位移产生视差 + 程序化点阵（cell noise）+ 扫描线。
- **点阵公式**（可复用的"科技感网格"）：
  ```
  tUv = vec2(uv.x * aspect, uv.y)
  tiledUv = mod(tUv * 120, 2) - 1
  brightness = cell_noise(tUv * 60)
  dot = smoothstep(0.5, 0.49, length(tiledUv)) * brightness
  ```
- **扫描流光**：`flow = 1 - smoothstep(0, 0.02, abs(depth - uProgress))`，uProgress 由 GSAP 0→1 循环 3s。
- **合成**：`blendScreen(baseImage, mask)`。
- **配色**：`mask = dot * flow * vec3(10, 0, 0)` —— **纯红发光**（very hot, >1 值 → bloom 溢出）。
- **代码**：github.com/d3adrabbit/ScanningEffectWithDepthMap

### 2.4 Unwoven / Infinite Loom（丝线）—— 来源 #4 ⭐ 最推荐参考
- **隐喻**：图片被拆成 26 条水平丝带，边缘处"散开、飘动、漂白"。
- **核心洞察**：**"分别构建每条丝带，各用独立顶点"** —— 不要用一个 plane 加细分（共享顶点会拉伸成橡皮膜）。
- **优雅公式**（撕裂度）：
  ```
  tear = max(1 - smoothstep(-halfW, -halfW+zone, x),
             smoothstep(halfW-zone, halfW, x))     // 中间0，边缘1
  world.x += direction * pow(tear, 1.4) * (60 + rnd*420)
  ```
- **漂白技巧**：先"whiten"再"fade"（`color = mix(color, vec3(1), ...)` 再降 alpha）—— 否则留下半透明彩条。
- **可调参数**：`60 + rnd*420`（错落度，最大杠杆）；`26` 条（8=碎纸，60=毛发）；`pow(tear,1.4)`。
- **风格**：极简、白底/浅底、优雅缓动、大量留白 —— 与"深空"相反的**"纸感/编辑"美学**，但动效语言极其高级。

### 2.5 Isle Thorne（奢侈品电商）—— 来源 #5
- **精确设计规格**（少见的可量化）：
  - 网格：**12 列，12px 间距**，"labels line up across pages"。
  - 字体：**Instrument Sans**（自托管，fallback 按 metrics 调整防抖动）。
  - 缓动滚动：**Lenis**（respects prefers-reduced-motion）。
  - 图集循环拖拽：**Embla Carousel**（momentum）。
- **配色**：主图是"深色影棚 + 鼠尾草绿皮椅" → **暗底 + 一个低饱和主色（sage green）**。
- **premium 要素**：严格网格对齐、克制的字体层级、真实的材质摄影、大量留白。

### 2.6 Wide（网格 + WebGL）—— 来源 #6
- **核心理念**："how much can you get from a **simple visual system** before adding another effect"。
- **结构**：10 cards / 5 compositions，**"created once, then only move"**（不重建 DOM）。
- **shader 用法**：只在按 B 键时出现；对**同一批图片**做多采样方向模糊（20 samples + fbm noise + dithering）。
- **性能纪律**："Keeping the expensive stuff expensive only when it matters" —— 昂贵通道只在需要时激活，canvas 限制在相关区域，降低像素密度。

### 2.7 On-Scroll 3D Carousel —— 来源 #7
- 滚动驱动的 3D 面板旋转 + GSAP ScrollSmoother/SplitText。
- 要点："Anything 3D on a website looks especially impressive **when scrolled**" —— **用滚动驱动 3D 是低成本高观感的手法**。

### 2.8 BatchedMesh + 后期 —— 来源 #8
- **渲染器配置（可直接抄）**：
  ```typescript
  renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  ```
  ⭐ **ACESFilmicToneMapping + exposure ~0.9** 是"电影感"的关键设置。
- **后期管线**（TSL）：`scenePass` → AO → **DOF (tilt-shift)** → vignette → FXAA。
  ```
  vignette = (1 - clamp(length(uv-0.5)*1.2, 0, 1)).pow(0.5)
  ```
- **BatchedMesh**：适合"同材质、大量不同变换/几何"的物体（如 22 朝代块 + 顶盖）—— 一次 draw call。
- **自动对焦**：focus/aperture 用 elastic damping 插值。

---

## 3. 时间轴设计原则（Wikipedia《Timeline》+ ChronoZoom）

### 3.1 历史权威观点
- **Joseph Priestley（1765）** 的 *A Chart of Biography* 是现代时间轴的起点 —— 用**平行条带 + 日期标签**。
- **关键洞察**："history is **not totally linear**" —— Priestley 自己承认**表格（table）优于线**，因为它能表达"交叉与分支"。
- **Minard（1869）** 的拿破仑东征图：**"put much less focus on the one-directional line"** —— 用**宽度编码数量**（流量图）。
- **尺度冲突是核心难题**：Barbeu-Dubourg 的《Chronologie Universelle》长 **54 英尺（16.5m）** 才装下历史；说明**线性尺度必然导致"要么看不清要么装不下"**。
- **对数尺度（logarithmic timeline）** 是为跨尺度设计的解决方案之一。
- **ChronoZoom（UC Berkeley + Microsoft Research，2013 SXSW 获奖）**：
  - 理念："approaches time like **Google Earth** deals with geography" —— **可无限缩放的语义缩放（semantic zoom）**。
  - ⭐ 对你的启示：与其把 22 个朝代平铺，不如做**可缩放时间轴**（远看=朝代，拉近=人物/事件）。

### 3.2 为什么时间轴"难看"
- 线性时间轴的根本矛盾：**平等对待每个时间单位 ≠ 平等对待每个事件重要性**。秦朝 14 年 vs 夏 470 年，按年数缩放 → 秦不可见。
- 漂亮时间轴的做法（综合来源）：
  1. **解耦"时间位置"与"视觉权重"**（Priestley/Minard 的宽度编码）。
  2. **非线性尺度**（log / piecewise）。
  3. **可缩放**（ChronoZoom 语义缩放）。
  4. **空间化隐喻**（河/卷/星），而非纯轴。

---

## 4. ⭐ 为长河定制的「设计语言规范」

### 4.1 美学方向：「深空玻璃长卷 / Deep-Space Glass Scroll」
隐喻：**一条悬浮于深空的发光长河**，朝代是河中**由丝线编织、内透光的玻璃碑**（半透明、可折射、有内部结构），而非实心方块。

### 4.2 配色（dark 主题）

| 用途 | HEX | 说明 |
|------|-----|------|
| 背景（近黑冷蓝）| `#05070D` | 已用，保留 |
| 背景渐层（上远）| `#0A0F1A` | vignette 到远处 |
| 主体材质基色 | `#141C2E` | 半透明玻璃碑的基色 |
| 主体高光（冷青）| `#00E5FF` | accent，**仅高光/bloom**（已用）|
| 次强调（紫）| `#7C4DFF` | 用于"有数据"的次级提示（已用）|
| 结构线（极淡）| `#1E2A44` | 河岸光带、网格 |
| 文字主色 | `#DBEAFE` | 冷白（非纯白）|
| 文字次色 | `#7B8AA8` | 年份/注释 |

**纪律**：画面中 **accent 青色的覆盖面积 < 15%**（参考 #2 的"12% accented"）。其余全部是暗冷灰蓝。

### 4.3 Three.js 材质参数（可直接用）

**朝代碑主体（MeshPhysicalMaterial，玻璃感）**：
```javascript
new THREE.MeshPhysicalMaterial({
  color: 0x141c2e,
  metalness: 0.0,
  roughness: 0.15,
  transmission: 0.85,        // 玻璃通透
  thickness: 1.5,            // 折射厚度
  ior: 1.45,                 // 玻璃折射率
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  iridescence: 0.6,          // 彩虹膜（参考 #1）
  iridescenceIOR: 1.3,
  emissive: 0x00e5ff,
  emissiveIntensity: 0.15,   // 低调自发光（配合 emissive-only bloom）
  envMapIntensity: 1.2,
  transparent: true,
  toneMapped: false,
})
```

**河面/地面（反射）**：用 drei `<MeshReflectorMaterial>`（blur + resolution 512）替代现有 plane —— 地面镜面是"premium"的强信号（参考 #1）。

**丝线/光带**：用 `TubeGeometry` 或 `<Line>` + 自定义 shader，配 `pow(tear,1.4)` 式微扰（参考 #4）。

### 4.4 后期处理策略（premium 的关键）
```
Bloom(emissive-only) → Vignette → 轻微 DOF(tilt-shift) → SMAA
```
- **Bloom**：`@react-three/postprocessing` 的 `<Bloom luminanceThreshold={0.9} intensity={0.8} />`。
  ⚠️ three.js 的 postprocessing bloom 默认作用于全屏；若要"仅高光 bloom"，需用 `selective bloom`（通过 emissive 层）。参考 #1/#2 的做法。
- **Vignette**：`vignette = (1 - clamp(length(uv-0.5)*1.2,0,1)).pow(0.5)`（参考 #8）。
- **Tone mapping**：`ACESFilmicToneMapping`，`exposure ≈ 0.9`（参考 #8）⭐ 极重要。
- **禁用 renderer 级 MSAA**（post pipeline 下无效），用 SMAA。

### 4.5 相机行为
- **缓动**：`k = 1 - exp(-damping * dt)`，`damping ≈ 3~5`（帧率无关）（参考 #2）。
- **滚动驱动**（参考 #7）：进入第一层后，**滚动 = 沿河推进**，相机沿河 move，朝代逐个"浮现"。
- **45° 俯瞰**（保留），但加轻微 idle drift（正弦 ±0.5°）。

### 4.6 朝代节点的工艺感（craft）
把朝代做成**发光玻璃碑**而非方块：
1. **主体**：高细比的长方体（如 0.6×3.5×1.2）+ `MeshPhysicalMaterial` 玻璃（上方参数）。
2. **内部**：碑内嵌一条竖直发光丝（emissive tube），从底部到顶部，亮度按朝代 prominence 变化。
3. **基座**：倒锥/圆台半没入河面，河面在基座处有**涟漪光晕**（`ringGeometry` additive）。
4. **文字**：drei `<Text>` 冷白 `#DBEAFE`，**去掉黑描边**，改用 `outlineWidth=0` + 轻微 glow（通过 emissive 或 DOM 叠加）。
5. **有数据 / 无数据**：有数据=玻璃通透+内部发光；无数据=半透明灰色、内部无光、hover 才微微亮起。
6. **悬停**：碑体轻微上浮 + emissiveIntensity 提升 + 基座涟漪扩散（参考 #1 的 impulse pool 思路，但简化）。

### 4.7 动效语言
- **呼吸**：所有碑体 `y += sin(t*1.1 + z)*0.08`（保留）。
- **入场**（参考 #2）：**用半径/尺度生长，而非 alpha 渐入** —— `scale.y` 从 0 缓动到 1，带弹性。
- **强调流动**（参考 #2）：约 12% 的朝代碑有"光脉冲"沿碑体上下流动（sharpened sine）。
- **河面**：流动的 UV 位移（noise），极缓慢。

---

## 5. 三种候选方向（若上述推荐不合意）

| 方向 | 隐喻 | 参考来源 | 适配度 |
|------|------|---------|--------|
| **A 深空玻璃长卷**（推荐）| 悬浮深空的发光玻璃碑之河 | #1+#2+#8 | ⭐⭐⭐⭐⭐ |
| **B 丝线解构长卷** | 历史如万千丝线编织，朝代=丝束 | #4 | ⭐⭐⭐⭐（更文艺、更"编辑感"，但不够"科技"）|
| **C 语义缩放星河** | ChronoZoom 式可缩放时间轴 | ChronoZoom | ⭐⭐⭐⭐（信息架构最强，但"好看"难保证）|

---

## 6. 未能验证的部分（诚实标注）

- ⚠️ **awwwards 个案**：分类页可访问，正文内容被截断，**未能提取任何 awwwards 获奖站点的具体配色/材质**。上述所有具体数值均来自 Codrops（实际抓取），非 awwwards。
- ⚠️ **具体站点的 hex**：除 Codrops 文中提及的（如 `vec3(10,0,0)`、ACES exposure 0.9）外，**我没有从真实获奖站点提取到 CSS 色值** —— 那些站点未被本次抓取覆盖。第 4.2 节的配色是我基于抓取到的设计原则**综合推导**的，不是某一站点的原值。
- ⚠️ ChronoZoom 的**当前可访问性未验证**（www.chronozoom.com 未抓取；只拿到 Wikipedia 描述）。
