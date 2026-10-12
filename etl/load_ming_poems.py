#!/usr/bin/env python3
"""补数据C24：从「列朝诗集」（钱谦益，明诗总集）抓取明诗。

结构：== 詩人名 X首 == 后跟小传，=== 【詩題】 === 后跟诗正文。
"""
import sqlite3, os, re, json, urllib.request, urllib.parse, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0"
OP = urllib.request.build_opener(urllib.request.ProxyHandler())


def api(p):
    p['format'] = 'json'
    url = API + "?" + urllib.parse.urlencode(p)
    return json.load(OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30))


def get_text(title):
    d = api({'action': 'query', 'prop': 'extracts', 'explaintext': '1', 'titles': title, 'redirects': '1'})
    for pid in d['query']['pages']:
        return d['query']['pages'][pid].get('extract', '') or ''
    return ''


def parse(content):
    """返回 [(poet, title, body)]"""
    out = []
    poet = None
    title = None
    buf = []
    for line in content.split('\n'):
        s = line.strip()
        m1 = re.match(r'^==\s*(.+?)\s*==$', s)
        m2 = re.match(r'^===\s*【(.+?)】\s*===$', s)
        if m2:
            if poet and title and buf:
                out.append((poet, title, "\n".join(buf)))
            title = m2.group(1)
            buf = []
        elif m1:
            if poet and title and buf:
                out.append((poet, title, "\n".join(buf)))
            title = None
            buf = []
            # "張宮保治 一十四首" → 名 = 去尾数
            name = re.sub(r'\s*[一二三四五六七八九十百]+首\s*$', '', m1.group(1)).strip()
            poet = name
        elif title and s and not s.startswith('=='):
            buf.append(s)
    if poet and title and buf:
        out.append((poet, title, "\n".join(buf)))
    # 过滤太短/非诗
    return [(p, t, b) for p, t, b in out if len(b) >= 8]


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    pages = []
    cont = None
    while True:
        p = {'action': 'query', 'list': 'allpages', 'apprefix': '列朝詩集/', 'aplimit': '500', 'apnamespace': '0'}
        if cont:
            p['apcontinue'] = cont
        d = api(p)
        pages += [x['title'] for x in d['query']['allpages']]
        if 'continue' in d:
            cont = d['continue']['apcontinue']
        else:
            break
    print(f"列朝詩集 {len(pages)} 卷")
    from opencc import OpenCC
    t2s = OpenCC('t2s')
    total = 0
    for pg in pages:
        try:
            content = get_text(pg)
        except Exception:
            continue
        poems = parse(content)
        for poet, title, body in poems:
            con.execute("INSERT INTO poems(title,author,dynasty,genre,content,n_lines,src,poem_dynasty,famous) "
                        "VALUES (?,?,?,?,?,?,?,?,0)",
                        (t2s.convert(title), t2s.convert(poet), 'ming', '诗', t2s.convert(body),
                         body.count('\n') + 1, '列朝诗集', 'ming'))
            total += 1
        con.commit()
        print(f"  {pg}: {len(poems)} 首（累计 {total}）")
    print(f"\n✓ 列朝诗集 明诗 {total}")
    con.close()


if __name__ == "__main__":
    main()
