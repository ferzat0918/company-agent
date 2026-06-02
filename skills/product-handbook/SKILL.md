---
name: product-handbook
description: "UMX 全线产品官方手册 — 当用户提到任何 UMX 旗下产品、产品线总览、产品技术规格、尺寸参数、机械结构、材质工艺、光影及灯光控制、使用场景、产品细节设计，或者需要查询 UMX 实体产品信息的场景，都必须激活此 skill。即使只是简单询问某款产品的材料或大小，也必须优先基于此手册进行解答。"
department: product
---

# UMX 产品官方描述手册

本 Skill 包含了 UMX 旗下全线 14 款先锋硬件产品的核心规格、材质工艺、力学结构、尺寸及声光电交互系统的完整知识库。

* 文字规范与完整参数详见参考文件：`references/product-handbook.md`
* 视觉描述图集资产保存在：`assets/`

---

## ⚠ 图片输出格式规范（极其重要，必须严格遵守）

当用户需要查看产品图片、结构图示或询问其外观造型时，图片路径须以 `skills/` 开头（禁止加前导斜杠 `/`，禁止使用 `file://` 协议，每张图片单独占一行）：

```markdown
![产品描述文字](skills/product-handbook/assets/图片名称.jpg)
```

### 14款产品对应图片展示模板（直接复制使用）

| 产品名称 | Markdown 图片展示语法 |
| :--- | :--- |
| **光梭音响灯** | `![UMX 光梭音响灯](skills/product-handbook/assets/光梭灯.jpg)` |
| **方凳 (MONO STOOL)** | `![UMX 方凳](skills/product-handbook/assets/凳子.jpg)` |
| **银辉圣诞树** | `![UMX 银辉圣诞树](skills/product-handbook/assets/圣诞树.jpg)` |
| **拾光显示器支架** | `![UMX 拾光显示器支架](skills/product-handbook/assets/显示器支架.jpg)` |
| **桥架置物架** | `![UMX 桥架置物架](skills/product-handbook/assets/桥架.jpg)` |
| **SENSE 智能感应椅**| `![UMX SENSE智能感应椅](skills/product-handbook/assets/椅子.jpg)` |
| **模块桌** | `![UMX 模块桌](skills/product-handbook/assets/模块桌.jpg)` |
| **竖灯 (LUMEN TUBE)** | `![UMX 竖灯](skills/product-handbook/assets/氛围灯.jpg)` |
| **天命烟灰缸** | `![UMX 天命烟灰缸](skills/product-handbook/assets/烟灰缸.jpg)` |
| **拾光电视机架** | `![UMX 拾光电视机架](skills/product-handbook/assets/电视机架.jpg)` |
| **移动式白板** | `![UMX 移动式白板](skills/product-handbook/assets/白板.jpg)` |
| **机械臂纸巾盒** | `![UMX 机械臂纸巾盒](skills/product-handbook/assets/纸巾盒.jpg)` |
| **魔镜 (MIRAGE)** | `![UMX 魔镜](skills/product-handbook/assets/落地镜.jpg)` |
| **折境边几** | `![UMX 折境边几](skills/product-handbook/assets/边几.jpg)` |

### ❌ 绝对禁止的格式
* ❌ `file:///skills/product-handbook/assets/...` （前端无法渲染 file 协议）
* ❌ `/skills/product-handbook/assets/...` （多余的前导斜杠会导致相对路径解析失败）
* ❌ `![](assets/...)` （缺失 `skills/product-handbook/` 前缀）
* ❌ 在同一行内紧密排布多张图片，或者输出不被 `![]()` 包裹的纯路径文本。

---

## 何时读取何内容

| 用户查询场景 | Agent 响应行动指南 |
| :--- | :--- |
| **查询特定产品技术规格/大小尺寸** | 查阅 `references/product-handbook.md` 对应产品章节，提供绝对精确的 HxWxD 参数与材质表格。 |
| **询问某款产品的材料选择与表面工艺** | 查阅 `references/product-handbook.md` 对应产品工艺部分，如航空级 5052 铝合金、CNC 精铣、120目喷砂、阳极氧化等。 |
| **索要某款产品的图片或问其长相** | 查阅上表直接复制对应的 **Markdown 图片语法** 输出展示（必须单独成行）。 |
| **编写产品宣传文案、销售说辞或培训文档** | 严格遵循 `references/product-handbook.md` 中的描述词，体现**冷硬结构与情绪光场**，确保文案不包含任何庸俗禁用词（如“天花板”、“黑科技”、“氛围感拉满”、“轻奢”、“完美”等）。 |
| **获取全线产品目录及总览** | 查阅 `references/product-handbook.md` 的目录及概览，为用户列举全套 14 款先锋硬件。 |

---

## 品牌文案红线指南 (Banned Words Guidelines)

为确保 UMX 极简、硬核、克制的复古未来主义美学调性在所有输出中高度统一，在使用本手册进行内容生成与问答时，必须无条件遵守以下文案禁令：

1. **禁用“天花板”** 🚫：空洞说教，须替换为具体的材质事实（如“航空级 5052 铝合金”）、加工精度（如“配合公差五金节点”）或承重载荷力学参数。
2. **禁用“氛围感拉满”** 🚫：俗气低效，须替换为**“冷结构与情绪光场”**（Cold Structure & Emotional Light Field）或具体的光学描述（如“电光色彩通过磨砂亚克力漫射呈现的柔和偏振光晕”）。
3. **禁用“黑科技”** 🚫：虚浮不实，须直接客观拆解其声光电交互系统的真实原理和工程细节（如“集成红外及重力复合感应系统，实现人机灯光互动”）。
4. **禁用“轻奢”** 🚫：背离先锋，须替换为“不妥协的高端美学”或“极简守序的先锋符号”。
5. **禁用“极佳” / “完美” / “闭眼入”** 🚫：带有推销暗示，须以极其冷静、客观的事实与技术规格进行物理层面的论证，把审美和质量的裁决权交还给用户。

---

## 参考来源
* 原始输入资产：`产品描述/`（14张官方出厂手稿图片）
* 转换优化图库：`skills/product-handbook/assets/`（optimized-JPEG）
* 核心参考规格文档：`skills/product-handbook/references/product-handbook.md`
