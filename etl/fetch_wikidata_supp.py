#!/usr/bin/env python3
"""第二轮 Wikidata 扩充：针对覆盖薄弱的朝代再抓一批。

比 fetch_wikidata.py 的 P27 直连更宽：
- 东周：用「东周体系政权」+ 生年过滤（去秦末/楚汉污染）
- 辽/金/隋/宋/元：P27 直连各朝实体（补 CBDB 漏收者）

输出格式与 fetch_wikidata.py 一致，供 merge_wikidata.py 复用。
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
    if not s or not s[0].isdigit() and s[0] != "-":
        return None
    neg = s.startswith("-")
    body = s.lstrip("-")
    if len(body) < 4 or not body[:4].isdigit():
        return None
    y = int(body[:4])
    return -y if neg else y


def prom(links):
    return 8 if links >= 20 else 7 if links >= 8 else 6 if links >= 3 else 5 if links >= 1 else 4


def sane(b, d):
    if b is not None and d is not None and b >= d:
        return False
    return all(y is None or -2500 <= y <= 2000 for y in (b, d))


# 东周：东周体系政权 + 生年 ∈ [前770, 前230]（前230 后属秦末）
Q_ZHOU_E = """SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {
  ?p wdt:P31 wd:Q5 .
  { ?p wdt:P27 ?c . ?c wdt:P361 wd:Q307066 } UNION { ?p wdt:P27 wd:Q307066 }
  ?p wdt:P569 ?birth .
  FILTER(?birth >= "-0770-01-01T00:00:00Z"^^xsd:dateTime
      && ?birth <= "-0230-01-01T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?p wdt:P570 ?death }
  OPTIONAL { ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }
  OPTIONAL { ?sl schema:about ?p }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }
} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 800"""

# 各朝 P27 直连
Q_BY_QID = """SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {{
  ?p wdt:P27 wd:{qid} ; wdt:P31 wd:Q5 .
  OPTIONAL {{ ?p wdt:P569 ?birth }}
  OPTIONAL {{ ?p wdt:P570 ?death }}
  FILTER(!BOUND(?death) || (?death >= "{dlo}"^^xsd:dateTime && ?death <= "{dhi}"^^xsd:dateTime))
  OPTIONAL {{ ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }}
  OPTIONAL {{ ?sl schema:about ?p }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }}
}} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 1500"""

# (qid, name, 生年下限, 生年上限)  —— 生年窗口用于剔除跨代污染
# (qid, name, 卒年下限, 卒年上限)
PLAN = {
    "zhou-e":   ("__zhou_e__", "东周",    "-0770", "-0200"),
    "liao":     ("Q4958", "辽朝",         "0850", "1140"),
    "jin-chao": ("Q5066", "金朝",         "1060", "1280"),
    "sui":      ("Q7405", "隋朝",         "0500", "0660"),
    "song-w":   ("Q7462", "宋朝",         "0880", "1150"),
    "yuan":     ("Q7313", "元朝",         "1160", "1390"),
}

rows_out = []
def iso(y):
    return f"{'-' if y.startswith('-') else ''}{y.lstrip('-').zfill(4)}-01-01T00:00:00Z".replace("--", "-")


for dy, (qid, name, lo, hi) in PLAN.items():
    query = (Q_ZHOU_E if qid == "__zhou_e__"
             else Q_BY_QID.format(qid=qid, dlo=iso(lo), dhi=iso(hi)))
    try:
        res = sparql(query)
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
        rows_out.append({
            "cbdb_id": None, "wikidata_qid": q, "name": _t2s(nm), "surname": None,
            "birth": bb, "death": dd, "dynasty": dy, "polity": name,
            "desc": _t2s(val(b, "pDesc") or ""), "source": f"Wikidata {q}",
            "links": int(val(b, "links") or 0),
            "prominence": prom(int(val(b, "links") or 0)),
            "zi": [], "hao": [], "shi": [], "addr_names": [],
            "office": [], "kin": [], "entry": [], "works": [],
            "_dynasty_id": dy,
        })
    print(f"[{dy}] {name}: {n} 人")
    time.sleep(1)

# ---- 后过滤：剔除跨代污染 ----
DY_NAMES = {
    "秦": "qin", "汉": "han", "唐": "tang", "宋": "song", "元": "yuan",
    "明": "ming", "清": "qing", "隋": "sui", "晋": "jin", "魏": "sanguo",
    "蜀": "sanguo", "吴": "sanguo", "辽": "liao", "金": "jin-chao", "夏": "xixia",
}
def wrong_dynasty(rec, dy):
    d = rec.get("desc") or ""
    for kw, code in list(DY_NAMES.items()):
        if code == dy:
            continue
        # desc 形如「中国明代皇帝」→ 点名的朝代 ≠ 当前桶
        if ("朝" in d or "代" in d) and kw in d:
            # 允许「先秦」等模糊词
            if kw in ("汉",) and "先秦" in d:
                continue
            return kw
    return None

before = len(rows_out)
rows_out = [r for r in rows_out
            if (r["birth"] is not None or r["death"] is not None)
            and wrong_dynasty(r, r["_dynasty_id"]) is None]
print(f"后过滤: {before} → {len(rows_out)}（剔除无生卒/跨代 {before-len(rows_out)}）")

out = sys.argv[2] if len(sys.argv) > 2 else "etl/build/wikidata_supp.jsonl"
with open(out, "w", encoding="utf-8") as f:
    for r in rows_out:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"\n✓ 共 {len(rows_out)} 人 → {out}")
