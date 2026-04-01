#!/usr/bin/env bash
set -euo pipefail

MAX_MB="${MAX_MB:-10}"
MAX_BYTES=$((MAX_MB * 1024 * 1024))

echo "[1/2] 检查已跟踪大文件（>${MAX_MB}MB）"
large_found=0
while IFS= read -r -d '' f; do
  [[ -f "$f" ]] || continue
  size=$(wc -c <"$f" | tr -d ' ')
  if (( size > MAX_BYTES )); then
    printf '  - %.2f MB\t%s\n' "$(awk "BEGIN{printf ${size}/1024/1024}")" "$f"
    large_found=1
  fi
done < <(git ls-files -z)

echo "[2/2] 检查敏感信息模式（快速规则）"
secret_patterns='(AKIA[0-9A-Z]{16}|LTAI[0-9A-Za-z]{8,}|sk-[A-Za-z0-9]{24,}|BEGIN [A-Z ]*PRIVATE KEY|API_KEY=|SECRET=|TOKEN=|PASSWORD=)'
if git grep -nE "$secret_patterns" -- ':!*.md' ':!.env.example' ':!scripts/pre-open-source-check.sh' >/tmp/oss_secret_scan.out; then
  echo "  发现疑似敏感信息，请人工复核："
  sed -n '1,120p' /tmp/oss_secret_scan.out
  secret_found=1
else
  secret_found=0
  echo "  未命中快速规则"
fi
rm -f /tmp/oss_secret_scan.out

if (( large_found || secret_found )); then
  echo
  echo "[FAIL] 开源前检查未通过。"
  exit 1
fi

echo
echo "[PASS] 开源前检查通过。"
