#!/usr/bin/env python3
"""C12b：Wikidata Q-ID 批量桥接（VALUES 多值一次查）。"""
import sqlite3, os, json, urllib.request, urllib.parse, time, sys
DB=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),"data","lr-song.sqlite3")
EP="https://query.wikidata.org/sparql"; UA="long-river-research/1.0 (contact: dev@example.com)"
OP=urllib.request.build_opener(urllib.request.ProxyHandler())
def sparql(q):
    url=EP+"?"+urllib.parse.urlencode({'query':q,'format':'json'})
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/sparql-results+json'})
    return json.load(OP.open(req,timeout=90))
def main():
    con=sqlite3.connect(DB); con.execute("PRAGMA journal_mode=WAL")
    cols=[r[1] for r in con.execute("PRAGMA table_info(persons)")]
    if 'qid' not in cols: con.execute("ALTER TABLE persons ADD COLUMN qid TEXT")
    rows=con.execute("SELECT id,name,birth FROM persons WHERE birth IS NOT NULL AND birth<>0 AND name IS NOT NULL AND length(name)>=2 AND qid IS NULL").fetchall()
    print(f"待匹配 {len(rows)} 人")
    matched=0
    CH=80
    for s in range(0,len(rows),CH):
        chunk=rows[s:s+CH]
        names=" ".join('"%s"@zh'%nm.replace('"','') for _,nm,_ in chunk)
        q=f'''SELECT ?p ?pLabel ?bd WHERE {{ VALUES ?lb {{ {names} }}
          ?p rdfs:label ?lb ; wdt:P569 ?bd .
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh". }} }}'''
        try: res=sparql(q)
        except Exception as e: print("err",e); time.sleep(3); continue
        # name→birth 映射
        nm2b={}
        for pid,nm,b in chunk: nm2b.setdefault(nm,[]).append((pid,b))
        for bd in res['results']['bindings']:
            nm=bd['pLabel']['value']; qid=bd['p']['value'].rsplit('/',1)[-1]
            try: wy=int(bd['bd']['value'][:4])
            except: continue
            for pid,b in nm2b.get(nm,[]):
                if abs(wy-b)<=1:
                    con.execute("UPDATE persons SET qid=? WHERE id=? AND qid IS NULL",(qid,pid))
                    matched+=1
                    break
        con.commit()
        print(f"  {s+len(chunk)}/{len(rows)} … 命中 {matched}")
        time.sleep(0.5)
    print(f"\n✓ 匹配 {matched}，qid 总 {con.execute('SELECT COUNT(*) FROM persons WHERE qid IS NOT NULL').fetchone()[0]}")
    con.close()
if __name__=="__main__": main()
