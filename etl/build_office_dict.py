#!/usr/bin/env python3
"""补数据C15：官职词典 office_dict（名/拼音/英文/别名/朝代）。

从 cbdb_OFFICE_CODES（34,271）整合，首次为官职提供拼音+英文对照。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    dyn = {r[0]: r[1] for r in con.execute("SELECT c_dy,c_dynasty_chn FROM cbdb_DYNASTIES")} if \
        con.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='cbdb_DYNASTIES'").fetchone()[0] else {}
    con.execute("DROP TABLE IF EXISTS office_dict")
    con.execute("""CREATE TABLE office_dict (
        office_id INTEGER, name TEXT, name_alt TEXT, pinyin TEXT,
        trans TEXT, dynasty INTEGER, notes TEXT)""")
    rows = []
    for oid, dy, py, chn, pya, chna, tr, tra in con.execute(
            "SELECT c_office_id,c_dy,c_office_pinyin,c_office_chn,c_office_pinyin_alt,"
            "c_office_chn_alt,c_office_trans,c_office_trans_alt FROM cbdb_OFFICE_CODES"):
        if not chn:
            continue
        rows.append((oid, t2s.convert(chn), t2s.convert(chna or ''), py or '', tr or '', dy,
                     t2s.convert(tra or '')))
    con.executemany("INSERT INTO office_dict VALUES (?,?,?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_od_name ON office_dict(name)")
    con.execute("CREATE INDEX idx_od_id ON office_dict(office_id)")
    con.commit()
    print(f"✓ office_dict: {len(rows):,}")
    for r in con.execute("SELECT name,pinyin,trans FROM office_dict WHERE trans<>'' LIMIT 8"):
        print("  ", " | ".join(r))
    con.close()


if __name__ == "__main__":
    main()
