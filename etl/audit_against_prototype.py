#!/usr/bin/env python3
"""把 CBDB 人物与我们现有 data.js 人物做名称匹配，产出校核报告。

用途：对齐目标第 4 步——用 CBDB 硬事实（生卒年/字号/亲属/官职/入仕）
校核现有 LLM 生成数据，标注差异，不改动 data.js。

用法:
    python3 etl/audit_against_prototype.py [--out etl/build]
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
except ImportError:  # 兜底：不做转换
    T2S = None


def t2s(name):
    return T2S.convert(name) if T2S else name


def load_prototype_persons():
    """从 prototype/data.js 提取人物节点（正则解析，避免执行未知代码）。"""
    path = os.path.join(ROOT, "prototype", "data.js")
    src = open(path, encoding="utf-8").read()
    persons = []
    # 匹配 { id: '...', name: '...', type: 'person', ... from: N, to: N, ... }
    for m in re.finditer(
        r"\{ id: '(?P<id>[^']+)', name: '(?P<name>[^']+)', type: 'person'[^}]*?"
        r"from: (?P<from>[\dnull]+), to: (?P<to>[\dnull]+)(?P<rest>[^}]*)\}",
        src, re.S,
    ):
        z = re.search(r"zi: '([^']*)'", m.group("rest"))
        p = re.search(r"polity: '([^']*)'", m.group("rest"))
        persons.append({
            "id": m.group("id"),
            "name": m.group("name"),
            "from": None if m.group("from") == "null" else int(m.group("from")),
            "to": None if m.group("to") == "null" else int(m.group("to")),
            "zi": z.group(1) if z else None,
            "polity": p.group(1) if p else None,
        })
    return persons


def load_cbdb():
    """载入 CBDB 人物，按简体名建索引。"""
    idx = {}
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            s = t2s(d["name"])
            idx.setdefault(s, []).append(d)
    return idx


def year_diff(a, b):
    if a is None or b is None:
        return None
    return abs(a - b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=BUILD)
    args = ap.parse_args()

    proto = load_prototype_persons()
    cbdb = load_cbdb()
    print(f"原型人物: {len(proto)} | CBDB 简体名索引: {len(cbdb)}")

    matched, unmatched, ambiguous = [], [], []
    for p in proto:
        key = t2s(p["name"])
        cands = cbdb.get(key, [])
        if len(cands) == 1:
            matched.append((p, cands[0]))
        elif len(cands) > 1:
            # 多人同名：用生卒年择近
            best = None
            best_d = 1e9
            for c in cands:
                d1 = year_diff(p["from"], c["birth"])
                d2 = year_diff(p["to"], c["death"])
                score = sum(x for x in (d1, d2) if x is not None) if (d1 is not None or d2 is not None) else 99
                if score < best_d:
                    best_d, best = score, c
            ambiguous.append((p, cands, best))
        else:
            unmatched.append(p)

    print(f"唯一匹配: {len(matched)} | 多名待定: {len(ambiguous)} | 未匹配: {len(unmatched)}")

    # 差异统计
    report = {
        "prototype_persons": len(proto),
        "cbdb_persons": sum(len(v) for v in cbdb.values()),
        "unique_match": len(matched),
        "ambiguous": len(ambiguous),
        "unmatched": len(unmatched),
        "birth_mismatch": [],
        "death_mismatch": [],
        "zi_mismatch": [],
    }
    for p, c in matched:
        # 允差 1 年（CBDB 与史料的年号折算常差 1）
        if p["from"] is not None and c["birth"] is not None and abs(p["from"] - c["birth"]) > 1:
            report["birth_mismatch"].append(
                {"name": p["name"], "proto": p["from"], "cbdb": c["birth"], "cbdb_id": c["cbdb_id"]})
        if p["to"] is not None and c["death"] is not None and abs(p["to"] - c["death"]) > 1:
            report["death_mismatch"].append(
                {"name": p["name"], "proto": p["to"], "cbdb": c["death"], "cbdb_id": c["cbdb_id"]})
        if p["zi"] and c["zi"] and t2s(p["zi"]) not in [t2s(z) for z in c["zi"]]:
            report["zi_mismatch"].append(
                {"name": p["name"], "proto": p["zi"], "cbdb": c["zi"], "cbdb_id": c["cbdb_id"]})

    # 我们完全没收录的 CBDB 高威望人物（candidates for 补充）
    proto_names = {t2s(p["name"]) for p in proto}
    missing_hi = []
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            if t2s(d["name"]) not in proto_names and d["prominence"] >= 6:
                missing_hi.append(d["name"])

    report["missing_prominence6"] = len(missing_hi)
    report["missing_prominence6_sample"] = missing_hi[:30]

    out = os.path.join(args.out, "audit_report.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n=== 校核结果 ===")
    print(f"生卒年不符: 生 {len(report['birth_mismatch'])} / 卒 {len(report['death_mismatch'])}")
    print(f"字号不符: {len(report['zi_mismatch'])}")
    print(f"CBDB 有而我们缺的高威望(≥6)人物: {len(missing_hi)}")
    print(f"\n报告: {out}")
    print("\n生卒差异样例:")
    for x in report["birth_mismatch"][:8]:
        print(f"  {x['name']}: 原型{x['proto']} vs CBDB{x['cbdb']}")
    print("\n字号差异样例:")
    for x in report["zi_mismatch"][:8]:
        print(f"  {x['name']}: 原型「{x['proto']}」 vs CBDB{x['cbdb']}")


if __name__ == "__main__":
    main()
