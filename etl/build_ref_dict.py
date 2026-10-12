#!/usr/bin/env python3
"""补数据C36：参考词典 ref_dict（民族/学术主题/干支/度量/身份状态/地名异名）。

合并 CBDB 剩余小字典表为统一参考词典，供知识图谱的术语解释。
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS ref_dict")
    con.execute("""CREATE TABLE ref_dict(
        category TEXT, code TEXT, name TEXT, name_en TEXT, note TEXT)""")
    out = []

    # 民族/部落
    for row in con.execute("SELECT c_ethnicity_code, c_name_chn, c_name, c_notes FROM cbdb_ETHNICITY_TRIBE_CODES"):
        if not row[1]:
            continue
        out.append(('民族部落', str(row[0]), t2s.convert(row[1]), row[2] or '', (row[3] or '')[:400]))

    # 学术主题
    for row in con.execute("SELECT c_topic_code, c_topic_desc, c_topic_desc_chn FROM cbdb_SCHOLARLYTOPIC_CODES"):
        if not row[2]:
            continue
        out.append(('学术主题', str(row[0]), t2s.convert(row[2]), row[1] or '', ''))

    # 干支
    for row in con.execute("SELECT c_ganzhi_code, c_ganzhi_chn, c_ganzhi_py FROM cbdb_GANZHI_CODES"):
        if not row[1] or row[1].startswith('['):
            continue
        out.append(('干支', str(row[0]), t2s.convert(row[1]), row[2] or '', ''))

    # 度量
    for row in con.execute("SELECT c_measure_code, c_measure_desc_chn, c_measure_desc FROM cbdb_MEASURE_CODES"):
        if not row[1] or row[1].startswith('['):
            continue
        out.append(('度量', str(row[0]), t2s.convert(row[1]), row[2] or '', ''))

    # 身份状态（全表，供标签释义）
    for row in con.execute("SELECT c_status_code, c_status_desc, c_status_desc_chn FROM cbdb_STATUS_CODES"):
        if not row[2] or row[2].startswith('[') or row[2] == '未詳':
            continue
        out.append(('身份', str(row[0]), t2s.convert(row[2]), row[1] or '', ''))

    # 地名异名
    for row in con.execute("SELECT c_choronym_code, c_choronym_chn, c_choronym_desc FROM cbdb_CHORONYM_CODES"):
        if not row[1] or row[1].startswith('【'):
            continue
        out.append(('地名异名', str(row[0]), t2s.convert(row[1]), row[2] or '', ''))

    con.executemany("INSERT INTO ref_dict VALUES (?,?,?,?,?)", out)
    con.execute("CREATE INDEX idx_rd_cat ON ref_dict(category)")
    con.commit()
    print(f"✓ ref_dict: {len(out):,} 条")
    for r in con.execute("SELECT category,COUNT(*) FROM ref_dict GROUP BY 1 ORDER BY 2 DESC"):
        print(f"    {r[0]}: {r[1]}")
    con.close()


if __name__ == "__main__":
    main()
