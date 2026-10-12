#!/usr/bin/env python3
"""补数据C35：人物著作关系 person_texts（含角色+年份）。

来源：CBDB BIOG_TEXT_DATA(50,786 有 personid) × TEXT_CODES(书名) × TEXT_ROLE_CODES(角色)。
比已有 works 表多出：编纂角色(撰著/编辑/编修/注疏) + 系年。
含大量女性著作（闺阁诗钞/闺秀词）。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    titles = {r[0]: r[1] for r in con.execute("SELECT c_textid, c_title_chn FROM cbdb_TEXT_CODES")}
    roles = {r[0]: r[1] for r in con.execute("SELECT c_role_id, c_role_desc_chn FROM cbdb_TEXT_ROLE_CODES")}
    con.execute("DROP TABLE IF EXISTS person_texts")
    con.execute("""CREATE TABLE person_texts(
        person_id TEXT, cbdb_id INTEGER, title TEXT, role TEXT, year INTEGER, source TEXT)""")
    out = []
    for pid, tid, role, year in con.execute(
        "SELECT c_personid, c_textid, c_role_id, c_year FROM cbdb_BIOG_TEXT_DATA WHERE c_personid>0"
    ):
        title = titles.get(tid)
        if not title or title in ('未知', '未詳'):
            continue
        role_chn = roles.get(role, '') or ''
        out.append((str(pid), pid, t2s.convert(title), t2s.convert(role_chn), year or 0, 'CBDB'))
    con.executemany("INSERT INTO person_texts VALUES (?,?,?,?,?,?)", out)
    con.execute("CREATE INDEX idx_pt_cbdb ON person_texts(cbdb_id)")
    con.execute("CREATE INDEX idx_pt_title ON person_texts(title)")
    con.commit()
    print(f"✓ person_texts: {len(out):,} 条 / {len({r[1] for r in out}):,} 人")
    print("  角色分布:")
    for r in con.execute("SELECT role,COUNT(*) FROM person_texts GROUP BY 1 ORDER BY 2 DESC LIMIT 8"):
        print(f"    {r[0] or '(无)'}: {r[1]}")
    con.close()


if __name__ == "__main__":
    main()
