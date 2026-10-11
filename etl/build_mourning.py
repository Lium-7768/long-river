#!/usr/bin/env python3
"""补数据B1：五服丧服制度表 mourning。

源：cbdb_KIN_MOURNING(159) — 亲属关系 → 丧服等级
    兄弟→期年 / 姪女→小功 / 姪孙→小功 …（五服：斩衰/齐衰/大功/小功/缌麻）
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS mourning")
    con.execute("""CREATE TABLE mourning (
        rel TEXT, mourning TEXT, distance REAL, kin_type TEXT
    )""")
    rows = []
    seen = set()
    for rel, m, dist, kt in con.execute(
            "SELECT c_kinrel_chn,c_mourning_chn,c_kindist,c_kintype_desc_chn FROM cbdb_KIN_MOURNING"):
        r = t2s.convert((rel or '').strip())
        mo = t2s.convert((m or '').strip())
        k = t2s.convert((kt or '').strip())
        if not r or r in ('未详', '不详'):
            continue
        key = (r, mo)
        if key in seen:
            continue
        seen.add(key)
        rows.append((r, mo, dist, k))
    con.executemany("INSERT INTO mourning VALUES (?,?,?,?)", rows)
    con.commit()
    print(f"✓ mourning: {len(rows)}")
    for r in con.execute("SELECT rel,mourning,kin_type FROM mourning LIMIT 10"):
        print("  ", " | ".join(str(x) for x in r))
    con.close()


if __name__ == "__main__":
    main()
