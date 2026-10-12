#!/usr/bin/env python3
"""补数据C45：帝王世系表 emperor（Wikidata）。

CBDB 不收录帝王，导致 profiles 中「康熙帝/宋仁宗/汉文帝」等无法链接。
从 Wikidata (P39=Q268218 中国皇帝地位) 拉取帝王庙号/称号 + 本名 + 在位起止。
朝代由在位年对本地朝代轴推导（Wikidata P27=国籍，不可靠）。
"""
import sqlite3, os, json, re, urllib.request, urllib.parse, time
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
UA = "long-river-research/1.0 (contact: dev@example.com)"

QUERY = """
SELECT ?p ?pLabel ?native (MIN(?start) AS ?s) (MAX(?end) AS ?e) WHERE {
  ?p wdt:P39 wd:Q268218 .
  OPTIONAL { ?p wdt:P1559 ?native }
  ?p p:P39 ?st . ?st ps:P39 wd:Q268218 .
  OPTIONAL { ?st pq:P580 ?start . ?st pq:P582 ?end . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,zh-cn,zh-hans". }
} GROUP BY ?p ?pLabel ?native
"""

# 朝代轴（用于推导 dynasty）：按在位起始年
DYN = [
    (-221, -206, 'qin'), (-206, 9, 'han-w'), (9, 23, 'xin'), (25, 220, 'han-e'),
    (220, 280, 'sanguo'), (266, 420, 'jin'), (420, 589, 'nanbei'), (581, 618, 'sui'),
    (618, 907, 'tang'), (907, 960, 'wudai'), (916, 1125, 'liao'), (960, 1127, 'song-w'),
    (1127, 1279, 'song-e'), (1038, 1227, 'xixia'), (1115, 1234, 'jin-chao'),
    (1271, 1368, 'yuan'), (1368, 1644, 'ming'), (1636, 1912, 'qing'),
]


def sparql(q):
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    for i in range(4):
        try:
            return json.load(_OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90))
        except Exception as e:
            print("  retry", i, str(e)[:60])
            time.sleep(8 * (i + 1))
    return {'results': {'bindings': []}}


def yr(s):
    if not s:
        return None
    s = s[:4]
    if not re.match(r'^-?\d+$', s):
        return None
    try:
        return int(s)
    except ValueError:
        return None


def dyn_of(y):
    if y is None:
        return ''
    for a, b, d in DYN:
        if a <= y < b:
            return d
    return ''


def split_name(n):
    """本名形如 '爱新觉罗·玄烨' → 玄烨；返回 [全名, 末段]"""
    out = [n]
    for sep in ('·', '‧', '・'):
        if sep in n:
            out.append(n.split(sep)[-1])
    return out


def main():
    d = sparql(QUERY)
    rows = d['results']['bindings']
    print(f"Wikidata 返回 {len(rows)} 条")
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS emperor")
    con.execute(
        """CREATE TABLE emperor(
            qid TEXT PRIMARY KEY, title TEXT, native TEXT, aliases TEXT,
            dynasty_id TEXT, birth INTEGER, death INTEGER,
            reign_start INTEGER, reign_end INTEGER
        )"""
    )
    seen = {}
    for b in rows:
        def v(k):
            return b.get(k, {}).get('value', '') or ''
        qid = v('p').split('/')[-1]
        title = v('pLabel')
        native = v('native')
        s = yr(v('s'))
        # 建 qid 主键去重
        if qid in seen:
            continue
        # 别名：本名多形式 + 标题（简繁都留）
        alias_set = set()
        if native:
            alias_set.update(split_name(native))
        rec = (qid, title, native, json.dumps(sorted(alias_set), ensure_ascii=False),
               dyn_of(s), None, None, s, yr(v('e')))
        seen[qid] = rec
    con.executemany("INSERT OR REPLACE INTO emperor VALUES (?,?,?,?,?,?,?,?,?)", list(seen.values()))
    con.commit()
    print(f"✓ emperor: {len(seen)} 条，有本名 {sum(1 for r in seen.values() if r[2])}")
    for r in con.execute("SELECT title,native,dynasty_id,reign_start,reign_end FROM emperor WHERE title IN ('唐太宗','宋仁宗','康熙帝','秦始皇','汉武帝','明英宗') "):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
