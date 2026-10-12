#!/usr/bin/env python3
"""补数据C34：人物身份/技能标签 person_status。

来源：CBDB STATUS_DATA(73,619) × STATUS_CODES(285)，含时间区间。
覆盖：诗人/画家/孝子/僧人/书法家/理学家/武将/财政官员/隐士 等身份标签。
之前仅从 Wikidata 拿到 9,966 职业，此表大幅补充。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS person_status")
    con.execute("""CREATE TABLE person_status(
        person_id TEXT, status TEXT, status_en TEXT,
        fy INTEGER, ly INTEGER, source TEXT)""")
    rows = []
    for pid, code, fy, ly in con.execute(
        "SELECT c_personid, c_status_code, c_firstyear, c_lastyear FROM cbdb_STATUS_DATA"
    ):
        con.execute("SELECT 1")  # no-op
        rows.append((pid, code, fy, ly))
    codes = {r[0]: (r[1], r[2]) for r in con.execute(
        "SELECT c_status_code, c_status_desc_chn, c_status_desc FROM cbdb_STATUS_CODES")}
    out = []
    for pid, code, fy, ly in rows:
        chn, en = codes.get(code, (None, None))
        if not chn or chn.startswith('[') or chn in ('未詳', 'Missing Data'):
            continue
        out.append((str(pid), t2s.convert(chn), en or '', fy or 0, ly or 0, 'CBDB'))
    con.executemany("INSERT INTO person_status VALUES (?,?,?,?,?,?)", out)
    con.execute("CREATE INDEX idx_ps_pid ON person_status(person_id)")
    con.execute("CREATE INDEX idx_ps_status ON person_status(status)")
    con.commit()
    print(f"✓ person_status: {len(out):,} 条 / {len({r[0] for r in out}):,} 人")
    print("  标签 TOP:")
    for r in con.execute("SELECT status,COUNT(*) FROM person_status GROUP BY 1 ORDER BY 2 DESC LIMIT 15"):
        print(f"    {r[0]}: {r[1]}")
    con.close()


if __name__ == "__main__":
    main()
