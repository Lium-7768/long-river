#!/usr/bin/env python3
"""补数据C9：从维基文库抓取缺失正史/古籍，存入 texts 表。

缺失正史：旧五代史、新元史；补充诸子：墨子/荀子/韩非子/庄子/老子/管子/商君书 等。
"""
import sqlite3, os, sys, re, json, time, urllib.request, urllib.parse

_PROXY = urllib.request.ProxyHandler()  # 自动读 http_proxy/all_proxy
_OPENER = urllib.request.build_opener(_PROXY)

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0 (contact: dev@example.com)"

# 书名 → 前缀（维基文库页面前缀）
BOOKS = [
    ("旧五代史", "舊五代史"),
    ("新元史", "新元史"),
    ("明儒学案", "明儒學案"),
    ("宋元学案", "宋元學案"),
    ("墨子", "墨子"),
    ("荀子", "荀子"),
    ("韩非子", "韓非子"),
    ("庄子", "莊子"),
    ("老子", "老子"),
    ("管子", "管子"),
    ("商君书", "商君書"),
    ("淮南子", "淮南子"),
    ("吕氏春秋", "呂氏春秋"),
    ("战国策", "戰國策"),
    ("国语", "國語"),
    ("列子", "列子"),
]


def api(params):
    params['format'] = 'json'
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return json.load(_OPENER.open(req, timeout=30))


def list_pages(prefix):
    out = []
    cont = None
    while True:
        p = {'action': 'query', 'list': 'allpages', 'apprefix': prefix + '/',
             'aplimit': '500', 'apnamespace': '0'}
        if cont:
            p['apcontinue'] = cont
        d = api(p)
        out += [x['title'] for x in d['query']['allpages']]
        if 'continue' in d:
            cont = d['continue']['apcontinue']
        else:
            break
    return out


def fetch_text(title):
    d = api({'action': 'query', 'prop': 'extracts', 'explaintext': '1',
             'titles': title, 'redirects': '1'})
    pages = d['query']['pages']
    for pid in pages:
        return pages[pid].get('extract', '') or ''
    return ''


def main():
    con = sqlite3.connect(DB)
    total = 0
    for book, prefix in BOOKS:
        try:
            pages = list_pages(prefix)
        except Exception as e:
            print(f"  ✗ {book}: {e}")
            continue
        if not pages:
            # 单页书
            pages = [prefix]
        n = 0
        for t in pages:
            vol = t.split('/', 1)[1] if '/' in t else t
            try:
                txt = fetch_text(t)
            except Exception:
                continue
            if len(txt) < 200:
                continue
            con.execute("INSERT OR REPLACE INTO texts VALUES (?,?,?,?)",
                        (book, vol, txt, len(txt)))
            n += 1
            time.sleep(0.05)
        con.commit()
        print(f"  ✓ {book}: {n} 卷")
        total += n
    print(f"\n✓ 新增 {total} 卷")
    con.close()


if __name__ == "__main__":
    main()
