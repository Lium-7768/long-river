#!/usr/bin/env python3
"""
迁移校验：SQLite vs PostgreSQL 行数 + 内容抽样对比。

用法：
  export DATABASE_URL=postgresql://...
  python3 etl/migrate_pg/verify.py
"""
import os
import sqlite3
import sys

try:
    import psycopg2
except ImportError:
    sys.exit('需要 psycopg2：pip install psycopg2-binary')

DB = 'file:data/db/lr-song.sqlite3?mode=ro'
DSN = os.environ.get('DATABASE_URL')
if not DSN:
    sys.exit('缺少 DATABASE_URL')


def own_tables(con):
    return [
        r[0]
        for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'cbdb_%' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]


def main():
    scon = sqlite3.connect(DB, uri=True)
    pg = psycopg2.connect(DSN)
    cur = pg.cursor()
    tabs = own_tables(scon)

    print('== 1. 行数校验（57 表）')
    bad = []
    for t in tabs:
        a = scon.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        b = cur.fetchone()[0]
        if a != b:
            bad.append((t, a, b))
    if bad:
        for t, a, b in bad:
            print(f'   ✗ {t}: sqlite={a:,} pg={b:,}')
        sys.exit(f'✗ {len(bad)} 张表行数不一致')
    print('   ✓ 全部一致')

    print('== 2. 内容抽样校验')
    checks = [
        ('李白诗词数', 'SELECT COUNT(*) FROM poems WHERE author = ?', ('李白',)),
        ('陆游诗词数', 'SELECT COUNT(*) FROM poems WHERE author = ?', ('陆游',)),
        ('朱熹社会关系', 'SELECT COUNT(*) FROM assocs WHERE person_id = ?', ('zhuxi-3257',)),
        ('李白证据数', 'SELECT COUNT(*) FROM evid WHERE person_id = ?', ('libai-32540',)),
        ('唐代人数', 'SELECT COUNT(*) FROM persons WHERE dynasty_id = ?', ('tang',)),
        ('清代人数', 'SELECT COUNT(*) FROM persons WHERE dynasty_id = ?', ('qing',)),
        ('公元前人物', 'SELECT COUNT(*) FROM persons WHERE birth < 0', ()),
        ('诗词总句数', 'SELECT SUM(n_lines) FROM poems', ()),
        ('年号数', 'SELECT COUNT(*) FROM nianhao', ()),
        ('帝王数', 'SELECT COUNT(*) FROM emperor', ()),
        ('古籍数', 'SELECT COUNT(*) FROM texts', ()),
    ]
    ok = True
    for name, q, p in checks:
        a = scon.execute(q, p).fetchone()[0]
        cur.execute(q.replace('?', '%s'), p)
        b = cur.fetchone()[0]
        b = int(b) if b is not None else None
        same = a == b
        ok = ok and same
        print(f"   {'✓' if same else '✗'} {name:<12} sqlite={a}  pg={b}")

    print('== 3. 空串/NULL 语义（易错点）')
    for name, q in [
        ('poems.author 空串', "SELECT COUNT(*) FROM poems WHERE author = ''"),
        ('poems.author NULL', 'SELECT COUNT(*) FROM poems WHERE author IS NULL'),
        ('persons.summary 非空', "SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL AND summary <> ''"),
    ]:
        a = scon.execute(q).fetchone()[0]
        cur.execute(q.replace('?', '%s'))
        b = int(cur.fetchone()[0])
        same = a == b
        ok = ok and same
        print(f"   {'✓' if same else '✗'} {name:<20} sqlite={a}  pg={b}")

    print()
    print('✓ 校验全部通过' if ok else '✗ 存在差异，请检查')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
