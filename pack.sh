#!/usr/bin/env bash
# pack.sh — 重新打包 OPC-X-Reply-Extension.zip 供普通用户下载
# 用法：bash pack.sh
# 输出：项目根的 OPC-X-Reply-Extension.zip（覆盖旧文件）
# 何时跑：每次迭代代码测试通过、push 到远端之前

set -euo pipefail
cd "$(dirname "$0")"

if ! command -v pwsh >/dev/null 2>&1; then
  echo "[pack] 需要 PowerShell 7（pwsh）：Compress-Archive 在 5.1/7 上对中文文件名都有 bug，必须走 .NET API" >&2
  echo "[pack] 安装：winget install --id Microsoft.PowerShell" >&2
  exit 1
fi

pwsh -NoProfile -File pack.ps1
