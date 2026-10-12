#!/usr/bin/env python3
"""补数据C40：人物合并记录 person_merge（CBDB 消歧依据）。

来源：CBDB MERGED_PERSON_DATA —— 记录 CBDB 判定「同一人」的合并及其理由，
是数据可信度的重要元数据（同名人物消歧的官方依据）。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS person_merge")
    con.execute("""CREATE TABLE person_merge(
        person_id INTEGER, merged_from INTEGER, note TEXT,
        name TEXT, merged_name TEXT, source TEXT)""")
    names = {r[0]: r[1] for r in con.execute("SELECT c_personid, c_name_chn FROM cbdb_BIOG_MAIN")}
    # 补主表可能不全，用 BIOG_MAIN 覆盖
    rows = []
    for pid, mfrom, note in con.execute(
        "SELECT c_personid, c_merged_from_personid, c_notes FROM cbdb_MERGED_PERSON_DATA"
    ):
        rows.append((pid, mfrom, t2s.convert(note or ''), names.get(pid, ''), names.get(mfrom, ''), 'CBDB'))
    con.executemany("INSERT INTO person_merge VALUES (?,?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_pm_pid ON person_merge(person_id)")
    con.commit()
    print(f"✓ person_merge: {len(rows):,} 条")
    for r in con.execute("SELECT name,merged_name,substr(note,1,40) FROM person_merge WHERE note<>'' LIMIT 5"):
        print(f"    {r[0]} ← {r[1]}：{r[2]}")
    con.close()


if __name__ == "__main__":
    main()
