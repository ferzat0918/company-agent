---
name: ui-design-system
description: "UI/UX 设计体系知识库 — 当用户询问配色方案、排版原则、动效设计、交互规范、设计趋势、毛玻璃效果、暗色模式、渐变设计、网格系统、间距规范等现代 UI 设计技法时加载此 skill。涵盖设计理论、实用调色板和 UMX 品牌视觉体系的 UI 应用指南。"
department: design
---

# UI/UX 设计体系知识库

本 Skill 为设计师和所有需要设计建议的同事提供专业的 UI/UX 设计知识参考。

---

## 一、设计基本原则

### 1.1 四大核心原则

| 原则 | 说明 | 检查方法 |
|:---|:---|:---|
| **对比（Contrast）** | 不同层级的元素之间必须有明显的视觉差异 | 眯起眼看界面，信息层级是否一目了然 |
| **对齐（Alignment）** | 所有元素必须有视觉上的对齐锚点，消灭随意放置 | 检查所有元素是否贴合网格线 |
| **重复（Repetition）** | 相同功能/层级的元素使用一致的样式（色彩、字号、间距） | 同类元素是否看起来"一个模子出来的" |
| **亲密（Proximity）** | 相关的信息在空间上靠近，不相关的远离 | 相关元素之间间距 < 不相关元素间距 |

### 1.2 视觉层级构建

按照重要性从高到低，通过以下手段建立层级：
1. **尺寸** — 最重要的元素最大
2. **色彩** — 强调色只用于最关键的 CTA 和状态
3. **对比** — 高对比引人注目，低对比退居背景
4. **留白** — 重要元素周围给予更多呼吸空间
5. **字重** — Bold > Medium > Regular

---

## 二、色彩体系

### 2.1 暗色模式设计指南（UMX 首选）

| 层级 | 用途 | 推荐色值 | UMX 对应色 |
|:---|:---|:---|:---|
| Background L0 | 页面底色 | #0A0A0A ~ #121212 | Stealth Black #0A0A0A |
| Surface L1 | 卡片/面板 | #1A1A1A ~ #1E1E1E | #1A1A1A |
| Surface L2 | 弹窗/浮层 | #2A2A2A ~ #2D2D2D | #2A2A2A |
| Surface L3 | 输入框/选中态 | #333333 ~ #3A3A3A | #333333 |
| Border | 分割线/边框 | rgba(255,255,255,0.06~0.12) | rgba(255,255,255,0.08) |
| Text Primary | 主文本 | #F5F5F5 ~ #FFFFFF | #F5F5F5 |
| Text Secondary | 辅助文本 | #999999 ~ #AAAAAA | #999999 |
| Text Disabled | 禁用文本 | #555555 ~ #666666 | #666666 |

### 2.2 强调色使用规范

| 色名 | 色值 | 使用场景 | 注意事项 |
|:---|:---|:---|:---|
| Neon Green | #DAFC08 | 主 CTA 按钮、成功状态、重点标记 | 不超过界面 5% 面积，过多会刺眼 |
| Vivid Purple | #7201FF | 次 CTA、链接、选中态、进度指示 | 可与 Neon Green 形成双色对比 |
| Error Red | #FF4444 | 错误、警告、删除 | 仅用于负面反馈 |
| Info Blue | #3B82F6 | 信息提示、loading | 中性引导色 |

### 2.3 毛玻璃效果（Glassmorphism）

UMX 品牌的核心视觉语言之一。CSS 实现：

```css
.glass-panel {
    background: rgba(26, 26, 26, 0.6);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
}
```

关键参数：
- `blur()` 值：16px（轻度）/ 32px（标准）/ 48px（深度）
- 背景透明度：0.4~0.7（太低看不见内容，太高失去透感）
- 边框：必须有一条极淡的白色边框增加层次感

### 2.4 渐变设计

```css
/* UMX 品牌渐变 — 赛博霓虹 */
.gradient-neon {
    background: linear-gradient(135deg, #7201FF 0%, #DAFC08 100%);
}

/* 微妙的暗色面板渐变 */
.gradient-surface {
    background: linear-gradient(180deg, #1A1A1A 0%, #0A0A0A 100%);
}

/* 文字渐变 */
.gradient-text {
    background: linear-gradient(90deg, #DAFC08, #7201FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
```

---

## 三、排版规范

### 3.1 字体选择

| 用途 | 首选字体 | 备选 | 特点 |
|:---|:---|:---|:---|
| 英文标题 | **Space Grotesk** | Roboto, Inter | 几何感强，未来主义 |
| 英文正文 | **Roboto** | Inter, -apple-system | 可读性极佳 |
| 中文正文 | **MiSans** | PingFang SC, Noto Sans CJK | 现代感，笔画清晰 |
| 等宽/代码 | **Google Sans Code** | JetBrains Mono, Fira Code | 代码展示专用 |

### 3.2 字号层级（以 rem 为基准）

| 层级 | 字号 | 字重 | 行距 | 用途 |
|:---|:---|:---|:---|:---|
| Display | 3rem (48px) | 700 | 1.1 | 首屏大标题 |
| H1 | 2.25rem (36px) | 700 | 1.2 | 页面标题 |
| H2 | 1.75rem (28px) | 600 | 1.3 | 区块标题 |
| H3 | 1.25rem (20px) | 600 | 1.4 | 卡片标题 |
| Body | 1rem (16px) | 400 | 1.6 | 正文 |
| Caption | 0.875rem (14px) | 400 | 1.5 | 辅助文字 |
| Overline | 0.75rem (12px) | 500 | 1.4 | 标签、全大写分类名 |

### 3.3 UMX 排版规则

- 标题：全大写（UPPERCASE），字间距 +0.05em ~ +0.1em
- 行距：标题极紧凑（1.1~1.2），正文舒适（1.5~1.6）
- 网格：竖版 5x9，横版 9x5
- 段落最大宽度：65~75 字符（中文约 30~35 字）

---

## 四、间距系统

采用 **4px 基准网格**（4 的倍数），常用值：

| Token | 值 | 用途 |
|:---|:---|:---|
| `--space-xs` | 4px | 图标与文字间距 |
| `--space-sm` | 8px | 同组元素内间距 |
| `--space-md` | 16px | 卡片内 padding |
| `--space-lg` | 24px | 区块间距 |
| `--space-xl` | 32px | 大区块间距 |
| `--space-2xl` | 48px | 页面级分隔 |
| `--space-3xl` | 64px | 首屏/Hero 区域 |

---

## 五、动效设计原则

### 5.1 缓动曲线

| 曲线名 | CSS 值 | 适用场景 |
|:---|:---|:---|
| **Ease Out** | `cubic-bezier(0.0, 0.0, 0.2, 1)` | 进入动画（元素出现）|
| **Ease In** | `cubic-bezier(0.4, 0.0, 1, 1)` | 退出动画（元素消失）|
| **Ease In Out** | `cubic-bezier(0.4, 0.0, 0.2, 1)` | 位移/尺寸变化 |
| **Spring** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性效果（按钮反馈）|

### 5.2 时长规范

| 类型 | 时长 | 示例 |
|:---|:---|:---|
| 微交互 | 100~200ms | 按钮 hover、toggle 切换 |
| 标准过渡 | 200~400ms | 面板展开、tab 切换 |
| 复杂动画 | 400~800ms | 页面转场、列表重排 |
| 强调动画 | 800~1200ms | 首屏入场、成就庆祝 |

### 5.3 常用 CSS 动画模式

```css
/* 渐入上浮 — 卡片/列表项入场 */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

/* 微光扫过 — 骨架屏/加载态 */
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
.shimmer {
    background: linear-gradient(90deg, #1A1A1A 25%, #2A2A2A 50%, #1A1A1A 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

/* 霓虹呼吸 — CTA 按钮待机态 */
@keyframes neonPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(218,252,8,0.3); }
    50% { box-shadow: 0 0 20px rgba(218,252,8,0.6); }
}
```

---

## 六、响应式设计

### 6.1 断点系统

| 断点 | 宽度 | 目标设备 |
|:---|:---|:---|
| `xs` | < 480px | 手机竖屏 |
| `sm` | 480~768px | 手机横屏/小平板 |
| `md` | 768~1024px | 平板/企业微信内嵌 |
| `lg` | 1024~1440px | 笔记本/桌面 |
| `xl` | > 1440px | 大屏显示器 |

### 6.2 移动优先原则

1. 基础样式写移动端，通过 `@media (min-width: ...)` 逐步增强
2. 触控区域最小 44x44px
3. 文字最小 14px，行距不低于 1.4
4. 避免 hover-only 交互（移动端无 hover）

---

## 七、组件设计检查清单

设计任何 UI 组件前，过一遍这个清单：

- [ ] 是否符合 UMX 品牌色彩体系（暗底 + 霓虹强调色）？
- [ ] 是否使用了正确的字体和层级？
- [ ] 间距是否遵循 4px 基准网格？
- [ ] 是否有 hover/active/focus 交互状态？
- [ ] 是否包含平滑过渡动画（不突兀）？
- [ ] 是否适配移动端？
- [ ] 毛玻璃/渐变是否用得克制（不超过 2 层叠加）？
- [ ] 对比度是否满足 WCAG AA 标准（4.5:1）？
