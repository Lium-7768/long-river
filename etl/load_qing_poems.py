#!/usr/bin/env python3
"""补数据C25：从「晚晴簃诗汇」（清诗总汇，徐世昌编）抓取清诗。

结构（按行）：
  卷XXX
  \t诗人名
  \t诗人名，字X，号Y，Z人。...有《集名》。      ← 小传
  \t诗题
  \t诗正文（可多行）
  \t（下一诗题 / 下一诗人）
"""
import sqlite3, os, re, json, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from opencc import OpenCC
t2s = OpenCC('t2s')
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0"
OP = urllib.request.build_opener(urllib.request.ProxyHandler())


def api(p):
    p['format'] = 'json'
    url = API + "?" + urllib.parse.urlencode(p)
    return json.load(OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30))


def get_text(title):
    for attempt in range(5):
        try:
            d = api({'action': 'query', 'prop': 'extracts', 'explaintext': '1', 'titles': title, 'redirects': '1'})
            for pid in d['query']['pages']:
                return d['query']['pages'][pid].get('extract', '') or ''
            return ''
        except Exception:
            time.sleep(8 * (attempt + 1))
    return ''


BIO = re.compile(r'^[\u4e00-\u9fa5]{2,4}[，,]字[\u4e00-\u9fa5]')   # 诗人小传：「XX，字Y」


def parse(content):
    """返回 [(poet, title, body)]"""
    lines = [l.strip() for l in content.split('\n')]
    out = []
    poet = None
    title = None
    buf = []

    def flush():
        if poet and title and buf and len("\n".join(buf)) >= 8:
            out.append((poet, title, "\n".join(buf)))

    for s in lines:
        if not s or re.match(r'^卷[一二三四五六七八九十百零\d]+$', s):
            continue
        if BIO.match(s):
            # 小传行 → 诗人（取姓名，逗号前）
            flush(); buf = []; title = None
            poet = re.split(r'[，,（(]', s)[0].strip()
            continue
        if not title and poet:
            # 第一个非小传、非空行 → 诗题
            title = s
            buf = []
            continue
        if title:
            buf.append(s)
    flush()
    return out


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    pages = []
    cont = None
    while True:
        p = {'action': 'query', 'list': 'allpages', 'apprefix': '晚晴簃詩匯/', 'aplimit': '500', 'apnamespace': '0'}
        if cont:
            p['apcontinue'] = cont
        d = api(p)
        pages += [x['title'] for x in d['query']['allpages']]
        if 'continue' in d:
            cont = d['continue']['apcontinue']
        else:
            break
    print(f"晚晴簃詩匯 {len(pages)} 卷")
    total = 0
    for pg in pages:
        try:
            content = get_text(pg)
        except Exception:
            continue
        poems_p = parse(content)
        for poet, title, body in poems_p:
            con.execute("INSERT INTO poems(title,author,dynasty,genre,content,n_lines,src,poem_dynasty,famous) "
                        "VALUES (?,?,?,?,?,?,?,?,0)",
                        (t2s.convert(title), t2s.convert(poet), 'qing', '诗', t2s.convert(body),
                         body.count('\n') + 1, '晚晴簃诗汇', 'qing'))
            total += 1
        con.commit()
        print(f"  {pg}: 累计 {total}")
        time.sleep(5)
    print(f"\n✓ 晚晴簃诗汇 清诗 {total}")
    con.close()


if __name__ == "__main__":
    main()
