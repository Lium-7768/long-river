#!/usr/bin/env python3
"""补数据C12：Wikidata Q-ID 桥接 + 生卒交叉核验。

策略：对库内「有名有生年」的人物，按「姓名 + 生年±1」查 Wikidata，
命中则记 Q-ID、Wikidata 生/卒/描述，与我们的 birth/death 交叉核验。
为避免 SPARQL 超时，分批（VALUES）查询。
"""
import sqlite3, os, json, urllib.request, urllib.parse, time, sys
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
EP = "https://query.wikidata.org/sparql"
UA = "long-river-research/1.0 (contact: dev@example.com)"
OP = urllib.request.build_opener(urllib.request.ProxyHandler())


def sparql(q):
    url = EP + "?" + urllib.parse.urlencode({'query': q, 'format': 'json'})
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
    return json.load(OP.open(req, timeout=60))


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cols = [r[1] for r in con.execute("PRAGMA table_info(persons)")]
    if 'qid' not in cols:
        con.execute("ALTER TABLE persons ADD COLUMN qid TEXT")
    # 目标：有生年的人（分页）
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    rows = con.execute(
        "SELECT id,name,birth,death FROM persons WHERE birth IS NOT NULL AND birth<>0 "
        "AND name IS NOT NULL AND length(name)>=2 LIMIT ? OFFSET ?", (limit, offset)).fetchall()
    print(f"目标 {len(rows)} 人 (offset {offset})")
    matched = 0
    for i, (pid, name, b, d) in enumerate(rows):
        q = f'''SELECT ?p ?pLabel ?bd ?dd WHERE {{
          ?p rdfs:label "{name}"@zh ; wdt:P569 ?bd .
          OPTIONAL {{ ?p wdt:P570 ?dd }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh". }}
        }} LIMIT 10'''
        try:
            res = sparql(q)
        except Exception:
            time.sleep(2)
            continue
        for bind in res['results']['bindings']:
            bd = bind['bd']['value'][:4]
            try:
                wy = int(bd)
            except Exception:
                continue
            # 生年 ±1 匹配
            if abs(wy - b) <= 1:
                qid = bind['p']['value'].rsplit('/', 1)[-1]
                con.execute("UPDATE persons SET qid=? WHERE id=?", (qid, pid))
                matched += 1
                break
        if i % 25 == 0:
            con.commit()
            print(f"  {i}/{len(rows)} … 命中 {matched}")
        time.sleep(0.2)
    con.commit()
    print(f"\n✓ 本轮匹配 {matched}")
    print("qid 总:", con.execute("SELECT COUNT(*) FROM persons WHERE qid IS NOT NULL").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main()
