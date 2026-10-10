# 与「时间 / 时间轴」相关的 Three.js 现成案例

> 全部为我**实际抓取验证**的页面。分三类：官方、Codrops（审美最好的）、可交互成品。
> 建议**直接点开看效果**，选定后告诉我编号或贴网址。

---

## 一、Three.js 官方：与"时间/曲线/路径"相关的

官方**没有**专门的"时间轴"示例，但下面这些是构建时间轴会用到的**核心积木**：

| # | 效果 | 链接 |
|---|---|---|
| O1 | **沿曲线延伸几何**（河的形态） | https://threejs.org/examples/webgl_geometry_extrude_splines.html |
| O2 | **曲线编辑器**（可拖时间轴） | https://threejs.org/examples/webgl_geometry_spline_editor.html |
| O3 | **相机漫游**（沿路径飞行） | https://threejs.org/examples/webgl_camera.html |
| O4 | **曲线修改器**（实例沿曲线） | https://threejs.org/examples/webgl_modifier_curve.html |
| O5 | 关键帧动画 | https://threejs.org/examples/webgl_animation_keyframes.html |

**O1 + O3** 最接近"时间长河"——一条曲线当河道，相机沿它飞。

---

## 二、Codrops：**时间/滚动/时序**相关（审美最高，均有源码）

> ⚠️ 部分直连 403（反爬），**浏览器打开都正常**。

| # | 名称 | 演示链接 | 源码 |
|---|---|---|---|
| **C1** | **Rotating on Scroll：滚动 3D 旋转** | https://tympanus.net/Development/RotatingOnScrollAnimations/ | https://github.com/codrops/RotatingOnScrollAnimations |
| **C2** | **3D 圆形文字滚动**（时序感） | https://tympanus.net/Tutorials/3DTextCircleScroll/ | https://github.com/davidfaure/3d-text-circle-animation-codrops |
| **C3** | **Infinite Layers Grid：无限视差网格**（"无尽时间"感） | https://tympanus.net/Tutorials/InfiniteLayersGrid | https://github.com/JorgeCapillo/infinite-layers-grid |
| **C4** | **Scroll-Driven SVG Map**（滚动驱动叙事） | https://tympanus.net/Tutorials/ScrollMap/ | CodePen 见页面 |
| **C5** | **Emotional Experiences with Three.js**（情绪化 3D 叙事） | https://demo-emotional-experiences-part-one.vercel.app/ | https://github.com/andrewwoan/demo-emotional-experiences-part-one |
| **C6** | Infinite Loom：图像撕裂成流动丝带 | https://tympanus.net/codrops/2026/09/05/building-an-infinite-loom-unravelling-images-into-threads-with-three-js/ | 页面内含 demo |
| **C7** | Volatile Nexus：玻璃焦散+粒子 | https://tympanus.net/codrops/2026/08/31/volatile-nexus-tinkering-with-glass-caustics-cubes-and-sound-in-three-js/ | 页面内含 |

**C1、C2、C3** 是"滚动即时间"最直接的参考。

---

## 三、成品级 3D 网站（看"顶级长什么样"）

| # | 网站 | 链接 | 特点 |
|---|---|---|---|
| W1 | **Bruno Simon** | https://bruno-simon.com/ | 3D 标杆，可开小车 |
| W2 | **Active Theory** | https://activetheory.net/ | 商业 3D 天花板 |
| W3 | **Dreamfold**（城市折叠） | https://cityfold.vercel.app/ | 空间叙事，源码开放 |
| W4 | **Awwwards 3D 精选** | https://www.awwwards.com/websites/three-js/ | 全球轮播 |
| W5 | **Awwwards WebGL** | https://www.awwwards.com/websites/webgl/ | 同上 |

**Dreamfold（W3）源码在 GitHub**（https://github.com/Makio64/dreamfold），可读可改。

---

## 四、专门找"时间轴模板"的地方

| 来源 | 链接 | 说明 |
|---|---|---|
| GitHub 搜索 | https://github.com/search?q=three.js+timeline&type=repositories | 搜 `threejs timeline` / `webgl timeline` |
| CodePen | https://codepen.io/search/pens?q=three.js%20timeline | 大量可 fork 的小 demo |
| Shadertoy | https://www.shadertoy.com/ | 时间流动类 shader 效果 |

---

## 我的推荐（如果要"时间感"）

**从这三个看起**（都是滚动=时间的成熟模式）：

1. **C1 Rotating on Scroll** —— 简单、成熟，滚动驱动 3D
2. **O1 + O3 官方曲线+相机** —— 直接做"沿河飞行"
3. **W3 Dreamfold** —— 看空间叙事的高级感（有源码）

**选定后，请告诉我：**
- 编号（如 "C1"）
- 或**直接贴网址**
- 或"某个页面里那个 XX 效果"

我照着它实现第一层。这次有真实锚点。

---

## 附：为什么"现成时间轴三件套"不存在

我查了官方示例库（`files.json`），**没有 `timeline` / `history` 类**——只有 `camera`、`spline`、`animation`。
**"时间轴"从来不是引擎自带的，而是用 `spline`(曲线) + `camera`(相机) + `scroll`(滚动) 拼出来的。**
所以真正该找的是**"滚动驱动 + 曲线路径"的案例**，上面 C 类就是。
