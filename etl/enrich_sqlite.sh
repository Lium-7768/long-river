#!/usr/bin/env bash
# 在 lr-song.sqlite3 上补充 dynasty_id + fame_score
# 用法：bash etl/enrich_sqlite.sh [db路径]
set -e
DB="${1:-data/lr-song.sqlite3}"
echo "== 1. 拆分朝代 =="
python3 etl/split_dynasties.py "$DB"
echo
echo "== 2. 计算 fame_score =="
python3 etl/compute_fame.py "$DB"
echo
echo "== 3. 提取代表官职 =="
python3 etl/extract_top_office.py "$DB"
echo
echo "完成：$DB"
