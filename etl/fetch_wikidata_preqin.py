#!/usr/bin/env python3
"""第三轮：先秦（夏/商/西周/秦/新）多路扩充。

fetch_wikidata.py 只用 P27 直连；这里再加两条路径：
  - P39（担任职务）的所属国 = 该朝
  - P27 指向「属于该朝体系」的政权（P361 部分）
以补回 P27 漏挂的先秦人物。
"""
import json, sys, time, urllib.parse, urllib.request

UA = "long-river-research/1.0 (educational; contact dev@example.com)"
EP = "https://query.wikidata.org/sparql"
try:
    from opencc import OpenCC
    _t2s = OpenCC("t2s").convert
except Exception:
    def _t2s(x):
        return x


def sparql(q):
    data = urllib.parse.urlencode({"query": q, "format": "json"}).encode()
    req = urllib.request.Request(EP, data=data, headers={
        "User-Agent": UA, "Accept": "application/sparql-results+json"})
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["results"]["bindings"]
        except Exception:
            if a == 3:
                raise
            time.sleep(3 * (a + 1))


def val(b, k):
    return b.get(k, {}).get("value")


def parse_year(s):
    if not s or (not s[0].isdigit() and s[0] != "-"):
        return None
    neg = s.startswith("-")
    body = s.lstrip("-")
    if len(body) < 4 or not body[:4].isdigit():
        return None
    y = int(body[:4])
    return -y if neg else y


def prom(n):
    return 8 if n >= 20 else 7 if n >= 8 else 6 if n >= 3 else 5 if n >= 1 else 4


def sane(b, d):
    if b is not None and d is not None and b >= d:
        return False
    return all(y is None or -2500 <= y <= 2000 for y in (b, d))


Q = """SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {{
  ?p wdt:P31 wd:Q5 .
  {{ ?p wdt:P27 wd:{qid} }} UNION
  {{ ?p wdt:P39 ?o . ?o wdt:P17 wd:{qid} }} UNION
  {{ ?p wdt:P27 ?c . ?c wdt:P361 wd:{qid} }}
  OPTIONAL {{ ?p wdt:P569 ?birth }}
  OPTIONAL {{ ?p wdt:P570 ?death }}
  OPTIONAL {{ ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }}
  OPTIONAL {{ ?sl schema:about ?p }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }}
}} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 800"""

PLAN = {
    "xia":    ("Q169705", "夏朝"),
    "shang":  ("Q128938", "商朝"),
    "zhou-w": ("Q1069609", "西周"),
    "qin":    ("Q7183", "秦朝"),
    "xin":    ("Q504769", "新朝"),
}

out = []
for dy, (qid, name) in PLAN.items():
    try:
        res = sparql(Q.format(qid=qid))
    except Exception as e:
        print(f"[{dy}] 失败: {e}", file=sys.stderr)
        continue
    seen, n = set(), 0
    for b in res:
        q = val(b, "p").rsplit("/", 1)[-1]
        nm = val(b, "pLabel")
        if not nm or nm.startswith("Q") or q in seen:
            continue
        bb, dd = parse_year(val(b, "birth")), parse_year(val(b, "death"))
        if not sane(bb, dd):
            continue
        seen.add(q)
        n += 1
        out.append({
            "cbdb_id": None, "wikidata_qid": q, "name": _t2s(nm), "surname": None,
            "birth": bb, "death": dd, "dynasty": dy, "polity": name,
            "desc": _t2s(val(b, "pDesc") or ""), "source": f"Wikidata {q}",
            "links": int(val(b, "links") or 0), "prominence": prom(int(val(b, "links") or 0)),
            "zi": [], "hao": [], "shi": [], "addr_names": [],
            "office": [], "kin": [], "entry": [], "works": [], "_dynasty_id": dy,
        })
    print(f"[{dy}] {name}: {n} 人")
    time.sleep(1)

fp = sys.argv[2] if len(sys.argv) > 2 else "etl/build/wikidata_preqin.jsonl"
with open(fp, "w", encoding="utf-8") as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"\n✓ 共 {len(out)} 人 → {fp}")
