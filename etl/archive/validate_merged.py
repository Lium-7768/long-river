#!/usr/bin/env python3
"""校验合并后的数据集是否满足本项目 schema 约束。

检查项：id 唯一、必填字段、枚举合法、时间合理、繁简一致。
用法: python3 etl/validate_merged.py [--file etl/build/merged_persons.jsonl]
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from opencc import OpenCC
    T2S = OpenCC("t2s")
except ImportError:
    T2S = None

POLITY = {"北宋", "南宋", "两宋", "辽", "金", "西夏", "宋末元初"}
ROLE = {"帝王", "名臣", "名将", "文人", "学者", "艺技", "宗僧"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=os.path.join(ROOT, "etl", "build", "merged_persons.jsonl"))
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.file, encoding="utf-8")]
    n = len(rows)
    print(f"记录数: {n}")

    errs = {}
    def bad(k):
        errs[k] = errs.get(k, 0) + 1

    ids = {}
    for r in rows:
        i = r.get("id")
        ids[i] = ids.get(i, 0) + 1
        if not i: bad("空 id")
        if not r.get("name"): bad("空 name")
        if r.get("polity") and r["polity"] not in POLITY: bad("非法 polity")
        if r.get("role") and r["role"] not in ROLE: bad("非法 role")
        f, t = r.get("from"), r.get("to")
        if f is not None and t is not None and f > t and not r.get("approx"):
            bad("生年>卒年(未标注)")
        # 五代十国人物可早至 830；越界设 830–1300
        if f is not None and (f < 830 or f > 1300): bad("生年越界")
        if r.get("name") and re.search(r"[0-9]", r["name"]): bad("name 含数字")
        if (r.get("name") and T2S and (T2S.convert(r["name"]) if T2S else r["name"]) != r["name"]
                and r["name"] not in ("毕昇", "赵孟頫", "管道昇")):
            bad("name 含繁体")

    dups = sum(1 for v in ids.values() if v > 1)
    if dups: bad(f"重复 id ({dups})")

    print("\n=== 校验 ===")
    if not errs:
        print("✓ 全部通过")
    else:
        for k, v in errs.items():
            print(f"✗ {k}: {v}")

    # 覆盖统计
    print("\n=== 覆盖 ===")
    print(f"有 summary: {sum(1 for r in rows if r.get('summary'))}")
    print(f"有生卒:     {sum(1 for r in rows if r.get('from') and r.get('to'))}")
    print(f"有字:       {sum(1 for r in rows if r.get('zi'))}")
    print(f"有号/谥:    {sum(1 for r in rows if r.get('hao') or r.get('shi'))}")
    print(f"有官职数:   {sum(1 for r in rows if r.get('n_office'))}")
    print(f"有亲属数:   {sum(1 for r in rows if r.get('n_kin'))}")
    print(f"带 refs:    {sum(1 for r in rows if r.get('refs'))}")
    from collections import Counter
    print("polity:", dict(Counter(r.get("polity") for r in rows)))

    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
