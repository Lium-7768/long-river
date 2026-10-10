#!/usr/bin/env bash
# 拉取 CBDB SQLite dump。
# 用法: bash etl/fetch.sh
#
# 数据来源：https://github.com/cbdb-project/cbdb_sqlite （官方）
# 实际下载：HuggingFace dataset cbdb/cbdb-sqlite
# 许可：CBDB Data Licensing Terms（同 HuggingFace dataset 声明）
#
# 版本由 latest.json 决定；脚本会校验 SQLite 本体的 SHA-256。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$HERE/data"
mkdir -p "$DATA"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

echo "==> 获取 latest.json"
curl -s -A "$UA" -o "$DATA/latest.json" \
  "https://raw.githubusercontent.com/cbdb-project/cbdb_sqlite/master/latest.json"
cat "$DATA/latest.json"
echo

FN=$(python3 -c "import json;print(json.load(open('$DATA/latest.json'))['sqlite_filename'])")
SHA=$(python3 -c "import json;print(json.load(open('$DATA/latest.json'))['sha256'])")
URL=$(python3 -c "import json;print(json.load(open('$DATA/latest.json'))['huggingface_url'])")

if [ -f "$DATA/$FN" ]; then
  echo "==> 目标已存在: $DATA/$FN"
else
  echo "==> 下载 $URL"
  curl -sL -A "$UA" --max-time 900 -o "$DATA/cbdb.zip" "$URL"
  echo "==> 解压"
  unzip -o "$DATA/cbdb.zip" -d "$DATA" >/dev/null
  rm -f "$DATA/cbdb.zip"
fi

echo "==> 校验 SHA-256"
ACT=$(shasum -a 256 "$DATA/$FN" | awk '{print $1}')
if [ "$ACT" = "$SHA" ]; then
  echo "OK  $ACT"
else
  echo "MISMATCH  实际=$ACT  期望=$SHA" >&2
  exit 1
fi

echo "==> 完成: $DATA/$FN"
