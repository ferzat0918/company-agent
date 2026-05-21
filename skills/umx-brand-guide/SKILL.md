---
name: umx-brand-guide
description: "UMX 品牌 VI 手册 — 当用户提到 UMX 品牌、VI 规范、品牌手册、品牌设计指南、LOGO规范、色彩体系、字体规范、版式、交互/UI、品牌定位、未来主义品牌，或者任何需要查询 UMX 品牌视觉识别系统信息的场景，都必须使用此 skill。即使只是简单提到 UMX 或问品牌相关的信息，也必须激活此 skill。"
---

# UMX 品牌 VI 手册

UMX 品牌完整视觉识别系统。文字规范在 `references/brand-guide.md`，视觉资产在 `assets/`。

## ⚠ 图片输出格式（极其重要，必须严格遵守）

当用户索要图片、LOGO、截图等视觉资产时，**必须使用标准 Markdown 图片语法**，路径以 `skills/` 开头（不加前导 `/`，不加 `file://`）：

```
![描述文字](skills/umx-brand-guide/assets/logo/logo-full.svg)
```

### LOGO 图片 — 直接复制使用

用户要 LOGO 时，直接复制以下 Markdown（不要修改路径，不要贴 SVG 源代码）：

完整组合 LOGO（X + UMX 文字）：
```
![UMX 完整 LOGO](skills/umx-brand-guide/assets/logo/logo-full.svg)
```

X 符号标志：
```
![UMX X 符号](skills/umx-brand-guide/assets/logo/logo-symbol-X.svg)
```

UMX 文字标识：
```
![UMX 文字标识](skills/umx-brand-guide/assets/logo/logo-wordmark.svg)
```

### ❌ 绝对禁止的格式

- ❌ `file:///skills/...` — 浏览器无法加载 file:// 协议
- ❌ `/skills/...` — 不要加前导斜杠
- ❌ `![](assets/logo/...)` — 缺少 skills/umx-brand-guide 前缀
- ❌ 只输出路径文本不包裹在 `![]()` 中
- ❌ 把 SVG 源代码贴在回复里（会导致浏览器卡死）

### ✅ 正确格式

- ✅ `![UMX LOGO](skills/umx-brand-guide/assets/logo/logo-full.svg)`
- ✅ 每张图片单独一行
- ✅ 先给文字说明，再给图片

## 何时读什么

| 用户问题类型 | 你该做的 |
|---|---|
| 文字规范类（色值/字体/层级/规则） | 读 `references/brand-guide.md` |
| "给我 LOGO" / 要矢量图 | **用上面的 Markdown 图片模板直接展示，不要贴 SVG 代码** |
| "VI 手册第 N 页长啥样" / 要参考图 | 用 `![Frame N](skills/umx-brand-guide/assets/frames/Frame_N_*.png)` |
| 整体盘点资产清单 | 读 `assets/manifest.json` |
| 要 SVG 代码 / 源码 | 读取文件内容后放在 ``` 代码块中，但警告用户大量 SVG 代码可能导致卡顿 |

## 文字规范 — `references/brand-guide.md`

10 个章节：
1. 品牌定位 / Branding
2. LOGO 使用规范
3. 色彩体系（主色 + 强调色，HEX/CMYK 全套）
4. 字体规范（Roboto / MiSans / Google Sans Code）
5. 版式 / Layout Style
6. 交互 / UI & Interaction
7. VI 手册页面结构
8. 图片资源清单
9. 所有色值汇总
10. 完整文字层原始数据

## 视觉资产 — `assets/`

**LOGO（矢量，生产可用）** — `assets/logo/`

| 文件 | 可渲染路径 | 内容 |
|---|---|---|
| `logo-full.svg` | `skills/umx-brand-guide/assets/logo/logo-full.svg` | X + UMX 完整组合 LOGO |
| `logo-symbol-X.svg` | `skills/umx-brand-guide/assets/logo/logo-symbol-X.svg` | 单 X 图形符号 |
| `logo-wordmark.svg` | `skills/umx-brand-guide/assets/logo/logo-wordmark.svg` | UMX 三字母词标 |

> 颜色：默认 `fill="black"`。需要白色版直接替换 `black` → `white`。

**VI 手册整页截图** — `assets/frames/`（@2x 分辨率）

| Frame | 可渲染路径 | 内容 |
|---|---|---|
| Frame 1 | `skills/umx-brand-guide/assets/frames/Frame_1_1-9.png` | LOGO 主视觉（封面） |
| Frame 4 | `skills/umx-brand-guide/assets/frames/Frame_4_2-11.png` | KEYWORDS / 品牌关键词 |
| Frame 6 | `skills/umx-brand-guide/assets/frames/Frame_6_41-3247.png` | 品牌描述 |
| Frame 7 | `skills/umx-brand-guide/assets/frames/Frame_7_42-5295.png` | FUTURISM / RETRO-FUTURISM |
| Frame 8 | `skills/umx-brand-guide/assets/frames/Frame_8_42-7049.png` | 目录：LOGO 规范索引 |
| Frame 9 | `skills/umx-brand-guide/assets/frames/Frame_9_47-31.png` | 关键词详情 |
| Frame 10 | `skills/umx-brand-guide/assets/frames/Frame_10_87-134.png` | 品牌英文描述 / LOGO 留白规则 |
| Frame 11 | `skills/umx-brand-guide/assets/frames/Frame_11_47-63.png` | 色彩阐释 |
| Frame 12 | `skills/umx-brand-guide/assets/frames/Frame_12_48-8500.png` | 强调色阐释 |
| Frame 13 | `skills/umx-brand-guide/assets/frames/Frame_13_48-6041.png` | UMX LOGO 规范页 |
| Frame 16 | `skills/umx-brand-guide/assets/frames/Frame_16_51-14850.png` | 英文字体 / 主色黑 |
| Frame 17 | `skills/umx-brand-guide/assets/frames/Frame_17_51-15785.png` | 中文字体 / 强调色 |
| Frame 18 | `skills/umx-brand-guide/assets/frames/Frame_18_51-16392.png` | 文字层级展示 |
| Frame 20 | `skills/umx-brand-guide/assets/frames/Frame_20_51-17929.png` | 版式示例 |
| Frame 22 | `skills/umx-brand-guide/assets/frames/Frame_22_51-20366.png` | 交互 UI 规范 |

**原始嵌入图片** — `assets/frames/_fill_NN_<hash>.png`

47 张图片填充原图（产品图、UI 截图、装饰元素等）。需要时按 hash 在 `manifest.json` → `imageFills` 里查询对应文件。

## 资产同步

资产由 `scripts/export-from-figma.mjs` 从 Figma 文件 `WBla6OEBVb9cAXOTiUI3Nx` 自动生成。Figma 源文件更新后，重跑脚本即可同步：

```bash
cd ~/.claude/skills/umx-brand-guide
node scripts/export-from-figma.mjs
```

需要 `.env` 中配置 `FIGMA_TOKEN` 和 `FIGMA_FILE_KEY`（已 gitignore）。

## 使用场景

- 用户问 "UMX 的品牌色是什么" → brand-guide.md §3
- 用户需要 UMX LOGO → **直接用 Markdown 图片语法展示 3 个 SVG，不要贴 SVG 代码**
- 用户想了解字体/版式/UI 规范 → brand-guide.md §4-6 + 对应 Frame PNG
- 用户提到 UMX 品牌手册或 VI → 全套都给
- 用户需要 UMX 品牌完整资料喂给 AI / 做设计参考 → brand-guide.md + LOGO SVG
- 任何涉及 UMX 品牌的话题 → 优先激活此 skill

---

## UMX 品牌定位与调性规范 (Banned Words, Grid, Camera & Specs)

### 1. 品牌定位与调性灵魂 (Brand Positioning & Soul)
- **核心定位**：未来主义 / 复古未来主义 (FUTURISM / RETRO-FUTURISM)，以赛博朋克与机械美学为骨架。
- **品牌灵魂**：极简守序，干净纯粹，绝不妥协。不喧哗，却足够先锋；不浓烈，却一眼记住。让每一件产品都成为空间里的先锋符号，先于时代，归于本质。
- **核心元素**：航空、滑雪、声、光、电交互系统。

### 2. 严苛文案禁用词与替换指南 (Strict Banned Words List)
为了维护 UMX 极致硬核、客观冷静的机械美学，文案中**绝对禁止**使用任何庸俗、泛化的互联网词汇。以下是强制红线及替换规范：
- 🚫 **禁用 "天花板"**
  - *原因*：空洞且缺乏说服力。
  - *替换方案*：陈述物理事实。使用具体的航天级材质（如 5052 铝合金）、CNC 精密铣削工艺（如“0.01mm 配合公差五金节点”）或承重力学参数。
- 🚫 **禁用 "氛围感拉满"**
  - *原因*：泛滥低级，背离高冷工业风。
  - *替换方案*：描述具体的“冷结构与情绪光场”（Cold Structure & Emotional Light Field）。例如：“由高饱和电光色（荧光绿 #DAFC08 与 荧光紫 #7201FF）构成的逆光层晕，通过 32px 物理毛玻璃面板漫射出柔和的偏振光影”。
- 🚫 **禁用 "黑科技"**
  - *原因*：虚无浮夸，缺乏诚意。
  - *替换方案*：直接写明声光电交互系统的真实原理和工程细节（如“集成式环境光敏传感器与动态交互声学阻尼模块”）。
- 🚫 **禁用 "轻奢"**
  - *原因*：调性庸俗，无法体现不妥协的硬核气质。
  - *替换方案*：用“不妥协的高端美学”或“极简守序的先锋符号”。
- 🚫 **禁用 "极佳" / "完美"**
  - *原因*：主观说教，缺乏客观事实支撑。
  - *替换方案*：陈述具体事实与材质，让用户自行推导和判断。

### 3. 版式与网格系统 (Layout Structures)
- **强分割感**：使用利落的直线网格和极简线框进行物理分区，具有强烈的机械装配感。
- **网格比例**：竖版构图使用 **5×9** 或 **9×5** 网格，横版构图使用 **9×5** 网格。
- **文字排版**：标题必须全大写（UPPERCASE），行距要极其紧凑（Tight Line Height）。正文干净利落。

### 4. 镜头视听与情绪导演 (Camera/Lens Directives)
在策划镜头或拍摄脚本时，必须遵循以下高对比先锋视听指令：
- **焦段与特写**：推荐使用 **100mm 微距镜头**，捕捉 5052 铝合金表面哑光喷砂的微观金属颗粒、CNC 配合节点的咬合接缝。
- **光影渲染**：采用**逆光构图（Backlighting）**，营造高对比度的锐利投影与边缘金属轮廓光。
- **声效细节 (SFX)**：强调精密的物理互动声（如：`[SFX: 磁吸模块清脆咬合声]`、`[SFX: 5052铝合金支架微弱金属摩擦声]`、`[SFX: 模块化节点旋转锁定的清脆咔哒声]`）。
- **背景音乐 (BGM)**：推荐使用复古未来主义合成器波（Retro-futuristic Synthwave）或暗黑氛围电子（Dark Ambient）。

### 5. 核心硬件与典型尺寸规范 (Hardware Specs & Dimensions)
- **材质工艺**：主打高强度 **5052 航空级铝合金**、极高精度的 **CNC 铣削** 五金节点、哑光喷砂金属表面工艺。
- **TV STAND (电视金属落地支架系统) 规格限制**：
  - **65in 规格**：尺寸限制为 `1630mm × 500mm × 1715mm`
  - **75in 规格**：尺寸限制为 `1680mm × 500mm × 1715mm`
