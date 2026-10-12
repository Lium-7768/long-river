#!/usr/bin/env python3
"""全局检查A：补全 persons 缺失的 CBDB 字段 + works 角色/年份。

CBDB 有但被丢弃的字段：
  persons: 民族(c_ethnicity_code) 户籍(c_household_status_code) 享年(c_death_age)
           索引年(c_index_year) 索引地(c_index_addr_id)
  works:   角色(c_role_id) 年份(c_year)
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}

    # ---- 1. persons 新列 ----
    cols = [r[1] for r in con.execute("PRAGMA table_info(persons)")]
    for col, typ in [("ethnicity", "TEXT"), ("household", "TEXT"),
                     ("death_age", "INTEGER"), ("index_addr", "TEXT")]:
        if col not in cols:
            con.execute(f"ALTER TABLE persons ADD COLUMN {col} {typ}")
    print("✓ persons 加列: ethnicity/household/death_age/index_addr")

    eth = {r[0]: t2s.convert((r[4] or '').strip()) for r in
           con.execute("SELECT * FROM cbdb_ETHNICITY_TRIBE_CODES")}
    hh = {r[0]: t2s.convert((r[1] or '').strip()) for r in
          con.execute("SELECT * FROM cbdb_HOUSEHOLD_STATUS_CODES")}
    addr = {r[0]: t2s.convert((r[1] or '').strip()) for r in
            con.execute("SELECT c_addr_id,c_name_chn FROM cbdb_ADDR_CODES")}

    upd = []
    for pid, e, h, da, ia in con.execute(
            "SELECT c_personid,c_ethnicity_code,c_household_status_code,c_death_age,c_index_addr_id FROM cbdb_BIOG_MAIN"):
        iid = idmap.get(pid)
        if not iid:
            continue
        en = eth.get(e) if e and e != 0 else None
        hn = hh.get(h) if h and h != 0 else None
        an = addr.get(ia) if ia and ia != 0 else None
        if en in ('未知', '不详', ''):
            en = None
        if en or hn or (da and da != 0) or an:
            upd.append((en, hn, da if da and da != 0 else None, an, iid))
    con.executemany(
        "UPDATE persons SET ethnicity=?,household=?,death_age=?,index_addr=? WHERE id=?", upd)
    con.commit()
    for c in ["ethnicity", "household", "death_age", "index_addr"]:
        n = con.execute(f"SELECT COUNT(*) FROM persons WHERE {c} IS NOT NULL").fetchone()[0]
        print(f"  {c}: {n:,}")

    # ---- 2. works 角色/年份 ----
    wcols = [r[1] for r in con.execute("PRAGMA table_info(works)")]
    for col in ["role", "year"]:
        if col not in wcols:
            con.execute(f"ALTER TABLE works ADD COLUMN {col} TEXT")
    roles = {r[0]: t2s.convert((r[2] or '').strip()) for r in
             con.execute("SELECT * FROM cbdb_TEXT_ROLE_CODES")}
    # works 无唯一键，用 (person_id,title) 匹配 BIOG_TEXT_DATA 的 text→title
    texts = {r[0]: t2s.convert((r[1] or '').strip()) for r in
             con.execute("SELECT c_textid,c_title_chn FROM cbdb_TEXT_CODES")}
    wn = 0
    for pid, tid, rid, yr in con.execute(
            "SELECT c_personid,c_textid,c_role_id,c_year FROM cbdb_BIOG_TEXT_DATA"):
        iid = idmap.get(pid)
        title = texts.get(tid)
        if not iid or not title:
            continue
        rl = roles.get(rid) if rid and rid != 0 else None
        yy = yr if yr and yr != 0 else None
        if rl or yy:
            con.execute(
                "UPDATE works SET role=COALESCE(role,?), year=COALESCE(year,?) "
                "WHERE person_id=? AND title=?", (rl, yy, iid, title))
            wn += 1
    con.commit()
    for c in ["role", "year"]:
        n = con.execute(f"SELECT COUNT(*) FROM works WHERE {c} IS NOT NULL").fetchone()[0]
        print(f"  works.{c}: {n:,}")
    print(f"✓ 完成（works 尝试 {wn:,}）")
    con.close()


if __name__ == "__main__":
    main()
