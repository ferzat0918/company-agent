#!/usr/bin/env python3
"""一键发布 release：生成中文更新日志 + 打 tag + 推送。

用法：
    python scripts/release.py v1.0.0
    python scripts/release.py v1.0.0 --dry-run   # 只预览，不写文件/不打 tag/不推送
    python scripts/release.py v1.0.0 --no-push   # 写 CHANGELOG.md + 打 tag，但不推送

流程：
    1. 读取上一个 tag 到 HEAD 之间的所有 Conventional Commits
    2. 按 prefix 分组（feat/fix/docs/...），并整批调 DeepSeek 翻译成简洁中文
    3. 把新版块拼到 CHANGELOG.md 顶部
    4. git add CHANGELOG.md && commit && tag && push

依赖：仅 Python 3.11 stdlib（无外部库）。DEEPSEEK_API_KEY 从仓库根 `.env` 读取，
没有 key 时退化为不翻译（commit 原文直接写进 CHANGELOG.md）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import date
from pathlib import Path

# Windows default console is GBK; force UTF-8 so emojis + 中文 don't crash.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG_PATH = REPO_ROOT / "CHANGELOG.md"
# nginx 容器只挂了 out/ 目录（read-only），所以同步一份到那里供 /changelog 页面 fetch。
CHANGELOG_PUBLIC_PATH = REPO_ROOT / "frontend" / "agent-chat-ui" / "out" / "CHANGELOG.md"
ENV_PATH = REPO_ROOT / ".env"

# Conventional Commit prefix → CHANGELOG 中文分类
CATEGORY_MAP: dict[str, str] = {
    "feat": "✨ 新功能",
    "fix": "🐛 修复",
    "perf": "⚡️ 性能",
    "refactor": "♻️ 重构",
    "security": "🔒 安全",
    "docs": "📝 文档",
    "test": "✅ 测试",
    "build": "📦 构建",
    "ci": "🤖 CI",
    "style": "💄 样式",
    "chore": "🔧 杂项",
    "merge": "🔀 合并",
}

# 渲染顺序（用户最关心的在前）
CATEGORY_ORDER: list[str] = list(CATEGORY_MAP.values())

CONVENTIONAL_RE = re.compile(r"^(\w+)(?:\([\w\-\/\.]+\))?:\s*(.+)$")

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
TRANSLATE_SYSTEM = (
    "你是发版日志助手。把下面收到的英文 git commit 标题逐行翻译成简洁的中文，"
    "每条 ≤30 个字、保留专有名词和文件名原样、不要加任何额外解释或标点。"
    "输入有 N 行，输出必须也是 N 行，顺序一一对应。"
)


# ─── .env 读取（stdlib，零依赖） ──────────────────────────────────


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if not ENV_PATH.exists():
        return env
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip("'").strip('"')
    return env


# ─── git 操作 ──────────────────────────────────────────────────


def git(*args: str, check: bool = True) -> str:
    res = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if check and res.returncode != 0:
        sys.exit(f"git {' '.join(args)} 失败：{res.stderr.strip()}")
    return res.stdout.strip()


def previous_tag() -> str | None:
    out = git("describe", "--tags", "--abbrev=0", check=False)
    return out or None


def commits_in_range(prev: str | None) -> list[tuple[str, str]]:
    range_arg = f"{prev}..HEAD" if prev else "HEAD"
    raw = git("log", range_arg, "--pretty=format:%h|%s", "--no-merges")
    out: list[tuple[str, str]] = []
    for line in raw.splitlines():
        if "|" not in line:
            continue
        sha, subject = line.split("|", 1)
        out.append((sha, subject))
    return out


def ensure_clean_worktree() -> None:
    if git("status", "--porcelain"):
        sys.exit("工作区有未提交的改动。先 commit 或 stash 再发版。")


# ─── 翻译（批量调 DeepSeek） ──────────────────────────────────


def translate_batch(subjects: list[str], api_key: str, model: str) -> list[str]:
    if not subjects:
        return []
    if not api_key:
        # 没有 key 就退化为原文，不阻断发版
        return subjects
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": TRANSLATE_SYSTEM},
            {"role": "user", "content": "\n".join(subjects)},
        ],
        "temperature": 0,
        "stream": False,
    }
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"⚠️  DeepSeek 调用失败 ({e})，退化为不翻译。", file=sys.stderr)
        return subjects
    content = body["choices"][0]["message"]["content"].strip()
    lines = [line.rstrip() for line in content.splitlines() if line.strip()]
    # 如果数量对不上，宁可不翻译也别错位
    if len(lines) != len(subjects):
        print(
            f"⚠️  DeepSeek 返回 {len(lines)} 行但期望 {len(subjects)} 行，退化为不翻译。",
            file=sys.stderr,
        )
        return subjects
    return lines


# ─── CHANGELOG 渲染 ───────────────────────────────────────────


def build_section(
    version: str,
    grouped: dict[str, list[tuple[str, str]]],
) -> str:
    lines = [f"## {version} — {date.today().isoformat()}", ""]
    for category in CATEGORY_ORDER:
        items = grouped.get(category)
        if not items:
            continue
        lines.append(f"### {category}")
        lines.append("")
        for sha, summary in items:
            lines.append(f"- {summary} (`{sha}`)")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def prepend_changelog(new_section: str) -> None:
    seed = "# 更新日志\n\n所有用户可见的变化都会列在这里。版本号遵循 SemVer。\n\n"
    existing = CHANGELOG_PATH.read_text(encoding="utf-8") if CHANGELOG_PATH.exists() else seed
    # 把新章节插在第一个 `##` 之前；若文件里还没有 `##`，直接接在 seed 之后
    head, sep, tail = existing.partition("\n## ")
    if sep:
        body = head + "\n" + new_section + "\n" + sep + tail
    else:
        body = existing.rstrip() + "\n\n" + new_section
    CHANGELOG_PATH.write_text(body, encoding="utf-8")


# ─── 主流程 ────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="新版本号，例如 v1.0.0")
    parser.add_argument("--dry-run", action="store_true", help="只预览不落盘")
    parser.add_argument("--no-push", action="store_true", help="不 push")
    args = parser.parse_args()

    if not re.match(r"^v\d+\.\d+\.\d+", args.version):
        sys.exit("版本号必须是 vX.Y.Z 格式（可带 -beta 等后缀）")

    if not args.dry_run:
        ensure_clean_worktree()
        if args.version in git("tag", "--list").splitlines():
            sys.exit(f"tag {args.version} 已经存在，换个版本号。")

    prev = previous_tag()
    commits = commits_in_range(prev)
    print(f"📋 上个 tag: {prev or '(无)'}  →  HEAD 共 {len(commits)} 条 commit")
    if not commits:
        sys.exit("没有新 commit，不需要发版。")

    # 解析 + 分组
    parsed: list[tuple[str, str, str]] = []  # (sha, category, body)
    for sha, subject in commits:
        m = CONVENTIONAL_RE.match(subject)
        if m:
            kind = m.group(1).lower()
            body = m.group(2)
        else:
            kind = "chore"
            body = subject
        category = CATEGORY_MAP.get(kind, CATEGORY_MAP["chore"])
        parsed.append((sha, category, body))

    # 批量翻译
    env = load_env()
    api_keys = env.get("DEEPSEEK_API_KEYS", "").split(",")
    api_key = next((k.strip() for k in api_keys if k.strip()), env.get("DEEPSEEK_API_KEY", "").strip())
    model = env.get("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat"
    print(f"🤖 翻译用模型 {model}（共 {len(parsed)} 条）...")
    translated = translate_batch([body for _, _, body in parsed], api_key, model)

    grouped: dict[str, list[tuple[str, str]]] = {}
    for (sha, category, _body), summary in zip(parsed, translated):
        grouped.setdefault(category, []).append((sha, summary))

    section = build_section(args.version, grouped)
    print("\n────── 预览（将插入 CHANGELOG.md 顶部）──────\n")
    print(section)

    if args.dry_run:
        print("（dry-run，未写文件、未打 tag、未推送）")
        return

    prepend_changelog(section)
    print(f"✅ 已更新 {CHANGELOG_PATH.relative_to(REPO_ROOT)}")
    # 同步一份给 nginx，前端 /changelog 页面会去 fetch /CHANGELOG.md
    CHANGELOG_PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHANGELOG_PUBLIC_PATH.write_text(CHANGELOG_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"✅ 已同步 {CHANGELOG_PUBLIC_PATH.relative_to(REPO_ROOT)}")

    git("add", str(CHANGELOG_PATH.relative_to(REPO_ROOT)))
    git("add", str(CHANGELOG_PUBLIC_PATH.relative_to(REPO_ROOT)))
    git("commit", "-m", f"chore(release): {args.version}")
    git("tag", args.version, "-m", f"Release {args.version}")
    print(f"✅ 已创建 commit + tag {args.version}")

    if args.no_push:
        print("⏭️  跳过推送（--no-push）。手动 push 时记得 --tags：")
        print(f"    git push origin main --tags")
        return

    git("push", "origin", "main")
    git("push", "origin", args.version)
    print(f"🚀 已推送到 origin/main 和 tag {args.version}")


if __name__ == "__main__":
    main()
