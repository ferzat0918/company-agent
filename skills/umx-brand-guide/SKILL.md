---
name: umx-brand-guide
description: "UMX 品牌 VI 手册 — 当用户提到 UMX 品牌、VI 规范、品牌手册、品牌设计指南、LOGO规范、色彩体系、字体规范、版式、交互/UI、品牌定位、未来主义品牌，或者任何需要查询 UMX 品牌视觉识别系统信息的场景，都必须使用此 skill。即使只是简单提到 UMX 或问品牌相关的信息，也必须激活此 skill。"
---

# UMX 品牌 VI 手册

UMX 品牌完整视觉识别系统。文字规范在 `references/brand-guide.md`，视觉资产在 `assets/`。

## 何时读什么

| 用户问题类型 | 你该做的 |
|---|---|
| 文字规范类（色值/字体/层级/规则） | 读 `references/brand-guide.md` |
| "给我 LOGO" / 要矢量图 | 引用 `assets/logo/*.svg` |
| "VI 手册第 N 页长啥样" / 要参考图 | 引用 `assets/frames/Frame_N_*.png` |
| 整体盘点资产清单 | 读 `assets/manifest.json` |

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

| 文件 | 内容 | 尺寸 |
|---|---|---|
| `logo-full.svg` | X + UMX 完整组合 LOGO | 80×80（X）+ 词标 |
| `logo-symbol-X.svg` | 单 X 图形符号 | 80×80 |
| `logo-wordmark.svg` | UMX 三字母词标 | 174×54 |

> 颜色：默认 `fill="black"`。需要白色版直接替换 `black` → `white`。

**VI 手册整页截图** — `assets/frames/Frame_N_*.png`（@2x 分辨率）

按页号查找内容（来自 brand-guide.md §7）：

| Frame | 内容 |
|---|---|
| Frame 1 | LOGO 主视觉（封面） |
| Frame 4 | KEYWORDS / 品牌关键词 |
| Frame 6 | 品牌描述 |
| Frame 7 | FUTURISM / RETRO-FUTURISM |
| Frame 8 | 目录：LOGO 规范索引 |
| Frame 9 | 关键词详情 |
| Frame 10 | 品牌英文描述 / LOGO 留白规则 |
| Frame 11 | 色彩阐释 |
| Frame 12 | 强调色阐释 |
| Frame 13 | UMX LOGO 规范页 |
| Frame 16 | 英文字体 / 主色黑 |
| Frame 17 | 中文字体 / 强调色 |
| Frame 18 | 文字层级展示 |
| Frame 20 | 版式示例 |
| Frame 22 | 交互 UI 规范 |

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
- 用户需要 UMX LOGO 文件 → assets/logo/*.svg
- 用户想了解字体/版式/UI 规范 → brand-guide.md §4-6 + 对应 Frame PNG
- 用户提到 UMX 品牌手册或 VI → 全套都给
- 用户需要 UMX 品牌完整资料喂给 AI / 做设计参考 → brand-guide.md + LOGO SVG
- 任何涉及 UMX 品牌的话题 → 优先激活此 skill
