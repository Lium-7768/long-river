#!/usr/bin/env bash
# SQLite → PostgreSQL 按朝代 4 分片迁移
# ------------------------------------------------------------
# 4 个分片：qing（清）/ ming（明）/ tangsong（唐宋）/ rest（其余）
# 每片 < 1 GB，可分别放进 Neon Free 项目。
#
# 前提：
#   pip install psycopg2-binary
#   cd server && pnpm add pg
#
# 用法（Neon：4 个独立项目）：
#   export DATABASE_URLS='{"qing":"postgresql://...","ming":"...","tangsong":"...","rest":"..."}'
#   bash etl/migrate_pg/migrate_shards.sh
#
# 用法（本机：4 个库）：
#   bash etl/migrate_pg/migrate_shards.sh --dsn 'postgresql://lr@127.0.0.1:55433/{db}'
#
# 幂等：可重复执行。
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."

if [ $# -gt 0 ]; then
  DSN_ARGS=("$@")
else
  : "${DATABASE_URLS:?请设置 DATABASE_URLS（4 个连接串的 JSON），或用 --dsn 传模板}"
  DSN_ARGS=()
fi

echo "== 1/3 建 schema + 导入 4 个分片（约 750 万行 × 复制比例，本地实测 ~200s）"
python3 etl/migrate_pg/import_shards.py "${DSN_ARGS[@]}"

echo "== 2/3 校验（行数/复制/抽样/路由/体积）"
python3 etl/migrate_pg/verify_shards.py

echo "== 3/3 完成。启动后端："
echo '   DATABASE_URLS="$DATABASE_URLS" node server/src/index.js'
echo "   回滚 SQLite：不设 DATABASE_URLS / DATABASE_URL 直接启动"
