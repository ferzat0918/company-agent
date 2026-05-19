---
name: release
description: 发布新版本：自动生成中文 CHANGELOG + 打 git tag + 推送到远端。当用户说"发个新版本"、"出 v1.0.0"、"做 release"、"更新版本号"、"刷新更新日志"、"看最近改了啥还没发版"等意图，**必须**使用这个 skill。它会读 git log → 调 DeepSeek 翻译成中文 → 按 commit 前缀分组 → 写 CHANGELOG.md → 打 tag → push，全自动，不要手写更新日志条目。
---

# 发布新版本

把"读 commit log → 翻译成中文 → 写 CHANGELOG → 打 tag → push"这套流程自动化。**永远不要手写 CHANGELOG.md 条目**，让 `scripts/release.py` 干。

## 何时使用

任意一种意图都触发：

- 用户给了版本号 —— "发 v1.0.0"、"出个 v1.2.3"、"v0.2.0 上线"
- 用户没给版本号 —— "发个新版本"、"做个 release"、"更新日志该刷一下"
- 用户问改动 —— "最近做了啥还没发版"、"查一下未发布的改动"（这时**只 dry-run**，先不实际打 tag）

## 执行流程

### 步骤 1：检查前置条件

```bash
git status --porcelain          # 必须空
git rev-parse --abbrev-ref HEAD # 应该是 main
```

**未提交改动**：列文件给用户看，问怎么办（先 commit / stash / 取消）。
**不在 main**：提醒用户，确认要不要切到 main 再发版（在 feature 分支打 tag 通常不是用户想要的）。

### 步骤 2：决定版本号

#### 用户给了 vX.Y.Z 格式
直接用。验证格式：`^v\d+\.\d+\.\d+(-[\w.]+)?$`。

#### 用户没给
先看 commit 历史推荐：

```bash
git describe --tags --abbrev=0   # 上次 tag
git log <prev_tag>..HEAD --pretty=format:%s --no-merges
```

按 Conventional Commit 推断 bump 级别：

| 历史中出现 | 建议 bump | 例子 |
|---|---|---|
| `feat!:` / `fix!:` / `BREAKING CHANGE` | **major** | v1.2.3 → v2.0.0 |
| 任意 `feat:` | **minor** | v1.2.3 → v1.3.0 |
| 只有 `fix:` / `docs:` / `refactor:` / `chore:` / 其他 | **patch** | v1.2.3 → v1.2.4 |
| 0 个 commit | 别发，告诉用户没新东西 | — |

向用户展示：

> 上次发版 `v1.0.0`（5 天前）。之后有 12 个 commit：
> - 3 个 `feat:`（新功能）
> - 5 个 `fix:`（修复）
> - 4 个 `docs:`/`chore:`
>
> 建议发 **v1.1.0**（minor bump，因为有新功能）。确认吗？

**记得问用户确认版本号**，除非他们一开始就明确给了。

### 步骤 3：Dry-run 预览（推荐先跑）

```bash
python scripts/release.py vX.Y.Z --dry-run
```

把脚本输出的 CHANGELOG 章节贴给用户看。重点关注：

- 翻译质量（有没有专有名词翻错、有没有歧义）
- 分组是否合理（commit 前缀有没有被吞掉的）
- 条目数量（异常多/少都值得问一下）

如果用户看了觉得 OK → 进步骤 4。
如果用户嫌翻译不好 → 选项：
- 改用更强的 model（编辑 `.env` 的 `DEEPSEEK_MODEL`）
- 手动改某几条（生成后再编辑 CHANGELOG.md）
- 让用户把最不满的条目告诉你，你建议改 commit message 或者 PR 标题

### 步骤 4：执行真正的发布

```bash
python scripts/release.py vX.Y.Z
```

脚本做的事（**这是事实**，不要重复实现）：
1. 读上次 tag 到 HEAD 之间的所有 commit
2. 批量调 DeepSeek 翻译每条 subject 成中文
3. 写 `CHANGELOG.md` 顶部新增一段
4. 同步一份到 `frontend/agent-chat-ui/out/CHANGELOG.md`（nginx 服务的位置）
5. `git add` 两个 changelog 文件
6. `git commit -m "chore(release): vX.Y.Z"`
7. `git tag vX.Y.Z -m "Release vX.Y.Z"`
8. `git push origin main`
9. `git push origin vX.Y.Z`

### 步骤 5：验证 + 报告

```bash
git log --oneline -3                       # 看 release commit 在最顶
git tag --list "vX.Y.Z"                    # 看 tag 存在
git rev-parse main                          # 对比
git rev-parse origin/main                   # 应该一致
```

向用户报告，格式参考：

> 🚀 已发布 **v1.1.0**
>
> 改动汇总：3 ✨ 新功能 / 5 🐛 修复 / 2 📝 文档
>
> - 应用内：http://localhost/changelog
> - GitHub：https://github.com/<owner>/<repo>/releases/tag/v1.1.0
> - 同事下次刷新页面即可看到（nginx 直接服务最新 CHANGELOG.md，无需重启容器）

## 关键脚本参数速查

```
python scripts/release.py vX.Y.Z              # 完整流程（写文件 + commit + tag + push）
python scripts/release.py vX.Y.Z --dry-run    # 只预览翻译，啥也不改
python scripts/release.py vX.Y.Z --no-push    # 本地写文件 + commit + tag，不 push（适合最后想再瞄一眼）
```

## 边界 / 错误处理

| 情况 | 处理 |
|---|---|
| 工作区不干净 | 列出未提交文件，让用户决定先 commit / stash / 取消 |
| tag 已存在 | 脚本会报错并退出，提醒用户换个版本号（通常是 bump 一级） |
| `DEEPSEEK_API_KEY` 缺失 | 脚本退化为"不翻译，写 commit 原文"。先警告用户，问要不要继续 |
| DeepSeek 返回行数对不上 | 脚本会自动退化为不翻译并打 warning，没有数据损坏风险 |
| `git push` 失败（远端有新提交） | 提醒用户 `git pull --rebase origin main` 然后**只 push 标签**（commit + tag 都已本地，别重打）：`git push origin main && git push origin vX.Y.Z` |
| `git push` 失败（网络） | 让用户自己重试 push，给出确切命令 |

## 不要做的事

- **不要手写 CHANGELOG.md 条目** —— 整套机制就是为了避免这个
- **不要 force push tag** —— 一旦推上去，新版本就发布了
- **不要在非 main 分支打 tag** —— 会让 CHANGELOG 跟实际历史对不上
- **不要跳过 dry-run 直接 push** —— 即使用户没明说，至少展示一次预览
- **不要试图重新实现脚本的逻辑** —— 直接调 `scripts/release.py`

## 触发示例

| 用户说 | 该做 |
|---|---|
| "发个新版本" | 步骤 1 → 步骤 2（自动推荐 + 确认）→ 3 → 4 → 5 |
| "出 v1.2.0" | 步骤 1 → 步骤 2（用 v1.2.0）→ 3 → 4 → 5 |
| "最近改了啥还没发版" | 步骤 1 → 步骤 2（推荐版本号）→ 步骤 3（dry-run 看一下），**不进步骤 4** |
| "刷新一下更新日志" | 同"发个新版本" |
| "上 v2.0.0" | 步骤 1 → 步骤 2（验证 v2.0.0 合理 —— 是不是有 breaking change）→ 3 → 4 → 5 |
