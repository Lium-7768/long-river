#!/usr/bin/env python3
"""补数据C28：从先秦典籍抽取人物（左传/国语/战国策）。

模式：X曰/X对曰/X谓/X谏，配合姓氏+称谓过滤，建 preqin_persons 表。
不直接并入 persons（避免污染），先落独立表，供人工复核/后续合并。
"""
import sqlite3, os, re
from opencc import OpenCC
from collections import Counter
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

STOP = {'君子', '不可', '此所', '此之', '于是', '是以', '是故', '鮑本', '鮑本補', '鮑本彪',
        '鮑本正', '索隱', '正義', '大事記', '公曰', '王曰', '對曰', '夫子', '寡人', '先生',
        '此其', '若此', '如此', '是以', '所謂', '何以', '不如', '何以', '雖然', '且夫',
        '管子對', '晏子對', '何以', '於此', '故曰', '孟子對', '孔子對', '莊子對', '或者',
        '或曰', '或謂', '是時', '當是', '其後', '其言', '其為', '此言', '此謂', '何為',
        '鲍本补','鲍本正','鲍本','索隐','正义','管子对','晏子对','孟子对','孔子对','莊子對',
        '太子','謂','对','谏','曰','王曰','公曰','子路對','子貢對','曾子對'}
# 称谓后缀（王/君/侯/子/公/大夫）为真人物
TITLE = re.compile(r'[\u4e00-\u9fa5](王|君|侯|公|子|伯|侯|氏)$')


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    names = Counter()
    for book in ('春秋左氏传', '国语', '战国策', '论语', '孟子'):
        for (content,) in con.execute("SELECT content FROM texts WHERE book=?", (book,)):
            txt = t2s.convert(content)
            for m in re.finditer(r'([\u4e00-\u9fa5]{2,4})(?:曰|對曰|对曰|謂|谏|谏)', txt):
                nm = m.group(1)
                if nm in STOP or len(nm) < 2:
                    continue
                if re.search(r'(本補|本彪|本正|索隱|正义|對|谓|諫)$', nm):
                    continue
                names[nm] += 1
    con.execute("DROP TABLE IF EXISTS preqin_persons")
    con.execute("CREATE TABLE preqin_persons(name TEXT PRIMARY KEY, n_mentions INTEGER, "
                "in_library INTEGER, sources TEXT)")
    lib = {r[0] for r in con.execute("SELECT name FROM persons")}
    rows = []
    for nm, cn in names.most_common(2000):
        if cn < 3:
            continue
        rows.append((nm, cn, 1 if nm in lib else 0, '左传/国语/战国策'))
    con.executemany("INSERT OR REPLACE INTO preqin_persons VALUES (?,?,?,?)", rows)
    con.commit()
    new = sum(1 for r in rows if not r[2])
    print(f"✓ preqin_persons: {len(rows)}（库中已有 {len(rows)-new}，新候选 {new}）")
    for r in con.execute("SELECT name,n_mentions FROM preqin_persons WHERE in_library=0 LIMIT 15"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
