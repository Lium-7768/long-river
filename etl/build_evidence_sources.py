#!/usr/bin/env python3
"""补数据C37：史料来源汇总 evidence_sources。

汇总 evid 引用的所有史料来源，统计其覆盖的人物/条目数，
并标注哪些已收录全文（texts 表）、哪些可补。
"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS evidence_sources")
    con.execute("""CREATE TABLE evidence_sources(
        book TEXT PRIMARY KEY, n_claims INTEGER, n_persons INTEGER, claim_types TEXT,
        in_texts INTEGER, category TEXT)""")
    # 全文库已收古籍
    have = {r[0] for r in con.execute("SELECT DISTINCT book FROM texts")}
    rows = []
    for book, n, nppl, types in con.execute(
        "SELECT src_book, COUNT(*), COUNT(DISTINCT person_id), GROUP_CONCAT(DISTINCT claim_type) "
        "FROM evid WHERE src_book IS NOT NULL AND src_book<>'' GROUP BY src_book"
    ):
        cat = '档案索引'
        for kw, c in [('志', '地方志'), ('墓志', '墓志'), ('题名', '科举录'), ('索引', '人物索引'),
                      ('Wikidata', '外部库'), ('Wikipedia', '外部库'), ('ctext', '外部库'),
                      ('数据库', '外部库'), ('资料库', '外部库'), ('Pers DB', '外部库')]:
            if kw in book:
                cat = c
                break
        rows.append((book, n, nppl, types or '', 1 if book in have else 0, cat))
    con.executemany("INSERT OR REPLACE INTO evidence_sources VALUES (?,?,?,?,?,?)", rows)
    con.commit()
    print(f"✓ evidence_sources: {len(rows)} 个来源")
    for r in con.execute("SELECT category,COUNT(*),SUM(n_claims) FROM evidence_sources GROUP BY 1 ORDER BY 3 DESC"):
        print(f"    {r[0]}: {r[1]} 源 / {r[2]:,} 条")
    con.close()


if __name__ == "__main__":
    main()
