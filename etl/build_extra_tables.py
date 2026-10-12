#!/usr/bin/env python3
"""补数据B3+B4+B5：editions(版本) + person_notes(消歧) + possessions(财产) + addr_belongs(政区)。"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}

    # ---- B3: editions 著作版本 ----
    con.execute("DROP TABLE IF EXISTS editions")
    con.execute("""CREATE TABLE editions (
        text_id INTEGER, title TEXT, publisher TEXT, pub_year INTEGER,
        pub_loc TEXT, print TEXT, extant TEXT, notes TEXT, source TEXT
    )""")
    rows = []
    for tid, ttl, pub, py, loc, prt, notes in con.execute(
            """SELECT c_textid,c_instance_title_chn,c_publisher,c_pub_year,
                      c_pub_loc,c_print,c_pub_notes FROM cbdb_TEXT_INSTANCE_DATA"""):
        t = t2s.convert((ttl or '').strip())
        if not t:
            continue
        rows.append((tid, t, (pub or '').strip() or None, py if py and py != 0 else None,
                     t2s.convert((loc or '').strip()) or None, (prt or '').strip() or None,
                     None, (notes or '').strip()[:200] or None, None))
    con.executemany("INSERT INTO editions VALUES (?,?,?,?,?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_ed_tid ON editions(text_id)")
    print(f"✓ editions: {len(rows)}")

    # ---- B4a: person_notes 消歧备注 ----
    con.execute("DROP TABLE IF EXISTS person_notes")
    con.execute("CREATE TABLE person_notes (person_id TEXT, kind TEXT, note TEXT)")
    books = {r[0]: t2s.convert((r[1] or '').strip()) for r in con.execute("SELECT c_textid,c_title_chn FROM cbdb_TEXT_CODES")}
    rows = []
    for pid, mfrom, notes, src in con.execute(
            "SELECT c_personid,c_merged_from_personid,c_notes,c_source FROM cbdb_MERGED_PERSON_DATA"):
        iid = idmap.get(pid)
        if not iid:
            continue
        nt = (notes or '').strip()
        if not nt:
            continue
        bk = books.get(src)
        if bk:
            nt = f"{nt}（出处：{bk}）"
        rows.append((iid, 'disambiguation', nt[:400]))
    con.executemany("INSERT INTO person_notes VALUES (?,?,?)", rows)
    con.execute("CREATE INDEX idx_pn_pid ON person_notes(person_id)")
    print(f"✓ person_notes: {len(rows)}")

    # ---- B4b: possessions 财产 ----
    con.execute("DROP TABLE IF EXISTS possessions")
    con.execute("CREATE TABLE possessions (person_id TEXT, desc TEXT, quantity REAL, year INTEGER)")
    rows = []
    for pid, desc, qty, yr in con.execute(
            "SELECT c_personid,c_possession_desc_chn,c_quantity,c_possession_yr FROM cbdb_POSSESSION_DATA"):
        iid = idmap.get(pid)
        d = t2s.convert((desc or '').strip())
        if not iid or not d:
            continue
        rows.append((iid, d, qty if qty else None, yr if yr and yr != 0 else None))
    con.executemany("INSERT INTO possessions VALUES (?,?,?,?)", rows)
    print(f"✓ possessions: {len(rows)}")

    # ---- B5: addr_belongs 政区沿革 ----
    con.execute("DROP TABLE IF EXISTS addr_belongs")
    con.execute("""CREATE TABLE addr_belongs (
        addr_id INTEGER, belongs_to INTEGER, first_year INTEGER, last_year INTEGER,
        source TEXT, pages TEXT
    )""")
    rows = []
    for a, b, fy, ly, src, pg in con.execute(
            "SELECT c_addr_id,c_belongs_to,c_firstyear,c_lastyear,c_source,c_pages FROM cbdb_ADDR_BELONGS_DATA"):
        rows.append((a, b, fy if fy and fy != 0 else None, ly if ly and ly != 0 else None, src, pg))
    con.executemany("INSERT INTO addr_belongs VALUES (?,?,?,?,?,?)", rows)
    print(f"✓ addr_belongs: {len(rows)}")

    con.commit()
    con.close()


if __name__ == "__main__":
    main()
