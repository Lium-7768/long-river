#!/usr/bin/env python3
"""补数据C51：古籍版本表 editions 标准化 → book_editions。

editions 原表以 text_id 链接、publisher 为缩写（CSJC/SKQSZB…）。
本脚本：按 title 聚合并解析版本缩写为可读丛书本名，便于「书目著录」展示。
"""
import sqlite3, os, re, json

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 常见丛书/版本缩写 → 全称（公知注释）
LEGEND = {
    'CSJC': '丛书集成初编', 'SKQSZB': '四库全书珍本', 'SBCK': '四部丛刊',
    'SBBY': '四部备要', 'WYD': '武英殿本', 'SYDFZ': '四库全书（文渊阁本）',
    'SKSLCS': '宋集珍本丛刊', 'Baihai': '百川学海',
}


def parse_pub(p):
    """publisher 形如 (CSJC). / (Beijing: Zhonghua shuju, 1962) → 归一。"""
    if not p:
        return None
    s = p.strip()
    # 抽括号内内容
    codes = re.findall(r'\(([^)]+)\)', s)
    if not codes:
        codes = [s.strip('(). ')]
    out = []
    for c in codes:
        c = c.strip().strip('.').strip()
        if not c:
            continue
        # 缩写归一
        if c in LEGEND:
            out.append(LEGEND[c])
        else:
            out.append(c)
    return ' · '.join(out) if out else None


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    rows = con.execute("SELECT title, publisher, pub_year, pub_loc, print, extant, notes FROM editions").fetchall()
    con.execute("DROP TABLE IF EXISTS book_editions")
    con.execute(
        """CREATE TABLE book_editions(
            title TEXT, edition TEXT, pub_year INTEGER, pub_loc TEXT,
            imprint TEXT, extant INTEGER, notes TEXT
        )"""
    )
    seen = set()
    n = 0
    for title, pub, year, loc, pr, ext, notes in rows:
        ed = parse_pub(pub)
        key = (title, ed, year)
        if key in seen:
            continue
        seen.add(key)
        con.execute("INSERT INTO book_editions VALUES (?,?,?,?,?,?,?)",
                    (title, ed, year if year and year > 0 else None, loc, pr, ext, notes))
        n += 1
    con.commit()
    print(f"✓ book_editions: {n}（去重后）")
    for r in con.execute("SELECT title,edition,pub_year FROM book_editions WHERE edition IS NOT NULL LIMIT 10"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
