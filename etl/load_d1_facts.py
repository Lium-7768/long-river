#!/usr/bin/env python3
"""导入 offices / entries / works 到 D1（需 cbdb_id → 本项目 id 映射）。

这三张表在 ETL 里以 cbdb_id 为键，导入前映射到 persons.id。
无对应人物（原型独有 183 人）的边丢弃。

用法:
    export CF_TOKEN=...
    python3 etl/load_d1_facts.py --account <ACC> --db <UUID>
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")
sys.path.insert(0, os.path.join(ROOT, "etl"))
from load_d1 import d1_query, insert_batch  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--account", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--token", default=os.environ.get("CF_TOKEN", ""))
    args = ap.parse_args()
    if not args.token:
        sys.exit("需要 --token 或 CF_TOKEN")
    acc, uuid, tok = args.account, args.db, args.token

    # cbdb_id → 项目 id
    idmap = {}
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("cbdb_id"):
                idmap[r["cbdb_id"]] = r["id"]
    print(f"映射表: {len(idmap)} 人")

    # 作品标题（从 works.jsonl 的 textid 反查）
    # CBDB 作品标题表在 sqlite 里；这里用 ETL 时保存的映射若存在，否则跳过标题
    texts = {}
    tmap_file = os.path.join(BUILD, "work_titles.json")
    if os.path.exists(tmap_file):
        texts = json.load(open(tmap_file, encoding="utf-8"))

    # ---- offices ----
    rows, drop = [], 0
    with open(os.path.join(BUILD, "appointments.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            pid = idmap.get(r.get("cbdb_id"))
            if not pid:
                drop += 1
                continue
            rows.append((pid, r.get("office"), r.get("from") or None))
    print(f"offices: {len(rows)} 行（丢 {drop}）")
    insert_batch(acc, uuid, tok, "offices", ["person_id", "office", "year"], rows)

    # ---- entries ----
    rows, drop = [], 0
    with open(os.path.join(BUILD, "entries.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            pid = idmap.get(r.get("cbdb_id"))
            if not pid:
                drop += 1
                continue
            rows.append((pid, r.get("type"), r.get("year") or None))
    print(f"entries: {len(rows)} 行（丢 {drop}）")
    insert_batch(acc, uuid, tok, "entries", ["person_id", "entry", "year"], rows)

    # ---- works ----
    rows, drop = [], 0
    with open(os.path.join(BUILD, "works.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            pid = idmap.get(r.get("cbdb_id"))
            if not pid:
                drop += 1
                continue
            tid = str(r.get("textid"))
            rows.append((pid, texts.get(tid, tid), None))
    print(f"works: {len(rows)} 行（丢 {drop}）")
    insert_batch(acc, uuid, tok, "works", ["person_id", "title", "category"], rows)

    print("完成")


if __name__ == "__main__":
    main()
