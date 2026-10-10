#!/usr/bin/env python3
"""把合并后的人物集写入 prototype/data-cbdb.js（数据层，不碰 UI）。

产出 prototype/data-cbdb.js：
    const CBDB_PERSONS = [ {...}, ... ];

结构：一条精简 person 对象（对齐 data.js 既有字段），含：
  id / name / type / role / from / to / zi / hao / polity /
  source / refs / prominence / cbdb_id / summary(若有)

data.js 在加载时把 CBDB_PERSONS 合并进对应政权节点的 children。
本脚本**不修改 data.js**——合并逻辑由 data.js 自身完成（见 prototype/data.js 末尾）。

用法:
    python3 etl/write_prototype_data.py [--min-prom 0] [--out prototype/data-cbdb.js]
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")


def js_str(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")


def esc_int(v):
    return "null" if v is None else str(int(v))


def to_entry(r):
    """合并集记录 → data.js person 条目（精简，只保留有意义字段）。"""
    parts = [
        f"id: '{js_str(r['id'])}'",
        f"name: '{js_str(r['name'])}'",
        "type: 'person'",
        f"role: '{js_str(r.get('role') or '名臣')}'",
        f"from: {esc_int(r.get('from'))}",
        f"to: {esc_int(r.get('to'))}",
    ]
    if r.get("polity"):
        parts.append(f"polity: '{js_str(r['polity'])}'")
    if r.get("zi"):
        parts.append(f"zi: '{js_str(r['zi'])}'")
    if r.get("hao"):
        parts.append("hao: [" + ",".join(f"'{js_str(h)}'" for h in r["hao"]) + "]")
    if r.get("shi"):
        parts.append("shi: [" + ",".join(f"'{js_str(s)}'" for s in r["shi"]) + "]")
    if r.get("source"):
        parts.append(f"source: '{js_str(r['source'])}'")
    if r.get("prominence") is not None:
        parts.append(f"prominence: {int(r['prominence'])}")
    if r.get("approx"):
        parts.append("approx: true")
    if r.get("n_office"):
        parts.append(f"nOffice: {int(r['n_office'])}")
    if r.get("n_kin"):
        parts.append(f"nKin: {int(r['n_kin'])}")
    if r.get("addr"):
        parts.append("addr: [" + ",".join(f"'{js_str(a)}'" for a in r["addr"]) + "]")
    if r.get("summary"):
        parts.append(f"summary: '{js_str(r['summary'])}'")
    return "{ " + ", ".join(parts) + " }"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-prom", type=int, default=0)
    ap.add_argument("--out", default=os.path.join(ROOT, "prototype", "data-cbdb.js"))
    args = ap.parse_args()

    rows = []
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("prominence") is None:
                continue  # 原型独有的 183 人已在 data.js 里，不重复写
            if r["prominence"] < args.min_prom:
                continue
            rows.append(r)

    # 按 id 排序，保证 diff 稳定
    rows.sort(key=lambda r: r["id"])

    lines = []
    lines.append("/* 自动生成，勿手改 —— 由 etl/write_prototype_data.py 产出 */")
    lines.append("/* 来源：CBDB cbdb_20261003（China Biographical Database） */")
    lines.append(f"/* 条目数：{len(rows)} */")
    lines.append("const CBDB_PERSONS = [")
    for r in rows:
        lines.append("  " + to_entry(r) + ",")
    lines.append("];")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    size = os.path.getsize(args.out)
    print(f"写出 {args.out}")
    print(f"条目 {len(rows)} | 大小 {size/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
