# 更新日志

所有用户可见的变化都会列在这里。版本号遵循 SemVer。

每次发布运行：

```bash
python scripts/release.py vX.Y.Z
```

脚本会自动读 git log → 翻译成中文 → 按类型分组 → 写入本文件并打 tag 推送。
