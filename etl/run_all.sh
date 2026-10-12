#!/usr/bin/env bash
# CBDB → long-river 完整 ETL 流程。
# 前提：已下载 CBDB 库到 data/db/cbdb/cbdb_20261003.sqlite3（见 fetch.sh）。
# 用法：bash etl/run_all.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."
DB="data/db/lr-song.sqlite3"

echo "== 1/6 CBDB → persons/kinships/offices/entries/works"
python3 etl/build_from_cbdb.py

echo "== 2/6 组装完整 SQLite"
python3 etl/build_sqlite_full.py

echo "== 3/6 并入 CBDB 78 原始表（cbdb_ 前缀）"
python3 etl/import_cbdb_tables.py data/db/cbdb/cbdb_20261003.sqlite3 "$DB"

echo "== 4/6 Wikidata 扩充"
python3 etl/fetch_wikidata.py
python3 etl/merge_wikidata.py "$DB" data/build/wikidata_persons.jsonl

echo "== 5/6 公版史书全文入库"
python3 etl/import_texts.py "$DB"

echo "== 6/6 派生表（帝王/年号/版本/别名/证据）"
python3 etl/build_emperor.py
python3 etl/patch_emperor.py
python3 etl/build_nianhao.py && python3 etl/build_nianhao_map.py
python3 etl/build_hist_alias.py
python3 etl/link_figures.py

echo
echo "== 完成。数据源：$DB"
echo "   备份：bash etl/backup_db.sh"
