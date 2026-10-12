#!/usr/bin/env python3
"""补数据C14：人物别名全表（字/号/谥/行第/封爵/小名/赐号等）。

从 cbdb_ALTNAME_DATA（208,959）整合为 aliases(person_id, alias, type, type_desc, source)。
"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    codes = {r[0]: r[1] for r in con.execute("SELECT c_name_type_code,c_name_type_desc_chn FROM cbdb_ALTNAME_CODES")}
    # person map: cbdb c_personid → our id
    pids = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    con.execute("DROP TABLE IF EXISTS aliases")
    con.execute("""CREATE TABLE aliases (
        person_id TEXT, alias TEXT, type INTEGER, type_desc TEXT, source TEXT)""")
    rows = []
    for cpid, chn, tcode, seq in con.execute(
            "SELECT c_personid,c_alt_name_chn,c_alt_name_type_code,c_sequence FROM cbdb_ALTNAME_DATA "
            "WHERE c_alt_name_chn IS NOT NULL AND c_alt_name_chn<>''"):
        pid = pids.get(cpid)
        if not pid:
            continue
        rows.append((pid, chn, tcode, codes.get(tcode, ''), f'seq{seq}'))
    con.executemany("INSERT INTO aliases VALUES (?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_alias_pid ON aliases(person_id)")
    con.execute("CREATE INDEX idx_alias_name ON aliases(alias)")
    con.commit()
    print(f"✓ aliases: {len(rows):,}")
    for r in con.execute("SELECT type_desc,COUNT(*) FROM aliases GROUP BY 1 ORDER BY 2 DESC LIMIT 12"):
        print(f"  {r[0]}: {r[1]:,}")
    con.close()


if __name__ == "__main__":
    main()
