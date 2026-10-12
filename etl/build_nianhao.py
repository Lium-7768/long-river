#!/usr/bin/env python3
"""补数据B2：年号对照表 nianhao + 还原缺失生卒年。

源：cbdb_NIAN_HAO(682) — 年号 → 公元（建元 -140~-135）
    cbdb_BIOG_MAIN.c_by_nh_code/c_by_nh_year（生年用年号）
    cbdb_BIOG_MAIN.c_dy_nh_code/c_dy_nh_year（卒年用年号）

逻辑：公元年 = 年号首年 + (年号年 - 1)
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # ---- 1. nianhao 表 ----
    con.execute("DROP TABLE IF EXISTS nianhao")
    con.execute("""CREATE TABLE nianhao (
        id INTEGER PRIMARY KEY, dynasty TEXT, name TEXT, start INTEGER, end INTEGER
    )""")
    rows = []
    for nid, dy, dyc, nm, fy, ly in con.execute(
            "SELECT c_nianhao_id,c_dy,c_dynasty_chn,c_nianhao_chn,c_firstyear,c_lastyear FROM cbdb_NIAN_HAO"):
        nn = t2s.convert((nm or '').strip())
        if not nn or nn in ('未詳', '未详'):
            continue
        rows.append((nid, t2s.convert((dyc or '').strip()), nn, fy, ly))
    con.executemany("INSERT INTO nianhao VALUES (?,?,?,?,?)", rows)
    print(f"✓ nianhao: {len(rows)}")

    # 年号首年映射
    nh_first = {}
    for nid, nm, fy in con.execute("SELECT c_nianhao_id,c_nianhao_chn,c_firstyear FROM cbdb_NIAN_HAO"):
        if fy is not None and fy != 0:
            nh_first[nid] = fy

    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}

    # ---- 2. 用年号还原缺失生卒 ----
    fixed_b = fixed_d = 0
    for pid, by, by_code, by_year, dy, dy_code, dy_year in con.execute(
            """SELECT c_personid,c_birthyear,c_by_nh_code,c_by_nh_year,
                      c_deathyear,c_dy_nh_code,c_dy_nh_year FROM cbdb_BIOG_MAIN"""):
        iid = idmap.get(pid)
        if not iid:
            continue
        # 生年
        if (not by or by == 0) and by_code and by_code != 0 and by_year and by_year > 0:
            fy = nh_first.get(by_code)
            if fy is not None:
                con.execute("UPDATE persons SET birth=? WHERE id=? AND (birth IS NULL OR birth=0)",
                            (fy + by_year - 1, iid))
                fixed_b += 1
        # 卒年
        if (not dy or dy == 0) and dy_code and dy_code != 0 and dy_year and dy_year > 0:
            fy = nh_first.get(dy_code)
            if fy is not None:
                con.execute("UPDATE persons SET death=? WHERE id=? AND (death IS NULL OR death=0)",
                            (fy + dy_year - 1, iid))
                fixed_d += 1
    con.commit()
    print(f"✓ 还原生年: {fixed_b}；还原卒年: {fixed_d}")
    print("生年总数:", con.execute("SELECT COUNT(*) FROM persons WHERE birth IS NOT NULL").fetchone()[0])
    print("卒年总数:", con.execute("SELECT COUNT(*) FROM persons WHERE death IS NOT NULL").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main()
