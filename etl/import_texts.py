#!/usr/bin/env python3
"""把公版史书全文存入本地 sqlite 的 texts 表。"""
import sqlite3, os, sys, re

SOURCES = [
    ("史记", "/tmp/shiji", "md"),
    ("资治通鉴", "/tmp/texts/zizhitongjian", "md"),
    ("汉书", "/tmp/texts/hanshu", "md"),
    ("后汉书", "/tmp/texts/houhanshu", "md"),
    ("三国志", "/tmp/texts/sanguozhi", "md"),
    ("明史", "/tmp/mingshi", "txt"),
    ("清史稿", "/tmp/qingshigao", "txt"),
    ("春秋左氏传", "/tmp/zuozhuan", "txt"),
    ("元史", "/tmp/books/元史", "txt"),
    ("辽史", "/tmp/books/遼史", "txt"),
    ("金史", "/tmp/books/金史", "txt"),
    ("新五代史", "/tmp/books/新五代史", "txt"),
    ("宋史", "/tmp/books/宋史", "txt"),
]

def main():
    db = sys.argv[1] if len(sys.argv) > 1 else "data/db/lr-song.sqlite3"
    con = sqlite3.connect(db)
    con.execute("""CREATE TABLE IF NOT EXISTS texts (
        book TEXT, volume TEXT, content TEXT, chars INTEGER,
        PRIMARY KEY (book, volume))""")
    total = chars = 0
    for book, d, ext in SOURCES:
        if not os.path.isdir(d):
            print(f"  跳过 {book}（目录不存在）"); continue
        n = 0
        for fn in sorted(os.listdir(d)):
            if not fn.endswith("." + ext):
                continue
            vol = re.sub(r"\.(md|txt)$", "", fn)
            try:
                content = open(os.path.join(d, fn), encoding="utf-8").read()
            except Exception:
                continue
            con.execute("INSERT OR REPLACE INTO texts VALUES (?,?,?,?)",
                        (book, vol, content, len(content)))
            n += 1; chars += len(content)
        con.commit()
        print(f"  ✓ {book}: {n} 卷")
        total += n
    print(f"\n✓ 共 {total} 卷、{chars:,} 字 → texts 表")
    con.close()

if __name__ == "__main__":
    main()
