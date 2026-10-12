#!/usr/bin/env python3
"""补数据B6：著作分类 text_types + works.category（经史子集）。"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")

def main():
    c = sqlite3.connect(DB); c.execute("PRAGMA journal_mode=WAL")
    c.execute("DROP TABLE IF EXISTS text_types")
    c.execute("CREATE TABLE text_types(code TEXT PRIMARY KEY, name TEXT, level INTEGER, parent TEXT)")
    rows = [(str(code), t2s.convert((d or '').strip()), lvl, str(p) if p else None)
            for code, d, lvl, p in c.execute("SELECT c_text_type_code,c_text_type_desc_chn,c_text_type_level,c_text_type_parent_id FROM cbdb_TEXT_TYPE")]
    c.executemany("INSERT OR IGNORE INTO text_types VALUES (?,?,?,?)", rows)
    ttype = {tid: str(tp) for tid, tp in c.execute("SELECT c_textid,c_text_type_id FROM cbdb_TEXT_CODES WHERE c_text_type_id IS NOT NULL AND c_text_type_id<>''")}
    tyname = {r[0]: r[1] for r in c.execute("SELECT code,name FROM text_types")}
    titles = {}
    for tid, ttl in c.execute("SELECT c_textid,c_title_chn FROM cbdb_TEXT_CODES"):
        if tid in ttype:
            titles[t2s.convert((ttl or '').strip())] = ttype[tid]
    def topname(code):
        if code in tyname: return tyname[code]
        for k in range(len(code), 0, -1):
            if code[:k] in tyname: return tyname[code[:k]]
        return None
    upd = 0
    for pid, title in c.execute("SELECT person_id,title FROM works"):
        tp = titles.get(title)
        if tp:
            cat = topname(tp)
            if cat:
                c.execute("UPDATE works SET category=? WHERE person_id=? AND title=? AND (category IS NULL OR category='')", (cat, pid, title))
                upd += 1
    c.commit()
    print(f"✓ text_types {len(rows)} | works.category {upd}")
    c.close()

if __name__ == "__main__":
    main()
