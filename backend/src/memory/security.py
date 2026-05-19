"""内容安全扫描器 —— 移植自 NousResearch/hermes-agent tools/memory_tool.py。

记忆条目会注入系统提示词，必须挡掉 prompt 注入 / 角色劫持 / 密钥外泄 /
不可见 unicode / SSH 后门等攻击模式。
"""
from __future__ import annotations

import re

_MEMORY_THREAT_PATTERNS: list[tuple[str, str]] = [
    (r"ignore\s+(previous|all|above|prior)\s+instructions", "prompt_injection"),
    (r"you\s+are\s+now\s+", "role_hijack"),
    (r"do\s+not\s+tell\s+the\s+user", "deception_hide"),
    (r"system\s+prompt\s+override", "sys_prompt_override"),
    (r"disregard\s+(your|all|any)\s+(instructions|rules|guidelines)", "disregard_rules"),
    (
        r"act\s+as\s+(if|though)\s+you\s+(have\s+no|don't\s+have)\s+(restrictions|limits|rules)",
        "bypass_restrictions",
    ),
    (
        r"curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)",
        "exfil_curl",
    ),
    (
        r"wget\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)",
        "exfil_wget",
    ),
    (r"cat\s+[^\n]*(\.env|credentials|\.netrc|\.pgpass|\.npmrc|\.pypirc)", "read_secrets"),
    (r"authorized_keys", "ssh_backdoor"),
    (r"\$HOME/\.ssh|~/\.ssh", "ssh_access"),
]

_INVISIBLE_CHARS = {
    "​",  # zero-width space
    "‌",
    "‍",
    "⁠",
    "﻿",
    "‪",
    "‫",
    "‬",
    "‭",
    "‮",
}


def scan_memory_content(content: str) -> str | None:
    """扫描内容，命中威胁返回错误字符串，否则 None。"""
    for ch in _INVISIBLE_CHARS:
        if ch in content:
            return (
                f"Blocked: content contains invisible unicode character "
                f"U+{ord(ch):04X} (possible injection)."
            )
    for pattern, pid in _MEMORY_THREAT_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            return (
                f"Blocked: content matches threat pattern '{pid}'. "
                f"Memory entries are injected into the system prompt and "
                f"must not contain injection or exfiltration payloads."
            )
    return None
