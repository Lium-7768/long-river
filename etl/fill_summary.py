#!/usr/bin/env python3
"""任务B(v2)：从正史 texts 补全事迹（summary）—— 倒排索引法。

思路（避免 O(人数 × 全书)）：
1. 只扫一遍正史 texts，用正则一次性捞出所有传记起首：「XX(者)?，...人也」/「XX，字YY，...」
2. 建立 人名 → (朝代, 事迹首句, 出处) 映射
3. 对 summary 为空的库内人物，按名查表填充（O(1)）
"""
import sqlite3, re, os
from collections import defaultdict
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

BOOK_DY = {
    "史记": None, "汉书": "han-w", "后汉书": "han-e", "三国志": "sanguo",
    "晋书": "jin", "宋书": "nanbei", "南齐书": "nanbei", "梁书": "nanbei",
    "陈书": "nanbei", "魏书": "nanbei", "北齐书": "nanbei", "周书": "nanbei",
    "隋书": "sui", "南史": "nanbei", "北史": "nanbei",
    "旧唐书": "tang", "新唐书": "tang", "宋史": "song-w", "辽史": "liao",
    "金史": "jin-chao", "元史": "yuan", "明史": "ming", "清史稿": "qing",
    "新五代史": "wudai",
}

# 传记起首模式（扫全书）
PAT = re.compile(
    r"([\u4e00-\u9fff]{2,4})(?:者)?[，,]\s*"
    r"(?:字[\u4e00-\u9fff]{1,3}[，,]\s*)?"
    r"[\u4e00-\u9fff]{2,10}?人[也。，,]")


def main():
    con = sqlite3.connect(DB)
    # 1. 扫全书建立索引
    index = {}  # name -> (desc, source)
    for book, content in con.execute(
            "SELECT book,content FROM texts WHERE book IN (%s)" %
            ",".join("?" * len(BOOK_DY)), tuple(BOOK_DY)):
        for m in PAT.finditer(content):
            nm = t2s.convert(m.group(1))
            if nm in index:
                continue
            seg = content[m.start():m.start() + 100]
            desc = t2s.convert(re.split(r"[。；]", seg)[0])[:60]
            # 出处：找卷号（节选）
            index[nm] = (desc, f"《{book}》")
    print(f"正史传记索引: {len(index):,} 人")

    # 2. 批量匹配待补人物
    targets = con.execute(
        "SELECT id,name FROM persons WHERE summary IS NULL OR summary=''").fetchall()
    updates = []
    for pid, name in targets:
        hit = index.get(name)
        if hit and len(hit[0]) >= 8:
            updates.append((hit[0], hit[1], pid))
    print(f"可补: {len(updates):,}")
    con.executemany("UPDATE persons SET summary=? WHERE id=?", [(d, pid) for d, s, pid in updates])
    con.commit()
    tot = con.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
    have = con.execute("SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL AND summary<>''").fetchone()[0]
    print(f"✓ summary 覆盖: {have:,}/{tot:,} ({have*100//tot}%)")
    con.close()


if __name__ == "__main__":
    main()
