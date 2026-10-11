#!/usr/bin/env python3
"""从 Wikidata 抓取「先秦—五代」人物，弥补 CBDB 覆盖空白。

CBDB 对先秦—三国覆盖极差（秦0/夏0/商0/西周0/新0/五代0），
本脚本用 Wikidata SPARQL 抓这些朝代的人物（姓名/生卒/描述/出处）。

来源可核验：每条带 Wikidata Qid（可直链 wikidata.org/entity/Qxxx）。

用法:
    python3 etl/fetch_wikidata.py -o etl/build/wikidata_persons.jsonl
"""
import argparse, json, sys, time, urllib.parse, urllib.request

try:
    from opencc import OpenCC
    _t2s = OpenCC("t2s").convert
except Exception:
    def _t2s(x):
        return x

UA = "long-river-research/1.0 (educational; contact dev@example.com)"
ENDPOINT = "https://query.wikidata.org/sparql"

# 朝代 → Wikidata 实体 + 兜底时间范围（生卒落在 [lo,hi] 且 P27=中国）
DYNASTIES = {
    "qin":     {"qid": "Q7183",   "name": "秦朝",     "range": (-300, -200)},
    "xia":     {"qid": "Q169705", "name": "夏朝",     "range": (-2200, -1500)},
    "shang":   {"qid": "Q128938", "name": "商朝",     "range": (-1700, -1000)},
    "zhou-w":  {"qid": "Q1069609","name": "西周",     "range": (-1100, -750)},
    "zhou-e":  {"qid": "Q307066", "name": "东周",     "range": (-770, -221)},
    "xin":     {"qid": "Q504769", "name": "新朝",     "range": (0, 30)},
    "wudai":   {"qid": "Q242115", "name": "五代十国", "range": (860, 980)},
    "sanguo":  {"qid": "Q185043", "name": "三国",     "range": (155, 300)},
    "xixia":   {"qid": "Q7427",   "name": "西夏",     "range": (1038, 1227)},
}


def sparql(query):
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={
        "User-Agent": UA, "Accept": "application/sparql-results+json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def val(b, k):
    return b.get(k, {}).get("value")


def _prom(links):
    """sitelinks 数 → prominence（知名度代理）。"""
    if links >= 20:
        return 8
    if links >= 8:
        return 7
    if links >= 3:
        return 6
    if links >= 1:
        return 5
    return 4


WD_STATES = {
    # 五代十国：梁唐晋汉周 + 十国（Wikidata Qid）
    "wudai": ["Q783489", "Q1143126", "Q1154540", "Q1069829", "Q1154556",
              "Q9061288", "Q1326742", "Q571453", "Q526507", "Q1198071",
              "Q1192067", "Q504759", "Q1325075", "Q1141471"],
    # 三国：曹魏 / 蜀汉 / 东吴
    "sanguo": ["Q320930", "Q320925", "Q274488"],
}


def fetch_states(qids, lo, hi):
    """按多个政权实体抓人物，并按生卒时间过滤到 [lo,hi]（负=公元前）。"""
    vals = " ".join(f"wd:{q}" for q in qids)
    def iso(y):
        return f"{'-' if y < 0 else ''}{abs(y):04d}-01-01T00:00:00Z".replace("--", "-")
    q = f"""SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {{
  VALUES ?c {{ {vals} }}
  ?p wdt:P31 wd:Q5 ; wdt:P27 ?c ; wdt:P569 ?birth .
  FILTER(?birth >= "{iso(lo)}"^^xsd:dateTime && ?birth <= "{iso(hi)}"^^xsd:dateTime)
  OPTIONAL {{ ?p wdt:P570 ?death }}
  OPTIONAL {{ ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }}
  OPTIONAL {{ ?sl schema:about ?p }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }}
}} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 500"""
    return sparql(q)


def fetch_by_p27(qid):
    """P27（所属国/朝代）直接命中。"""
    q = f"""SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {{
  ?p wdt:P27 wd:{qid} .
  ?p wdt:P31 wd:Q5 .
  OPTIONAL {{ ?p wdt:P569 ?birth }}
  OPTIONAL {{ ?p wdt:P570 ?death }}
  OPTIONAL {{ ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }}
  OPTIONAL {{ ?sl schema:about ?p }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }}
}} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 1000"""
    return sparql(q)


def fetch_by_range(lo, hi):
    """严格兜底：中国(或中国历史) + 生卒落在 [lo,hi] + 至少有 1 个 sitelink。
    注意：此查询易跨朝代误抓，故仅在 P27 命中 < 5 时用。"""
    def iso(y):
        return f"{'-' if y < 0 else ''}{abs(y):04d}-01-01T00:00:00Z".replace("--", "-")
    q = f"""SELECT ?p ?pLabel ?pDesc ?birth ?death (COUNT(?sl) AS ?links) WHERE {{
  ?p wdt:P27 wd:Q29520 ; wdt:P31 wd:Q5 ; wdt:P569 ?birth .
  FILTER(?birth >= "{iso(lo)}"^^xsd:dateTime && ?birth <= "{iso(hi)}"^^xsd:dateTime)
  OPTIONAL {{ ?p wdt:P570 ?death }}
  OPTIONAL {{ ?p schema:description ?pDesc . FILTER(lang(?pDesc)="zh") }}
  OPTIONAL {{ ?sl schema:about ?p }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh,zh-hans,zh-hant,en". }}
}} GROUP BY ?p ?pLabel ?pDesc ?birth ?death LIMIT 2000"""
    return sparql(q)


# XSD 1.1 天文纪年：无 0 年，-0209 表示公元前 210 年。
# 本项目的约定：负数=公元前。故 -0209 → -209（近似，XSD 的 -1 才是前 2 年）。
def parse_year(s):
    if not s:
        return None
    neg = s.startswith("-")
    body = s.lstrip("-")
    if len(body) < 4:
        return None
    try:
        y = int(body[:4])
    except ValueError:
        return None
    return -y if neg else y


def sane(birth, death):
    """丢弃明显不可能的日期（生 >= 卒，且不在合理范围）。"""
    if birth is not None and death is not None and birth >= death:
        return False
    for y in (birth, death):
        if y is not None and (y < -2500 or y > 2000):
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default="etl/build/wikidata_persons.jsonl")
    args = ap.parse_args()

    all_rows = {}
    for dy, meta in DYNASTIES.items():
        rows = []
        try:
            if dy in WD_STATES:
                lo, hi = meta["range"]
                rows = fetch_states(WD_STATES[dy], lo, hi)
            else:
                rows = fetch_by_p27(meta["qid"])
        except Exception as e:
            print(f"  [{dy}] P27 失败: {e}", file=sys.stderr)
        got = {}
        for b in rows:
            qid = val(b, "p").rsplit("/", 1)[-1]
            name = val(b, "pLabel")
            if not name or name.startswith("Q"):
                continue
            _b, _d = parse_year(val(b, "birth")), parse_year(val(b, "death"))
            if not sane(_b, _d):
                continue
            got[qid] = {
                "cbdb_id": None,
                "wikidata_qid": qid,
                "name": _t2s(name),
                "surname": None,
                "birth": parse_year(val(b, "birth")),
                "death": parse_year(val(b, "death")),
                "dynasty": dy,
                "polity": meta["name"],
                "desc": val(b, "pDesc"),
                "source": f"Wikidata {qid}",
                "links": int(val(b, "links") or 0),
                "prominence": _prom(int(val(b, "links") or 0)),
                "zi": [], "hao": [], "shi": [], "addr_names": [],
                "office": [], "kin": [], "entry": [], "works": [],
            }
        # 兜底时间范围（仅当 P27 几乎无命中时）
        if len(got) < 5:
            try:
                lo, hi = meta["range"]
                for b in fetch_by_range(lo, hi):
                    qid = val(b, "p").rsplit("/", 1)[-1]
                    name = val(b, "pLabel")
                    if not name or name.startswith("Q") or qid in got:
                        continue
                    if int(val(b, "links") or 0) < 1:
                        continue  # 无 sitelink 不予兜底收录
                    got[qid] = {
                        "cbdb_id": None, "wikidata_qid": qid, "name": _t2s(name),
                        "surname": None,
                        "birth": parse_year(val(b, "birth")),
                        "death": parse_year(val(b, "death")),
                        "dynasty": dy, "polity": meta["name"],
                        "desc": val(b, "pDesc"), "source": f"Wikidata {qid}",
                        "links": int(val(b, "links") or 0),
                        "prominence": _prom(int(val(b, "links") or 0)),
                        "zi": [], "hao": [], "shi": [], "addr_names": [],
                        "office": [], "kin": [], "entry": [], "works": [],
                    }
            except Exception as e:
                print(f"  [{dy}] range 失败: {e}", file=sys.stderr)
        all_rows[dy] = list(got.values())
        print(f"[{dy}] {meta['name']}: {len(got)} 人")
        time.sleep(1)

    with open(args.out, "w", encoding="utf-8") as f:
        for dy, rows in all_rows.items():
            for r in rows:
                r["_dynasty_id"] = dy
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    total = sum(len(v) for v in all_rows.values())
    print(f"\n✓ 共 {total} 人 → {args.out}")


if __name__ == "__main__":
    main()
