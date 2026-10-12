#!/usr/bin/env python3
"""C9b：并发抓取缺失古籍（跳过已有书）。"""
import sqlite3, os, json, urllib.request, urllib.parse, time, sys, re
from concurrent.futures import ThreadPoolExecutor, as_completed
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
API = "https://zh.wikisource.org/w/api.php"
UA = "long-river-research/1.0 (contact: dev@example.com)"
OP = urllib.request.build_opener(urllib.request.ProxyHandler())

def api(p):
    p['format']='json'; url=API+"?"+urllib.parse.urlencode(p)
    req=urllib.request.Request(url, headers={'User-Agent':UA})
    return json.load(OP.open(req, timeout=25))

def list_pages(prefix):
    out=[]; cont=None
    while True:
        p={'action':'query','list':'allpages','apprefix':prefix+'/','aplimit':'500','apnamespace':'0'}
        if cont: p['apcontinue']=cont
        d=api(p); out+=[x['title'] for x in d['query']['allpages']]
        if 'continue' in d: cont=d['continue']['apcontinue']
        else: break
    return out

def fetch(title):
    d=api({'action':'query','prop':'extracts','explaintext':'1','titles':title,'redirects':'1'})
    for pid in d['query']['pages']:
        return title, (d['query']['pages'][pid].get('extract') or '')

BOOKS=[("旧五代史","舊五代史"),("新元史","新元史"),("明儒学案","明儒學案"),
 ("宋元学案","宋元學案"),("墨子","墨子"),("荀子","荀子"),("韩非子","韓非子"),
 ("庄子","莊子"),("老子","老子"),("管子","管子"),("商君书","商君書"),
 ("淮南子","淮南子"),("吕氏春秋","呂氏春秋"),("战国策","戰國策"),("国语","國語"),("列子","列子")]

def main():
    con=sqlite3.connect(DB); con.execute("PRAGMA journal_mode=WAL")
    existing={r[0] for r in con.execute("SELECT DISTINCT book FROM texts")}
    for book,prefix in BOOKS:
        if book in existing: print(f"  跳过 {book}(已有)"); continue
        try: pages=list_pages(prefix)
        except Exception as e: print(f"  ✗ {book} list: {e}"); continue
        if not pages: pages=[prefix]
        n=0
        with ThreadPoolExecutor(max_workers=8) as ex:
            futs={ex.submit(fetch,t):t for t in pages}
            for f in as_completed(futs):
                try: t,txt=f.result()
                except Exception: continue
                if len(txt)<200: continue
                vol=t.split('/',1)[1] if '/' in t else t
                con.execute("INSERT OR REPLACE INTO texts VALUES (?,?,?,?)",(book,vol,txt,len(txt)))
                n+=1
        con.commit(); print(f"  ✓ {book}: {n} 卷")
    print("done"); con.close()

if __name__=="__main__": main()
