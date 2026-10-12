#!/usr/bin/env python3
"""补数据C43：地方志（吴郡志/吴郡图经续记）→ texts。

吴郡志：宋·范成大撰，苏州地方志（50卷），含人物/沿革/风俗。
吴郡图经续记：宋·朱长文撰（4卷）。
"""
import sqlite3, os, re, json, time, urllib.request, urllib.parse
from opencc import OpenCC
t2s = OpenCC("t2s")
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0 (contact: dev@example.com)"

BOOKS = [("吴郡志", "吳郡志"), ("吴郡图经续记", "吳郡圖經續記")]


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
    out, cont = [], None
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
    total = 0
    for book_zh, prefix in BOOKS:
        pages = list_pages(prefix)
        print(f"{book_zh}: {len(pages)} 页", flush=True)
        got = 0
        for pg in pages:
            if con.execute("SELECT COUNT(*) FROM texts WHERE book=? AND volume=?", (book_zh, pg)).fetchone()[0]:
                continue
            content = get_text(pg)
            if not content or len(content) < 50:
                time.sleep(3)
                continue
            con.execute("INSERT INTO texts(book,volume,content,chars) VALUES (?,?,?,?)",
                        (book_zh, pg.split('/')[-1], t2s.convert(content), len(content)))
            got += 1
            total += 1
            time.sleep(3)
        con.commit()
        print(f"  ✓ {book_zh} 新增 {got}", flush=True)
    print(f"\n✓ 地方志 共新增 {total}")
    con.close()


if __name__ == "__main__":
    main()
