#!/usr/bin/env python3
"""补数据C5：人物活动期 floruit + 生卒月日 + CBDB 备注 notes。"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cols = [r[1] for r in con.execute("PRAGMA table_info(persons)")]
    for col, typ in [("fl_first", "INTEGER"), ("fl_last", "INTEGER"),
                     ("birth_month", "INTEGER"), ("birth_day", "INTEGER"),
                     ("death_month", "INTEGER"), ("death_day", "INTEGER"),
                     ("bio_note", "TEXT")]:
        if col not in cols:
            con.execute(f"ALTER TABLE persons ADD COLUMN {col} {typ}")
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    upd = []
    for pid, fl, fl2, bm, bd, dm, dd, note in con.execute(
            """SELECT c_personid,c_fl_earliest_year,c_fl_latest_year,
                      c_by_month,c_by_day,c_dy_month,c_dy_day,c_notes FROM cbdb_BIOG_MAIN"""):
        iid = idmap.get(pid)
        if not iid:
            continue
        nt = (note or '').strip()
        vals = (fl if fl and fl != 0 else None, fl2 if fl2 and fl2 != 0 else None,
                bm if bm and bm != 0 else None, bd if bd and bd != 0 else None,
                dm if dm and dm != 0 else None, dd if dd and dd != 0 else None,
                nt[:500] if nt else None)
        if any(v is not None for v in vals):
            upd.append(vals + (iid,))
    con.executemany("""UPDATE persons SET fl_first=?,fl_last=?,birth_month=?,birth_day=?,
                       death_month=?,death_day=?,bio_note=? WHERE id=?""", upd)
    con.commit()
    for col in ["fl_first", "birth_month", "birth_day", "death_month", "bio_note"]:
        print(f"  persons.{col}: {con.execute(f'SELECT COUNT(*) FROM persons WHERE {col} IS NOT NULL').fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
