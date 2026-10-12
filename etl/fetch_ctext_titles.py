#!/usr/bin/env python3
"""补数据C42：ctext 全库标题索引 → ctext_titles。

ctext gettexttitles 返回 49,646 部书/篇，建立古籍标题索引，
供书目检索 / 与自有 bibliography 比对补缺。
"""
import sqlite3, os, json, urllib.request
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
UA = "long-river-research/1.0 (contact: dev@example.com)"


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    d = json.load(_OP.open(urllib.request.Request(
        'https://api.ctext.org/gettexttitles', headers={'User-Agent': UA}), timeout=40))
    books = d.get('books', [])
    con.execute("DROP TABLE IF EXISTS ctext_titles")
    con.execute("CREATE TABLE ctext_titles(urn TEXT PRIMARY KEY, title TEXT)")
    con.executemany("INSERT OR REPLACE INTO ctext_titles VALUES (?,?)",
                    [(b.get('urn', ''), b.get('title', '')) for b in books])
    con.commit()
    print(f"✓ ctext_titles: {len(books):,}")
    # 与自有 bibliography 比对（繁简统一）
    from opencc import OpenCC
    t2s = OpenCC('t2s')
    ours = {t2s.convert(r[0]) for r in con.execute("SELECT DISTINCT title FROM bibliography") if r[0]}
    ctext_norm = {t2s.convert(b.get('title', '')) for b in books}
    overlap = ours & ctext_norm
    print(f"  与 bibliography 标题交集: {len(overlap):,}")
    print(f"  仅 ctext 有（可补）: {len(ctext_norm - ours):,}")
    con.close()


if __name__ == "__main__":
    main()
