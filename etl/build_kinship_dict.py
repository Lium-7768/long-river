#!/usr/bin/env python3
"""补数据C29：亲属关系归一化词典 kinship_dict。

443 种亲属称谓 → 归一化类别（直系长辈/直系晚辈/同辈/姻亲/其他）。
"""
import sqlite3, os, re
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

RULES = [
    ('直系长辈', ['父', '母', '祖', '考', '妣', '曾祖', '高祖', '太公']),
    ('直系晚辈', ['子', '女', '孙', '曾孙', '玄孙', '嗣', '继子', '螟蛉']),
    ('同辈', ['兄', '弟', '姐', '妹', '姊', '昆', '季', '伯', '叔', '兄']),
    ('配偶', ['妻', '夫', '妾', '继室', '元配', '正室', '侧室']),
    ('姻亲', ['岳', '婿', '姑', '舅', '姨', '甥', '侄', '姪', '嫂', '媳', '姻', '外祖']),
    ('旁系', ['从', '族', '堂', '表', '伯叔', '叔伯']),
]


def classify(rel):
    for cat, kws in RULES:
        for kw in kws:
            if kw in rel:
                return cat
    return '其他'


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS kinship_dict")
    con.execute("CREATE TABLE kinship_dict(rel TEXT PRIMARY KEY, category TEXT, n INTEGER)")
    rows = []
    for rel, n in con.execute("SELECT rel,COUNT(*) FROM kinships GROUP BY rel"):
        rows.append((rel, classify(rel), n))
    con.executemany("INSERT OR REPLACE INTO kinship_dict VALUES (?,?,?)", rows)
    con.commit()
    print(f"✓ kinship_dict: {len(rows)}")
    for r in con.execute("SELECT category,COUNT(*),SUM(n) FROM kinship_dict GROUP BY 1 ORDER BY 3 DESC"):
        print(f"  {r[0]}: {r[1]}种 / {r[2]:,}条")
    con.close()


if __name__ == "__main__":
    main()
