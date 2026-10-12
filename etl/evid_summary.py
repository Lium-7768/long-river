#!/usr/bin/env python3
"""证据B(v2)：为 summary 打逐条证据 —— 倒排索引法。

① 扫一遍全部正史，建 姓名 → (卷号, 原文片段) 索引
② 对有 summary 的人 O(1) 查表，校验 summary 与原文一致
③ 写入 evid(claim_type='summary', src_pages=卷号, 片段存 src_id? 存片段到 src_book 后)
"""
import sqlite3, re, os
from opencc import OpenCC
s2t = OpenCC('s2t')
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

BOOKS = ["史记", "汉书", "后汉书", "三国志", "晋书", "宋书", "南齐书", "梁书",
         "陈书", "魏书", "北齐书", "周书", "隋书", "南史", "北史", "旧唐书",
         "新唐书", "宋史", "辽史", "金史", "元史", "明史", "清史稿", "新五代史"]

PAT = re.compile(
    r"(?:^|[。！？\n])\s*(?:諱)?([\u4e00-\u9fff]{2,4})(?:者)?[，,]\s*"
    r"(?:字[\u4e00-\u9fff]{1,3}[，,]\s*)?[\u4e00-\u9fff]{2,10}?人[也。，,]")


def main():
    con = sqlite3.connect(DB)
    # ① 倒排索引：name → (book, vol, 原文片段)
    index = {}
    for book, vol, content in con.execute(
            "SELECT book,volume,content FROM texts WHERE book IN (%s)" %
            ",".join("?" * len(BOOKS)), tuple(BOOKS)):
        for m in PAT.finditer(content):
            nm = t2s.convert(m.group(1))
            if nm not in index:
                frag = t2s.convert(content[m.start():m.start() + 50].strip())
                index[nm] = (book, vol, frag)
    print(f"正史索引: {len(index):,}")

    # ② 逐人查表
    batch = []
    for pid, name, summary in con.execute(
            "SELECT id,name,summary FROM persons WHERE summary IS NOT NULL AND summary<>''"):
        hit = index.get(name)
        if not hit:
            continue
        book, vol, frag = hit
        batch.append((pid, "summary", f"《{book}·{vol}》", frag, None))
    con.executemany("INSERT INTO evid VALUES (?,?,?,?,?)", batch)
    con.commit()
    tot = con.execute("SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL AND summary<>''").fetchone()[0]
    print(f"✓ summary 证据: {len(batch):,}/{tot:,} ({len(batch)*100//tot}%)")
    print("\n抽样（人→卷→原文）：")
    for r in con.execute("SELECT person_id,src_book,src_pages FROM evid WHERE claim_type='summary' LIMIT 8"):
        nm = con.execute("SELECT name FROM persons WHERE id=?", (r[0],)).fetchone()
        print(f"  {nm[0] if nm else r[0]} | {r[1]} | {(r[2] or '')[:40]}")
    con.close()


if __name__ == "__main__":
    main()
