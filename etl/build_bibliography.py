#!/usr/bin/env python3
"""补数据C18：书目表 bibliography（62,381 种古籍书目）。

从 cbdb_TEXT_CODES 整合：书名/拼音/英译/成书年/类型/分类。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    types = {}
    if con.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='cbdb_TEXT_BIBLCAT_CODES'").fetchone()[0]:
        for r in con.execute("SELECT * FROM cbdb_TEXT_BIBLCAT_CODES LIMIT 100"):
            pass
    con.execute("DROP TABLE IF EXISTS bibliography")
    con.execute("""CREATE TABLE bibliography (
        text_id INTEGER, title TEXT, title_pinyin TEXT, title_trans TEXT,
        text_year INTEGER, nianhao TEXT, nh_year INTEGER, category TEXT)""")
    rows = []
    for tid, chn, py, tr, ty, yr, nhc, nhy, cat in con.execute(
            "SELECT c_textid,c_title_chn,c_title,c_title_trans,c_text_type_id,"
            "c_text_year,c_text_nh_code,c_text_nh_year,c_bibl_cat_code FROM cbdb_TEXT_CODES"):
        if not chn:
            continue
        rows.append((tid, t2s.convert(chn), py or '', tr or '', yr or None,
                     str(nhc or ''), nhy or None, str(cat or '')))
    con.executemany("INSERT INTO bibliography VALUES (?,?,?,?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_bib_title ON bibliography(title)")
    con.execute("CREATE INDEX idx_bib_id ON bibliography(text_id)")
    con.commit()
    print(f"✓ bibliography: {len(rows):,}")
    for r in con.execute("SELECT title,text_year FROM bibliography WHERE text_year>0 ORDER BY RANDOM() LIMIT 6"):
        print("  ", " | ".join(str(x) for x in r))
    con.close()


if __name__ == "__main__":
    main()
