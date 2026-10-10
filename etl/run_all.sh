#!/usr/bin/env bash
# CBDB → long-river 完整 ETL 流程。
# 前提：已跑 bash etl/fetch.sh 拿到 sqlite。
# 用法：bash etl/run_all.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."

echo "== 1/5 抽取 CBDB → build/*.jsonl"
python3 etl/build_from_cbdb.py

echo "== 2/5 与原型校核"
python3 etl/audit_against_prototype.py

echo "== 3/5 附加 CBDB 事实到原型人物"
python3 etl/integrate.py

echo "== 4/5 合并成完整人物库"
python3 etl/merge_dataset.py

echo "== 5/5 构建亲属关系表"
python3 etl/build_kinship.py

echo
echo "== 校验"
python3 etl/validate_merged.py
