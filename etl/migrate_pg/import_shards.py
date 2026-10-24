#!/usr/bin/env python3
"""
按朝代 4 分片导入 PostgreSQL。

用法：
  python3 etl/migrate_pg/import_shards.py \
    --dsn 'postgresql://lr@127.0.0.1:55433/{db}'

`{db}` 会被替换为每个分片的库名（lr_qing / lr_ming / lr_tangsong / lr_rest）。

分类规则见 shards.py：
  - 复制表   ：persons / poems / texts / 全部小表 → 每片一份
  - 分片表   ：evid / kinships / offices / ... → 按人物朝代切分
  - poems    ：按 poem_dynasty 切分
  - person_poems：派生表（poem_persons ⋈ poems），物化到人物所在分片
"""
import csv
import io
import os
import sqlite3
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import psycopg2
except ImportError:
    sys.exit('需要 psycopg2：pip install psycopg2-binary')

from convert_schema import DB, convert, pg_type, own_tables          # noqa: E402
from import_data import BATCH, coerce, identity_col, pg_cols          # noqa: E402
from shards import (DERIVED, PRIMARY_DYNASTIES, SHARD_BY_COLUMN,      # noqa: E402
                    SHARD_BY_DYNASTY_COL, SHARD_BY_PERSON,
                    SHARD_BY_POEM_DYNASTY, SHARD_NAMES, SHARDS,
                    SINGLE_SHARD, dynasty_filter_sql)

PG_SCHEMA_EXTRA = """
-- 派生表：人物诗词（poem_persons ⋈ poems 的物化结果）
-- 目的：人物详情页的诗词列表变成本地查询，避免跨分片 JOIN
CREATE TABLE IF NOT EXISTS person_poems (
  person_id text NOT NULL,
  poem_id   bigint NOT NULL,
  title     text,
  genre     text,
  n_lines   bigint,
  excerpt   text,
  PRIMARY KEY (person_id, poem_id)
);
CREATE INDEX IF NOT EXISTS idx_person_poems_pid
  ON person_poems (person_id, n_lines DESC, poem_id);
"""


def copy_rows(pg, table, cols, types, rows):
    """流式 COPY；NULL 用 \\N 哨兵，真空字符串保留"""
    collist = ', '.join(f'"{c}"' for c in cols)
    cur = pg.cursor()
    cur.execute(f'TRUNCATE TABLE "{table}"')
    total = 0
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    n = 0

    def flush():
        nonlocal buf, writer, n, total
        if not n:
            return
        data = buf.getvalue()
        cnt = n
        buf = io.StringIO()
        n = 0
        cur.copy_expert(
            f'COPY "{table}" ({collist}) FROM STDIN WITH (FORMAT csv, NULL \'\\N\')',
            io.StringIO(data),
        )
        writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
        total += cnt

    for row in rows:
        out = []
        for v, ty in zip(row, types):
            v = coerce(v, ty)
            if v is None:
                out.append('\\N')
            elif isinstance(v, int):
                out.append(str(v))
            elif isinstance(v, float):
                out.append(repr(v))
            else:
                out.append(str(v).replace('\x00', ''))
        writer.writerow(out)
        n += 1
        if n >= BATCH:
            flush()
    flush()
    pg.commit()
    cur.close()
    return total


def import_table(pg, scon, t, where=None, params=()):
    cols = pg_cols(scon, t)
    types = [pg_type(ct, t, nm)
             for _, nm, ct, *_ in scon.execute(f'PRAGMA table_info("{t}")')]
    collist = ', '.join(f'"{c}"' for c in cols)
    sql = f'SELECT {collist} FROM "{t}"'
    if where:
        sql += f' WHERE {where}'
    n = copy_rows(pg, t, cols, types, scon.execute(sql, params))
    ident = identity_col(scon, t)
    if ident:
        cur = pg.cursor()
        cur.execute(
            f"SELECT setval(pg_get_serial_sequence('{t}', '{ident}'), "
            f"COALESCE((SELECT MAX(\"{ident}\") FROM \"{t}\"), 0) + 1, false)")
        pg.commit()
        cur.close()
    return n


def import_person_poems(pg, scon, shard):
    """物化 person_poems：只取该分片人物的诗词"""
    ds = SHARDS[shard]
    if ds is None:
        ph = ','.join('?' * len(PRIMARY_DYNASTIES))
        flt = f'(dynasty_id IS NULL OR dynasty_id NOT IN ({ph}))'
        params = list(PRIMARY_DYNASTIES)
    else:
        ph = ','.join('?' * len(ds))
        flt = f'dynasty_id IN ({ph})'
        params = list(ds)
    sql = f"""
        SELECT pp.person_id, p.id, p.title, p.genre, p.n_lines,
               substr(p.content, 1, 120)
        FROM poem_persons pp JOIN poems p ON p.id = pp.poem_id
        WHERE pp.person_id IN (SELECT id FROM persons WHERE {flt})
    """
    cols = ['person_id', 'poem_id', 'title', 'genre', 'n_lines', 'excerpt']
    types = ['text', 'bigint', 'text', 'text', 'bigint', 'text']
    return copy_rows(pg, 'person_poems', cols, types, scon.execute(sql, params))


def shard_filter(shard, t):
    """返回 (where, params)；None 表示整表复制"""
    if t in SINGLE_SHARD:
        # 只在指定分片导入，其余分片跳过（返回 None 表示由调用方跳过）
        return ('__SKIP__', ()) if SINGLE_SHARD[t] != shard else (None, ())
    if t in SHARD_BY_PERSON:
        f, p = dynasty_filter_sql(shard)
        return f'person_id IN (SELECT id FROM persons WHERE {f})', p
    if t in SHARD_BY_COLUMN:
        col = SHARD_BY_COLUMN[t]
        f, p = dynasty_filter_sql(shard)
        return f'{col} IN (SELECT id FROM persons WHERE {f})', p
    if t in SHARD_BY_DYNASTY_COL:
        col = SHARD_BY_DYNASTY_COL[t]
        return dynasty_filter_sql(shard, col)
    if t in SHARD_BY_POEM_DYNASTY:
        return dynasty_filter_sql(shard, 'poem_dynasty')
    return None, ()


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--dsn',
                    help='含 {db} 占位符，例如 postgresql://lr@127.0.0.1:55433/{db}（本地单机 4 库）')
    ap.add_argument('--dsns',
                    help='4 个独立连接串：JSON {"qing":..,"ming":..,"tangsong":..,"rest":..}'
                         ' 或逗号分隔；也可用环境变量 DATABASE_URLS（Neon 4 个项目用这个）')
    ap.add_argument('--shard', action='append', help='只导指定分片（可多次）')
    args = ap.parse_args()

    # 解析目标连接串：--dsns / 环境变量 DATABASE_URLS（Neon）优先，其次 --dsn 模板（本地）
    per_shard = {}
    spec = args.dsns or os.environ.get('DATABASE_URLS') or ''
    spec = spec.strip()
    if spec:
        if spec.startswith('{'):
            import json
            per_shard = json.loads(spec)
        else:
            parts = [x.strip() for x in spec.split(',') if x.strip()]
            if len(parts) != len(SHARD_NAMES):
                sys.exit(f'DATABASE_URLS 需要 {len(SHARD_NAMES)} 个连接串')
            per_shard = dict(zip(SHARD_NAMES, parts))
    elif not args.dsn:
        sys.exit('需要 --dsn 模板，或 --dsns / DATABASE_URLS 指定 4 个连接串')

    def dsn_of(shard):
        if per_shard:
            if shard not in per_shard:
                sys.exit(f'缺少分片 {shard} 的连接串')
            return per_shard[shard]
        return args.dsn.replace('{db}', f'lr_{shard}')

    scon = sqlite3.connect(DB, uri=True)
    tables = [t for t in own_tables(scon) if t not in DERIVED]

    targets = args.shard or SHARD_NAMES
    grand = time.time()
    for shard in targets:
        dsn = dsn_of(shard)
        print(f'\n═══ 分片 {shard}  →  {dsn.rsplit("/", 1)[-1]}')
        pg = psycopg2.connect(dsn)
        cur = pg.cursor()
        cur.execute(convert() + PG_SCHEMA_EXTRA)
        pg.commit()
        cur.close()
        print('  schema ✓')

        t0 = time.time()
        total = 0
        for t in tables:
            where, params = shard_filter(shard, t)
            if where == '__SKIP__':
                continue
            n = import_table(pg, scon, t, where, params)
            total += n
        cur = pg.cursor()
        cur.execute('ANALYZE')
        pg.commit()
        cur.execute('SELECT pg_size_pretty(pg_database_size(current_database()))')
        size = cur.fetchone()[0]
        cur.close()
        pg.close()
        print(f'  ── 合计 {total:,} 行 · {time.time()-t0:.0f}s · 库体积 {size}')

    print(f'\n== 全部完成，耗时 {time.time()-grand:.0f}s')


if __name__ == '__main__':
    main()
