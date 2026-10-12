#!/usr/bin/env python3
"""补数据C20：社会关系词典 + 人物关系网络汇总。

- assoc_dict: 484 种社会关系（code/名称/主动被动对/类别）
- person_network: 每人关系数汇总（出度/入度/类型数）
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # 关系词典
    con.execute("DROP TABLE IF EXISTS assoc_dict")
    con.execute("CREATE TABLE assoc_dict(rel_code INTEGER, rel_name TEXT, pair_code INTEGER, "
                "kind TEXT, cnt INTEGER)")
    codes = {}
    for code, pair, rel_chn, rel_eng, kind in con.execute(
            "SELECT c_assoc_code,c_assoc_pair,c_assoc_desc_chn,c_assoc_desc,c_assoc_role_type "
            "FROM cbdb_ASSOC_CODES"):
        codes[code] = (t2s.convert(rel_chn or ''), pair, kind)
    cnts = {r[0]: r[1] for r in con.execute("SELECT rel_code,COUNT(*) FROM assocs GROUP BY 1")}
    rows = [(code, codes.get(code, ('', 0, ''))[0], codes.get(code, ('', 0, ''))[1],
             codes.get(code, ('', 0, ''))[2], cnts.get(code, 0)) for code in cnts]
    con.executemany("INSERT INTO assoc_dict VALUES (?,?,?,?,?)", rows)
    con.commit()
    print(f"✓ assoc_dict: {len(rows)}")

    # 人物关系网络
    con.execute("DROP TABLE IF EXISTS person_network")
    con.execute("""CREATE TABLE person_network(person_id TEXT PRIMARY KEY,
        n_out INTEGER, n_in INTEGER, n_types INTEGER)""")
    con.execute("""INSERT INTO person_network(person_id,n_out,n_in,n_types)
        SELECT person_id,COUNT(*),0,COUNT(DISTINCT rel_code) FROM assocs GROUP BY person_id""")
    con.execute("""UPDATE person_network SET n_in=(
        SELECT COUNT(*) FROM assocs a WHERE a.assoc_id=person_network.person_id)""")
    con.commit()
    print("✓ person_network:", con.execute("SELECT COUNT(*) FROM person_network").fetchone()[0])
    for r in con.execute("SELECT p.name,n.n_out,n.n_in,n.n_types FROM person_network n "
                         "JOIN persons p ON p.id=n.person_id ORDER BY (n.n_out+n.n_in) DESC LIMIT 6"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
