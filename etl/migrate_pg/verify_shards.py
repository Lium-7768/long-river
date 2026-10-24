#!/usr/bin/env python3
"""
分片校验：SQLite 源库 vs 4 个 PostgreSQL 分片。

检查不变量：
  1. 分片表：4 片行数之和 == 源库行数
  2. 复制表：每片行数 == 源库行数
  3. 内容抽样：关键人物/诗词数据一致
  4. 路由抽查：人物 evidence 落在应属分片
  5. 分片体积：是否在 Neon Free 1 GB 以内

用法：
  export DATABASE_URLS='{"qing":"...","ming":"...","tangsong":"...","rest":"..."}'
  python3 etl/migrate_pg/verify_shards.py
"""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import psycopg2
except ImportError:
    sys.exit('需要 psycopg2：pip install psycopg2-binary')

from convert_schema import DB, own_tables
from shards import (DERIVED, SHARD_BY_COLUMN, SHARD_BY_DYNASTY_COL,
                    SHARD_BY_PERSON, SHARD_NAMES, SINGLE_SHARD,
                    shard_of_dynasty)

SHARDED = set(SHARD_BY_PERSON) | set(SHARD_BY_COLUMN) | set(SHARD_BY_DYNASTY_COL)

CHECKS = [
    ('李白诗词数', "SELECT COUNT(*) FROM poems WHERE author='李白'"),
    ('陆游诗词数', "SELECT COUNT(*) FROM poems WHERE author='陆游'"),
    ('朱熹社会关系', "SELECT COUNT(*) FROM assocs WHERE person_id='zhuxi-3257'"),
    ('李白证据数', "SELECT COUNT(*) FROM evid WHERE person_id='libai-32540'"),
    ('马国翰证据数', "SELECT COUNT(*) FROM evid WHERE person_id='maguo-65773'"),
    ('唐代人数', "SELECT COUNT(*) FROM persons WHERE dynasty_id='tang'"),
    ('清代人数', "SELECT COUNT(*) FROM persons WHERE dynasty_id='qing'"),
    ('明代人数', "SELECT COUNT(*) FROM persons WHERE dynasty_id='ming'"),
    ('诗词总句数', "SELECT SUM(n_lines) FROM poems"),
    ('年号数', "SELECT COUNT(*) FROM nianhao"),
    ('古籍数', "SELECT COUNT(*) FROM texts"),
]

ROUTE_SAMPLES = ('libai-32540', 'maguo-65773', 'yangshen-34657', 'zhoumi-10183')


def load_dsns():
    spec = (os.environ.get('DATABASE_URLS') or '').strip()
    if not spec:
        sys.exit('缺少 DATABASE_URLS')
    if spec.startswith('{'):
        import json
        return json.loads(spec)
    parts = [x.strip() for x in spec.split(',') if x.strip()]
    if len(parts) != len(SHARD_NAMES):
        sys.exit('DATABASE_URLS 需要 %d 个连接串' % len(SHARD_NAMES))
    return dict(zip(SHARD_NAMES, parts))


def main():
    dsns = load_dsns()
    scon = sqlite3.connect(DB, uri=True)
    pgs = {s: psycopg2.connect(dsns[s]) for s in SHARD_NAMES}
    curs = {s: pgs[s].cursor() for s in SHARD_NAMES}
    fails = []

    def one(shard, sql, params=()):
        curs[shard].execute(sql, params)
        v = curs[shard].fetchone()[0]
        return int(v) if v is not None else 0

    def count(shard, table):
        return one(shard, 'SELECT COUNT(*) FROM "' + table + '"')

    tables = [t for t in own_tables(scon) if t not in DERIVED]

    print('== 1. 分片表（4 片之和 == 源库）')
    for t in tables:
        if t in SINGLE_SHARD or t not in SHARDED:
            continue
        src = scon.execute('SELECT COUNT(*) FROM "' + t + '"').fetchone()[0]
        parts = [count(s, t) for s in SHARD_NAMES]
        ok = src == sum(parts)
        if not ok:
            fails.append('%s: 源 %s vs 分片和 %s' % (t, src, sum(parts)))
        detail = ' + '.join('{:,}'.format(x) for x in parts)
        print('   {} {:<20} {:>9,}  =  {}'.format('✓' if ok else '✗', t, src, detail))

    print('== 2. 复制表（每片 == 源库）')
    for t in tables:
        if t in SHARDED:
            continue
        src = scon.execute('SELECT COUNT(*) FROM "' + t + '"').fetchone()[0]
        counts = [count(s, t) for s in SHARD_NAMES]
        if t in SINGLE_SHARD:
            host = SHARD_NAMES.index(SINGLE_SHARD[t])
            ok = counts[host] == src and all(
                c == 0 for i, c in enumerate(counts) if i != host)
        else:
            ok = all(c == src for c in counts)
        if not ok:
            fails.append('%s: 源 %s vs 分片 %s' % (t, src, counts))
        print('   {} {:<20} {:>9,}   分片 {}'.format('✓' if ok else '✗', t, src, counts))

    print('== 3. 内容抽样')
    for name, sql in CHECKS:
        src = scon.execute(sql).fetchone()[0] or 0
        table = sql.split('FROM ')[1].split()[0]
        if table in SHARDED:
            val = sum(one(s, sql) for s in SHARD_NAMES)
        else:
            host = SINGLE_SHARD.get(table) or SHARD_NAMES[0]
            val = one(host, sql)
        ok = int(src) == int(val)
        if not ok:
            fails.append('%s: 源 %s vs PG %s' % (name, src, val))
        print('   {} {:<14} 源 {:>9,}   PG {:>9,}'.format(
            '✓' if ok else '✗', name, src, val))

    print('== 4. 路由抽查（人物 evidence 落在应属分片）')
    for pid in ROUTE_SAMPLES:
        row = scon.execute('SELECT dynasty_id FROM persons WHERE id=?', (pid,)).fetchone()
        dyn = row[0] if row else None
        expect = shard_of_dynasty(dyn)
        src = scon.execute(
            'SELECT COUNT(*) FROM evid WHERE person_id=?', (pid,)).fetchone()[0]
        got = {s: one(s, 'SELECT COUNT(*) FROM evid WHERE person_id=%s', (pid,))
               for s in SHARD_NAMES}
        ok = got[expect] == src and sum(got.values()) == src
        if not ok:
            fails.append('%s: 期望 %s=%s，实际 %s' % (pid, expect, src, got))
        print('   {} {:<16} {:<10} -> {:<9} evid={}'.format(
            '✓' if ok else '✗', pid, str(dyn), expect, src))

    print('== 5. 分片体积（Neon Free 上限 1024 MB）')
    for s in SHARD_NAMES:
        curs[s].execute('SELECT pg_database_size(current_database())')
        mb = curs[s].fetchone()[0] / 1048576
        ok = mb < 1024
        if not ok:
            fails.append('%s 体积 %.0f MB 超 1 GB' % (s, mb))
        print('   {} {:<10} {:7.0f} MB  (余 {:.0f} MB)'.format(
            '✓' if ok else '✗', s, mb, 1024 - mb))

    print()
    if fails:
        for f in fails:
            print('  ✗ ' + f)
        sys.exit('✗ %d 项不一致' % len(fails))
    print('✓ 全部校验通过')


if __name__ == '__main__':
    main()
