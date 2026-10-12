#!/usr/bin/env python3
"""补数据C38：抓取地理总志（元和郡县图志/太平寰宇记/读史方舆纪要）→ texts。

这些是历代地理总志，支撑「疆域地理」主题。
带 retry + 限流退避。
"""
import sqlite3, os, re, json, time, urllib.request, urllib.parse
from opencc import OpenCC
t2s = OpenCC("t2s")
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0 (contact: dev@example.com)"

BOOKS = [
    ("元和郡县图志", "元和郡縣圖志", "tang"),
    ("太平寰宇记", "太平寰宇記", "song-w"),
    ("读史方舆纪要", "讀史方輿紀要", "qing"),
]


def api(params, tries=6):
    params['format'] = 'json'
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            return json.load(_OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30))
        except Exception:
            time.sleep(6 * (i + 1))
    return {}


def list_pages(prefix):
    out = []
    cont = None
    while True:
        p = {'action': 'query', 'list': 'allpages', 'apprefix': prefix + '/', 'aplimit': '500', 'apnamespace': '0'}
        if cont:
            p['apcontinue'] = cont
        d = api(p)
        if 'query' not in d:
            break
        out += [x['title'] for x in d['query']['allpages']]
        if 'continue' in d:
            cont = d['continue']['apcontinue']
        else:
            break
        time.sleep(1)
    return out


def get_text(title):
    d = api({'action': 'query', 'prop': 'extracts', 'explaintext': '1', 'titles': title, 'redirects': '1'})
    for pid in d.get('query', {}).get('pages', {}):
        return d['query']['pages'][pid].get('extract', '') or ''
    return ''


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cols = [r[1] for r in con.execute("PRAGMA table_info(texts)")]
    total = 0
    for book_zh, prefix, dyn in BOOKS:
        pages = list_pages(prefix)
        print(f"{book_zh}: {len(pages)} 卷", flush=True)
        got = 0
        for pg in pages:
            exist = con.execute("SELECT COUNT(*) FROM texts WHERE book=? AND volume=?", (book_zh, pg)).fetchone()[0]
            if exist:
                continue
            content = get_text(pg)
            if not content or len(content) < 50:
                time.sleep(3)
                continue
            vol = pg.split('/')[-1]
            row = {'book': book_zh, 'volume': vol, 'content': t2s.convert(content),
                   'chars': len(content)}
            keys = [k for k in row if k in cols]
            con.execute(f"INSERT INTO texts({','.join(keys)}) VALUES ({','.join('?' * len(keys))})",
                        [row[k] for k in keys])
            got += 1
            total += 1
            time.sleep(3)
        con.commit()
        print(f"  ✓ {book_zh} 新增 {got} 卷", flush=True)
    print(f"\n✓ 地理总志 共新增 {total} 卷")
    con.close()


if __name__ == "__main__":
    main()
