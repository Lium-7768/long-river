#!/usr/bin/env python3
"""任务C 续：从新补的正史（三国志/晋书/南北朝/隋唐）抽取人物。

这些书的问题：帝王用「諱X，字Y」，士人用「X，字Y」；三国志裴松之注混入。
策略（严格）：
  ① 传记起首：句首（或 。 后）紧跟 "XX，字YY" / "XX字YY" / "諱XX，字YY"
  ② 名 2-4 字，字 1-3 字
  ③ 排除注文（〈…〉）
"""
import sqlite3, re, os, json
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

NEWBOOKS = {
    "三国志": "sanguo", "晋书": "jin", "宋书": "nanbei", "南齐书": "nanbei",
    "梁书": "nanbei", "陈书": "nanbei", "魏书": "nanbei", "北齐书": "nanbei",
    "周书": "nanbei", "隋书": "sui", "南史": "nanbei", "北史": "nanbei",
    "旧唐书": "tang", "新唐书": "tang",
}
# 句首 + XX，字YY
BIO = re.compile(r"(?:^|[。！？\n])\s*(?:諱)?([\u4e00-\u9fff]{2,4})[，,]\s*字\s*([\u4e00-\u9fff]{1,3})[，,]")


def main():
    con = sqlite3.connect(DB)
    have = set(r[0] for r in con.execute("SELECT name FROM persons"))
    added = 0
    for book, dy in NEWBOOKS.items():
        for vol, content in con.execute(
                "SELECT volume,content FROM texts WHERE book=?", (book,)):
            clean = re.sub(r"〈[^〉]*〉", "", content)
            for m in BIO.finditer(clean):
                nm, zi = t2s.convert(m.group(1)), t2s.convert(m.group(2))
                if nm in have or len(nm) < 2:
                    continue
                desc = t2s.convert(re.split(r"[。；]", clean[m.start():m.start() + 90])[0])[:60]
                nid = f"gb-{book}-{vol}-{nm}"
                if con.execute("SELECT 1 FROM persons WHERE id=?", (nid,)).fetchone():
                    continue
                con.execute("""INSERT INTO persons
                    (id,name,zi,summary,source,dynasty_id,prominence,addr)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (nid, nm, zi, desc, f"《{book}·{vol}》", dy, 5, None))
                added += 1
                have.add(nm)
    con.commit()
    print(f"✓ 魏晋隋唐正史补入: {added:,}")
    con.close()


if __name__ == "__main__":
    main()
