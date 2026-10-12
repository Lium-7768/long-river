#!/usr/bin/env python3
"""补数据C39：从《元和郡县图志》抽「政区户数」→ region_stats。

结构：== 府/州名 == 后跟「XX，…开元户N…元和户M…」
OCR 常见讹字：万→元/无（如"六元四千"=六万四千），已修正。
"""
import sqlite3, os, re
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

DIG = '零一二三四五六七八九十百千万'


def cn2num(s):
    if not s:
        return 0
    s = re.sub(r'[元无]', '万', s)   # OCR 讹字修正
    total = section = num = 0
    for ch in s:
        if ch in '零一二三四五六七八九':
            num = '零一二三四五六七八九'.index(ch)
        elif ch == '十':
            section += (num or 1) * 10
            num = 0
        elif ch == '百':
            section += (num or 1) * 100
            num = 0
        elif ch == '千':
            section += (num or 1) * 1000
            num = 0
        elif ch == '万':
            total = (total + section + num) * 10000
            section = num = 0
    return total + section + num


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS region_stats")
    con.execute("""CREATE TABLE region_stats(
        dynasty TEXT, region TEXT, kaiyuan_hu INTEGER, yuanhe_hu INTEGER, source TEXT)""")
    numpat = f'([{DIG}元无]+)'
    rows = []
    seen = set()
    for (content,) in con.execute("SELECT content FROM texts WHERE book='元和郡县图志'"):
        cur = None
        for line in content.split('\n'):
            s = line.strip()
            m = re.match(r'^==\s*(.+?)\s*==$', s)
            if m and not m.group(1).startswith('='):
                cur = m.group(1).strip()
                continue
            if not cur or '户' not in s:
                continue
            ky = re.search(r'开元户' + numpat, s)
            yh = re.search(r'元和户' + numpat, s)
            if not (ky or yh):
                continue
            if cur in seen:
                continue
            seen.add(cur)
            rows.append(('tang', cur, cn2num(ky.group(1)) if ky else 0,
                         cn2num(yh.group(1)) if yh else 0, '元和郡县图志'))
    con.executemany("INSERT INTO region_stats VALUES (?,?,?,?,?)", rows)
    con.commit()
    print(f"✓ region_stats: {len(rows)} 政区")
    for r in con.execute("SELECT region,kaiyuan_hu,yuanhe_hu FROM region_stats ORDER BY kaiyuan_hu DESC LIMIT 12"):
        print(f"    {r[0]}: 开元{r[1]:,}户 元和{r[2]:,}户")
    con.close()


if __name__ == "__main__":
    main()
