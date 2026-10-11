#!/usr/bin/env python3
"""补数据C2+C4：科举补强 entries + 地理坐标 addr_geo。"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    c = sqlite3.connect(DB)
    c.execute("PRAGMA journal_mode=WAL")
    idmap = {r[0]: r[1] for r in c.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}

    # ---- C2: entries 补 exam_rank/exam_field/age/attempt ----
    cols = [r[1] for r in c.execute("PRAGMA table_info(entries)")]
    for col, typ in [("exam_rank", "INTEGER"), ("exam_field", "TEXT"),
                     ("age", "INTEGER"), ("attempt", "INTEGER"), ("inst", "TEXT")]:
        if col not in cols:
            c.execute(f"ALTER TABLE entries ADD COLUMN {col} {typ}")
    codes = {r[0]: t2s.convert((r[2] or '').strip()) for r in c.execute("SELECT c_entry_code,c_entry_desc,c_entry_desc_chn FROM cbdb_ENTRY_CODES")}
    n = 0
    for pid, ec, seq, rank, field, age, att, inst, yr in c.execute(
            """SELECT c_personid,c_entry_code,c_sequence,c_exam_rank,c_exam_field,c_age,
                      c_attempt_count,c_inst_code,c_year FROM cbdb_ENTRY_DATA"""):
        iid = idmap.get(pid)
        if not iid:
            continue
        fld = t2s.convert(str(field).strip()) if field and field != 0 else None
        if fld in ('', '0'):
            fld = None
        c.execute("""UPDATE entries SET exam_rank=COALESCE(exam_rank,?),exam_field=COALESCE(exam_field,?),
                     age=COALESCE(age,?),attempt=COALESCE(attempt,?)
                     WHERE person_id=? AND entry=?""",
                  (rank if rank and rank != 0 else None, fld,
                   age if age and age != 0 else None, att if att and att != 0 else None,
                   iid, codes.get(ec, '')))
        n += 1
    c.commit()
    for col in ["exam_rank", "exam_field", "age", "attempt"]:
        print(f"  entries.{col}: {c.execute(f'SELECT COUNT(*) FROM entries WHERE {col} IS NOT NULL').fetchone()[0]:,}")

    # ---- C4: addr_geo ----
    c.execute("DROP TABLE IF EXISTS addr_geo")
    c.execute("CREATE TABLE addr_geo (addr_id INTEGER, name TEXT, lon REAL, lat REAL, admin_type TEXT, first_year INTEGER, last_year INTEGER, modern TEXT, chgis TEXT)")
    rows = []
    for aid, nm, atype, fy, ly, x, y, chgis in c.execute(
            "SELECT c_addr_id,c_name_chn,c_admin_type,c_firstyear,c_lastyear,x_coord,y_coord,CHGIS_PT_ID FROM cbdb_ADDR_CODES"):
        if x in (None, 0) or y in (None, 0):
            continue
        rows.append((aid, t2s.convert((nm or '').strip()), x, y,
                     t2s.convert((atype or '').strip()) or None,
                     fy if fy and fy != 0 else None, ly if ly and ly != 0 else None, None, chgis))
    c.executemany("INSERT INTO addr_geo VALUES (?,?,?,?,?,?,?,?,?)", rows)
    c.commit()
    print(f"✓ addr_geo: {len(rows):,}")
    c.close()


if __name__ == "__main__":
    main()
