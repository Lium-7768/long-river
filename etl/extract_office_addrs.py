#!/usr/bin/env python3
"""任务F：提取任官地点表 office_addrs。

cbdb_POSTED_TO_ADDR_DATA：人物在某地任某职（46.5万）。
覆盖 24 万人 → 全新维度「在哪做官」。
"""
import sqlite3, os, re
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

# 噪声：未詳占位、朝代名、路名过于宽泛
NOISE = re.compile(r"^\[?未詳\]?$|^[唐宋元明清漢汉秦隋晉晋周郑陳陈]朝$|^宋$|^唐$|^元$|^明$|^清$")


def main():
    con = sqlite3.connect(DB)
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    addrs = {r[0]: t2s.convert((r[1] or '').strip()) for r in con.execute("SELECT c_addr_id,c_name_chn FROM cbdb_ADDR_CODES")}

    con.execute("DROP TABLE IF EXISTS office_addrs")
    con.execute("""CREATE TABLE office_addrs (
        person_id TEXT NOT NULL, office_id INTEGER, addr TEXT NOT NULL, source TEXT
    )""")
    batch = []
    for pid, oid, aid in con.execute("SELECT c_personid,c_office_id,c_addr_id FROM cbdb_POSTED_TO_ADDR_DATA"):
        iid = idmap.get(pid)
        if not iid:
            continue
        addr = addrs.get(aid)
        if not addr or NOISE.search(addr) or len(addr) > 12:
            continue
        batch.append((iid, oid, addr, "CBDB"))
    con.executemany("INSERT INTO office_addrs VALUES (?,?,?,?)", batch)
    con.execute("CREATE INDEX idx_oaddr_pid ON office_addrs(person_id)")
    con.execute("CREATE INDEX idx_oaddr_addr ON office_addrs(addr)")
    con.commit()
    print(f"✓ office_addrs: {len(batch):,}")
    for r in con.execute("SELECT person_id,addr FROM office_addrs LIMIT 5"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
