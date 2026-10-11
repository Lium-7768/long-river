#!/usr/bin/env python3
"""任务A：把 cbdb_ASSOC_DATA（社会关系）提取进自有表 assocs。

社会关系：师友/荐举/同僚/门生/弹劾/姻亲等 498 种（ASSOC_CODES）。
只保留两端都在库内的人员记录。
"""
import sqlite3, os, sys
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    # 人员映射
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    # 关系码表（繁→简）
    codes = {}
    for code, desc in con.execute("SELECT c_assoc_code,c_assoc_desc_chn FROM cbdb_ASSOC_CODES"):
        codes[code] = t2s.convert(desc or "").strip() or None
    # 建表
    con.execute("DROP TABLE IF EXISTS assocs")
    con.execute("""CREATE TABLE assocs (
        person_id TEXT NOT NULL,
        assoc_id TEXT NOT NULL,
        rel_code INTEGER,
        rel_name TEXT,
        first_year INTEGER,
        source TEXT
    )""")
    n = 0
    batch = []
    for code, pid, aid, fy in con.execute(
            "SELECT c_assoc_code,c_personid,c_assoc_id,c_assoc_first_year FROM cbdb_ASSOC_DATA"):
        a, b = idmap.get(pid), idmap.get(aid)
        if not a or not b or a == b:
            continue
        rel = codes.get(code)
        yr = fy if (fy and fy != 0 and -3000 < fy < 2000) else None
        batch.append((a, b, code, rel, yr, "CBDB"))
        n += 1
    con.executemany("INSERT INTO assocs VALUES (?,?,?,?,?,?)", batch)
    con.execute("CREATE INDEX idx_assoc_pid ON assocs(person_id)")
    con.execute("CREATE INDEX idx_assoc_aid ON assocs(assoc_id)")
    con.commit()
    print(f"✓ assocs 提取: {n:,}")
    print(f"  样例:")
    for r in con.execute("SELECT person_id,assoc_id,rel_name FROM assocs LIMIT 5"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
