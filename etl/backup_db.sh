#!/usr/bin/env bash
# 备份主库 → data/lr-song.sql.gz.part-aa / part-ab
# 说明：844MB 主库 → SQL dump → gzip → split -b 90m（每卷 < 100MB GitHub 限制）
set -euo pipefail
DB="${1:-data/lr-song.sqlite3}"
OUT="${2:-data/lr-song.sql.gz}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

sqlite3 "$DB" ".dump" | gzip -c > "$TMP/full.gz"
rm -f "${OUT}".part-*
# 每卷 90MB
split -b 90m "$TMP/full.gz" "${OUT}.part-"
echo "✓ 备份完成："
ls -la "${OUT}".part-*
echo
echo "恢复：cat ${OUT}.part-* | gunzip -c | sqlite3 <目标库>"
