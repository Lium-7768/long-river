#!/usr/bin/env python3
"""把 CBDB 硬事实附加到现有原型人物上（不覆盖，仅并列）。

产出 etl/build/enriched.jsonl：每个原型人物一条，含
  - 原型原值
  - CBDB 匹配（唯一/多名/无）
  - cbdb 事实块（生卒/字号/亲属数/官职数/入仕/威望）
  - conflicts：与原型的差异项（供 UI 标注"异说"）

原则（doc/cbdb.md §6）：
  - 不覆盖任何现有值
  - 差异以多值并列形式保留
  - 无匹配的人物标 unmatched，保留原型数据不动

用法:
    python3 etl/integrate.py [--out etl/build]
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")

try:
    from opencc import OpenCC
    T2S = OpenCC("t2s")
except ImportError:
    T2S = None


def t2s(s):
    return T2S.convert(s) if T2S else s


def load_prototype():
    src = open(os.path.join(ROOT, "prototype", "data.js"), encoding="utf-8").read()
    out = []
    for m in re.finditer(
        r"\{ id: '(?P<id>[^']+)', name: '(?P<name>[^']+)', type: 'person'[^}]*?"
        r"from: (?P<from>[\dnull]+), to: (?P<to>[\dnull]+)(?P<rest>[^}]*)\}",
        src, re.S,
    ):
        z = re.search(r"zi: '([^']*)'", m.group("rest"))
        p = re.search(r"polity: '([^']*)'", m.group("rest"))
        out.append({
            "id": m.group("id"),
            "name": m.group("name"),
            "from": None if m.group("from") == "null" else int(m.group("from")),
            "to": None if m.group("to") == "null" else int(m.group("to")),
            "zi": z.group(1) if z else None,
            "polity": p.group(1) if p else None,
        })
    return out


def load_cbdb():
    idx = {}
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            idx.setdefault(t2s(d["name"]), []).append(d)
    return idx


def pick(cands, proto):
    """多名同名时用生卒年择近。"""
    if len(cands) == 1:
        return cands[0], "unique"
    best, best_d = None, 10 ** 9
    for c in cands:
        d = 0
        n = 0
        if proto["from"] and c["birth"]:
            d += abs(proto["from"] - c["birth"]); n += 1
        if proto["to"] and c["death"]:
            d += abs(proto["to"] - c["death"]); n += 1
        score = d / n if n else 999
        if score < best_d:
            best_d, best = score, c
    return best, "ambiguous"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=BUILD)
    args = ap.parse_args()

    proto = load_prototype()
    cbdb = load_cbdb()

    enriched = []
    stat = {"unique": 0, "ambiguous": 0, "unmatched": 0,
            "with_cbdb_birth": 0, "with_cbdb_death": 0,
            "with_cbdb_office": 0, "with_cbdb_kin": 0, "with_cbdb_zi": 0,
            "with_cbdb_entry": 0, "conflicts": 0}

    for p in proto:
        rec = {"id": p["id"], "name": p["name"],
               "proto": {"from": p["from"], "to": p["to"], "zi": p["zi"], "polity": p["polity"]}}
        cands = cbdb.get(t2s(p["name"]), [])
        if not cands:
            rec["match"] = "unmatched"
            stat["unmatched"] += 1
            enriched.append(rec)
            continue
        c, how = pick(cands, p)
        rec["match"] = how
        stat[how] += 1
        rec["cbdb"] = {
            "cbdb_id": c["cbdb_id"],
            "birth": c["birth"], "death": c["death"],
            "zi": c["zi"], "hao": c["hao"], "shi": c["shi"],
            "polity": c["polity"],
            "n_office": len(c["office"]), "n_kin": len(c["kin"]),
            "n_entry": len(c["entry"]), "n_works": len(c["works"]),
            "addr_names": c.get("addr_names", []),
            "prominence": c["prominence"],
        }
        if c["birth"]:
            stat["with_cbdb_birth"] += 1
        if c["death"]:
            stat["with_cbdb_death"] += 1
        if c["office"]:
            stat["with_cbdb_office"] += 1
        if c["kin"]:
            stat["with_cbdb_kin"] += 1
        if c["zi"]:
            stat["with_cbdb_zi"] += 1
        if c["entry"]:
            stat["with_cbdb_entry"] += 1

        # 差异（多值并列，供 UI 标异说）
        conf = []
        if p["from"] and c["birth"] and abs(p["from"] - c["birth"]) > 1:
            conf.append({"field": "birth", "proto": p["from"], "cbdb": c["birth"]})
        if p["to"] and c["death"] and abs(p["to"] - c["death"]) > 1:
            conf.append({"field": "death", "proto": p["to"], "cbdb": c["death"]})
        if conf:
            rec["conflicts"] = conf
            stat["conflicts"] += 1
        enriched.append(rec)

    with open(os.path.join(args.out, "enriched.jsonl"), "w", encoding="utf-8") as f:
        for r in enriched:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # 补全候选：CBDB 高威望、原型未收录
    proto_names = {t2s(p["name"]) for p in proto}
    additions = []
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            if t2s(d["name"]) not in proto_names and d["prominence"] >= 5:
                additions.append({
                    "cbdb_id": d["cbdb_id"], "name": d["name"], "polity": d["polity"],
                    "birth": d["birth"], "death": d["death"], "zi": d["zi"],
                    "prominence": d["prominence"], "n_office": len(d["office"]),
                    "n_kin": len(d["kin"]),
                })
    with open(os.path.join(args.out, "additions_prom5.json"), "w", encoding="utf-8") as f:
        json.dump(additions, f, ensure_ascii=False, indent=1)

    print(json.dumps(stat, ensure_ascii=False, indent=2))
    print(f"\n补全候选(prom≥5, 原型未收): {len(additions)}")
    print(f"写出: {args.out}/enriched.jsonl, additions_prom5.json")


if __name__ == "__main__":
    main()
