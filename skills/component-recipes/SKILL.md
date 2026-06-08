---
name: component-recipes
description: "UI 组件菜谱库 — 当用户需要 UI 组件推荐、设计模式参考、前端组件代码片段、页面模板时加载此 skill。包含动画组件、图表组件、导航组件、卡片组件、Hero 区域、表单组件等分类菜谱，均为完整可运行的 HTML/CSS 代码。"
department: design
---

# UI 组件菜谱库

本 Skill 提供即拿即用的 UI 组件代码菜谱，全部遵循 UMX 品牌视觉体系（暗色调 + 霓虹强调色 + 毛玻璃质感）。

每个菜谱都是**完整可运行**的 HTML 文件，可通过 `execute_python_in_sandbox` 保存到用户工作区。

---

## 菜谱索引

| 编号 | 分类 | 组件名 | 关键词 |
|:---|:---|:---|:---|
| 01 | 动画 | Shimmer 骨架屏 | shimmer, loading, skeleton, 骨架, 加载 |
| 02 | 动画 | Glassmorphism 毛玻璃卡片 | glass, 毛玻璃, 磨砂, blur, 卡片 |
| 03 | 图表 | Animated Donut 环形图 | donut, ring, chart, 环形, 图表, 进度 |
| 04 | 导航 | Sleek Sidebar 暗色侧边栏 | sidebar, nav, 侧边栏, 导航, menu |
| 05 | 卡片 | Product Card 产品展示卡 | product, card, 产品, 展示, 商品 |
| 06 | Hero | Dark Hero Section 首屏 | hero, landing, 首屏, 大图, banner |
| 07 | 表单 | Neon Input 霓虹输入框 | input, form, 输入, 表单, neon |
| 08 | 按钮 | Gradient CTA 渐变按钮 | button, cta, 按钮, gradient, 渐变 |

---

## 01 — Shimmer 骨架屏

微光扫过效果的骨架屏加载组件，替代传统 spinner。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shimmer Skeleton</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: 'Roboto', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .skeleton-card {
    width: 320px; padding: 24px; border-radius: 16px;
    background: #1A1A1A; border: 1px solid rgba(255,255,255,0.06);
  }
  .skeleton-line {
    height: 16px; border-radius: 8px; margin-bottom: 12px;
    background: linear-gradient(90deg, #1A1A1A 25%, #2A2A2A 50%, #1A1A1A 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite ease-in-out;
  }
  .skeleton-line.title { height: 24px; width: 70%; margin-bottom: 20px; }
  .skeleton-line.short { width: 50%; }
  .skeleton-avatar {
    width: 48px; height: 48px; border-radius: 50%; margin-bottom: 16px;
    background: linear-gradient(90deg, #1A1A1A 25%, #2A2A2A 50%, #1A1A1A 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite ease-in-out;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
</head>
<body>
  <div class="skeleton-card">
    <div class="skeleton-avatar"></div>
    <div class="skeleton-line title"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
  </div>
</body>
</html>
```

---

## 02 — Glassmorphism 毛玻璃卡片

UMX 标志性的毛玻璃面板效果，带渐变边框和悬停动效。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Glass Card</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0A0A0A; font-family: 'Space Grotesk', sans-serif; color: #F5F5F5;
    display: flex; justify-content: center; align-items: center; min-height: 100vh;
    background-image: radial-gradient(ellipse at 30% 50%, rgba(114,1,255,0.15) 0%, transparent 60%),
                      radial-gradient(ellipse at 70% 50%, rgba(218,252,8,0.08) 0%, transparent 60%);
  }
  .glass-card {
    width: 360px; padding: 32px; border-radius: 20px;
    background: rgba(26, 26, 26, 0.55);
    backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s ease;
  }
  .glass-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(218,252,8,0.12);
  }
  .glass-card h2 {
    font-size: 1.25rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; margin-bottom: 12px;
  }
  .glass-card p { font-size: 0.9rem; color: #999; line-height: 1.6; margin-bottom: 20px; }
  .glass-card .tag {
    display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem;
    font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
    background: rgba(218,252,8,0.12); color: #DAFC08; border: 1px solid rgba(218,252,8,0.2);
  }
</style>
</head>
<body>
  <div class="glass-card">
    <h2>System Console</h2>
    <p>5052 航空铝合金一体成型控制台，CNC 精密铣削工艺，0.01mm 配合公差五金节点。冷硬结构与情绪光场的极致融合。</p>
    <span class="tag">FUTURISM</span>
  </div>
</body>
</html>
```

---

## 03 — Animated Donut 环形图

SVG + CSS 动画实现的环形进度图表，适用于数据面板和仪表盘。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Donut Chart</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
  .donut-container { position: relative; width: 200px; height: 200px; }
  .donut-container svg { transform: rotate(-90deg); }
  .donut-container circle {
    fill: none; stroke-width: 12; stroke-linecap: round;
  }
  .donut-bg { stroke: #1A1A1A; }
  .donut-fill {
    stroke: #DAFC08; stroke-dasharray: 502; stroke-dashoffset: 502;
    animation: fillDonut 1.5s cubic-bezier(0.4,0,0.2,1) forwards;
    filter: drop-shadow(0 0 6px rgba(218,252,8,0.4));
  }
  .donut-label {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: #F5F5F5; font-size: 2rem; font-weight: 700;
  }
  .donut-label span { font-size: 0.875rem; color: #666; }
  @keyframes fillDonut {
    to { stroke-dashoffset: 126; /* 75% 进度 */ }
  }
</style>
</head>
<body>
  <div class="donut-container">
    <svg viewBox="0 0 180 180">
      <circle class="donut-bg" cx="90" cy="90" r="80"/>
      <circle class="donut-fill" cx="90" cy="90" r="80"/>
    </svg>
    <div class="donut-label">75%<br><span>PROGRESS</span></div>
  </div>
</body>
</html>
```

---

## 04 — Sleek Sidebar 暗色侧边栏

带 hover 高亮和活跃状态指示的暗色导航侧边栏。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sidebar</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: 'Roboto', sans-serif; }
  .sidebar {
    width: 260px; height: 100vh; background: #111; padding: 24px 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column;
  }
  .sidebar-brand {
    padding: 0 24px 24px; font-size: 1.25rem; font-weight: 700; color: #F5F5F5;
    text-transform: uppercase; letter-spacing: 0.1em;
    border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 16px;
  }
  .sidebar-brand span { color: #DAFC08; }
  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 24px; color: #888; font-size: 0.9rem; font-weight: 500;
    cursor: pointer; transition: all 0.2s ease; position: relative;
    text-decoration: none;
  }
  .nav-item:hover { color: #F5F5F5; background: rgba(255,255,255,0.04); }
  .nav-item.active {
    color: #DAFC08; background: rgba(218,252,8,0.06);
  }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
    background: #DAFC08; border-radius: 0 2px 2px 0;
  }
  .nav-icon { width: 20px; text-align: center; font-size: 1rem; }
</style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-brand"><span>U</span>MX</div>
    <a class="nav-item active"><span class="nav-icon">&#9632;</span> Dashboard</a>
    <a class="nav-item"><span class="nav-icon">&#9654;</span> Products</a>
    <a class="nav-item"><span class="nav-icon">&#9733;</span> Analytics</a>
    <a class="nav-item"><span class="nav-icon">&#9881;</span> Settings</a>
  </nav>
</body>
</html>
```

---

## 05 — Product Card 产品展示卡

UMX 风格的产品展示卡片，带渐变悬停边框和参数信息。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Product Card</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: 'Space Grotesk', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .product-card {
    width: 340px; border-radius: 20px; overflow: hidden;
    background: #1A1A1A; border: 1px solid rgba(255,255,255,0.06);
    transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
  }
  .product-card:hover {
    border-color: rgba(218,252,8,0.3);
    box-shadow: 0 0 30px rgba(218,252,8,0.08);
    transform: translateY(-6px);
  }
  .product-img {
    width: 100%; height: 220px; background: linear-gradient(135deg, #111 0%, #1A1A1A 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem; color: #333;
  }
  .product-info { padding: 24px; }
  .product-info .overline {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em;
    color: #DAFC08; margin-bottom: 8px;
  }
  .product-info h3 { font-size: 1.2rem; font-weight: 700; color: #F5F5F5; margin-bottom: 8px; text-transform: uppercase; }
  .product-info p { font-size: 0.85rem; color: #888; line-height: 1.6; margin-bottom: 16px; }
  .specs { display: flex; gap: 16px; }
  .spec { font-size: 0.75rem; color: #666; }
  .spec strong { display: block; color: #F5F5F5; font-size: 0.9rem; margin-bottom: 2px; }
</style>
</head>
<body>
  <div class="product-card">
    <div class="product-img">&#9651;</div>
    <div class="product-info">
      <div class="overline">System Series</div>
      <h3>Console Desk</h3>
      <p>5052 航空铝合金一体成型，CNC 铣削五金节点，模块化声光电交互系统。</p>
      <div class="specs">
        <div class="spec"><strong>5052</strong>铝合金</div>
        <div class="spec"><strong>0.01mm</strong>配合公差</div>
        <div class="spec"><strong>RGB</strong>光场系统</div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 06 — Dark Hero Section 首屏

赛博朋克风格的全屏 Hero 区域，带渐变文字和 CTA 按钮。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hero Section</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: 'Space Grotesk', sans-serif; color: #F5F5F5; }
  .hero {
    min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;
    text-align: center; padding: 48px 24px; position: relative; overflow: hidden;
  }
  .hero::before {
    content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
    background: radial-gradient(ellipse at center, rgba(114,1,255,0.12) 0%, transparent 50%);
    animation: rotate 20s linear infinite;
  }
  @keyframes rotate { to { transform: rotate(360deg); } }
  .hero-content { position: relative; z-index: 1; max-width: 700px; }
  .hero-overline {
    font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em;
    color: #DAFC08; margin-bottom: 16px;
  }
  .hero-title {
    font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 700; text-transform: uppercase;
    line-height: 1.1; margin-bottom: 24px; letter-spacing: -0.02em;
  }
  .hero-title .gradient {
    background: linear-gradient(90deg, #DAFC08, #7201FF);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .hero-desc { font-size: 1.1rem; color: #888; line-height: 1.7; margin-bottom: 40px; max-width: 520px; margin-left: auto; margin-right: auto; }
  .hero-cta {
    display: inline-block; padding: 14px 36px; border-radius: 8px;
    background: #DAFC08; color: #0A0A0A; font-weight: 700; font-size: 0.9rem;
    text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none;
    transition: all 0.3s ease; border: none; cursor: pointer;
  }
  .hero-cta:hover {
    box-shadow: 0 0 24px rgba(218,252,8,0.4);
    transform: translateY(-2px);
  }
</style>
</head>
<body>
  <section class="hero">
    <div class="hero-content">
      <div class="hero-overline">// Retro-Futurism</div>
      <h1 class="hero-title">THE FUTURE OF<br><span class="gradient">WORKSPACE SYSTEMS</span></h1>
      <p class="hero-desc">冷硬结构与情绪光场的极致融合。让每一件产品都成为空间里的先锋符号，先于时代，归于本质。</p>
      <a href="#" class="hero-cta">Explore Now</a>
    </div>
  </section>
</body>
</html>
```

---

## 07 — Neon Input 霓虹输入框

聚焦时发出霓虹光辉的输入框组件。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neon Input</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: sans-serif; display: flex; flex-direction: column; gap: 24px; justify-content: center; align-items: center; min-height: 100vh; }
  .input-group { position: relative; width: 320px; }
  .input-group input {
    width: 100%; padding: 14px 16px; border-radius: 10px;
    background: #1A1A1A; border: 1px solid rgba(255,255,255,0.08);
    color: #F5F5F5; font-size: 0.95rem; outline: none;
    transition: all 0.3s ease;
  }
  .input-group input::placeholder { color: #555; }
  .input-group input:focus {
    border-color: #DAFC08;
    box-shadow: 0 0 0 3px rgba(218,252,8,0.12), 0 0 20px rgba(218,252,8,0.08);
  }
  .input-group label {
    position: absolute; top: -8px; left: 12px; padding: 0 4px;
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
    color: #666; background: #0A0A0A;
    transition: color 0.3s ease;
  }
  .input-group input:focus + label { color: #DAFC08; }
</style>
</head>
<body>
  <div class="input-group">
    <input type="text" placeholder="Enter your email">
    <label>Email</label>
  </div>
  <div class="input-group">
    <input type="password" placeholder="Enter password">
    <label>Password</label>
  </div>
</body>
</html>
```

---

## 08 — Gradient CTA 渐变按钮

带渐变背景和悬停发光效果的 CTA 按钮组合。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CTA Buttons</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A0A; font-family: 'Space Grotesk', sans-serif; display: flex; gap: 20px; justify-content: center; align-items: center; min-height: 100vh; flex-wrap: wrap; padding: 24px; }
  .btn {
    padding: 14px 32px; border-radius: 10px; font-size: 0.85rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; border: none;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1); text-decoration: none; display: inline-block;
  }
  .btn-primary {
    background: #DAFC08; color: #0A0A0A;
  }
  .btn-primary:hover {
    box-shadow: 0 0 24px rgba(218,252,8,0.5); transform: translateY(-2px);
  }
  .btn-secondary {
    background: transparent; color: #F5F5F5;
    border: 1px solid rgba(255,255,255,0.15);
  }
  .btn-secondary:hover {
    border-color: #DAFC08; color: #DAFC08;
    box-shadow: 0 0 16px rgba(218,252,8,0.1);
  }
  .btn-gradient {
    background: linear-gradient(135deg, #7201FF 0%, #DAFC08 100%); color: #0A0A0A;
  }
  .btn-gradient:hover {
    box-shadow: 0 0 28px rgba(114,1,255,0.4); transform: translateY(-2px) scale(1.02);
  }
  .btn-ghost {
    background: rgba(218,252,8,0.08); color: #DAFC08;
    border: 1px solid rgba(218,252,8,0.2);
  }
  .btn-ghost:hover {
    background: rgba(218,252,8,0.15); box-shadow: 0 0 20px rgba(218,252,8,0.12);
  }
</style>
</head>
<body>
  <a class="btn btn-primary">Primary</a>
  <a class="btn btn-secondary">Secondary</a>
  <a class="btn btn-gradient">Gradient</a>
  <a class="btn btn-ghost">Ghost</a>
</body>
</html>
```

---

## 如何使用菜谱

1. 根据用户需求从索引表中匹配合适的菜谱
2. 将菜谱代码作为参考基础，根据具体需求进行定制修改
3. 通过 `execute_python_in_sandbox` 将最终 HTML 代码保存到用户工作区
4. 可以组合多个菜谱构建完整页面

**示例沙盒代码**：
```python
html_code = """（将菜谱代码粘贴或修改后放在这里）"""
with open("my-component.html", "w", encoding="utf-8") as f:
    f.write(html_code)
print("组件已保存: my-component.html")
```
