#!/usr/bin/env bash
# SQLite → PostgreSQL 一键迁移（长河 58 张自有表）
# ------------------------------------------------------------
# 前提：
#   1. PostgreSQL 可达（本地或在线服务），且已建好目标库
#   2. 已装 psycopg2：pip install psycopg2-binary
#   3. 后端已装 pg：cd server && pnpm add pg
#
# 用法：
#   export DATABASE_URL="postgresql://user:pass@host:5432/longriver"
#   bash etl/migrate_pg/migrate.sh
#
# 幂等：可重复执行（TRUNCATE + 重灌）。
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."

: "${DATABASE_URL:?请先设置 DATABASE_URL，例如 postgresql://user:pass@host:5432/longriver}"

echo "== 1/3 生成并执行 schema"
python3 etl/migrate_pg/convert_schema.py > /tmp/lr_pg_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /tmp/lr_pg_schema.sql
echo "   ✓ schema 就绪"

echo "== 2/3 导入数据（57 表，约 750 万行，本地 PG 实测 ~40-80s）"
python3 etl/migrate_pg/import_data.py

echo "== 3/3 校验（行数 + 内容抽样）"
python3 etl/migrate_pg/verify.py

echo
echo "== 完成。启动后端："
echo "   DATABASE_URL=\"$DATABASE_URL\" node server/src/index.js"
echo "   回滚 SQLite：不设 DATABASE_URL 直接启动即可"
