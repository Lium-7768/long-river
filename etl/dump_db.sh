#!/usr/bin/env bash
# 从 D1 导出一份本地 SQLite 备份 → data/lr-song.sqlite3
# 用途：D1 故障时本地仍可用；版本化管理数据快照
# 用法：CLOUDFLARE_API_TOKEN=xxx bash etl/dump_db.sh [库名]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DB="${1:-lr-song}"
OUT="$ROOT/data/$DB.sqlite3"
TMP="$(mktemp -t lrsql.XXXXXX).sql"

echo "== 导出 D1 库 $DB → SQL"
( cd "$ROOT/api" && ./node_modules/.bin/wrangler d1 export "$DB" --remote --output="$TMP" )
echo "== SQL → SQLite"
rm -f "$OUT"
( echo "PRAGMA journal_mode=OFF;"; echo "PRAGMA synchronous=OFF;"; echo "BEGIN;"
  cat "$TMP"; echo "COMMIT;" ) | sqlite3 "$OUT"
rm -f "$TMP"
echo "== 完成：$OUT ($(du -h "$OUT" | cut -f1))"
for t in persons kinships offices entries works; do
  printf "   %-10s %s\n" "$t" "$(sqlite3 "$OUT" "SELECT COUNT(*) FROM $t")"
done
