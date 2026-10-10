#!/usr/bin/env python3
"""把 ETL 产物导入 Cloudflare D1（通过 REST API）。

D1 免费限制：
  - 单条 SQL 语句 ≤ 100KB
  - 单次查询绑定参数 ≤ 100
  - 单次查询 30s
所以按「每批 50 行、多值 INSERT」打包，逐批 POST。

用法:
    export CF_TOKEN=...
    python3 etl/load_d1.py --account <ACC> --db <UUID> [--only persons,kinships]
"""
import argparse
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")

BATCH = 50  # 每批行数（保守，避免 100KB / 100 参数限制）


def d1_query(acc, uuid, token, sql, params=None):
    url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/d1/database/{uuid}/query"
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read())
            if d.get("success"):
                return d["result"]
            err = str(d.get("errors"))[:200]
            if "overloaded" in err.lower() or "429" in err:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(err)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise
    raise RuntimeError("重试耗尽")


MAX_SQL = 40_000  # D1 实测 statement too long 在 ~90KB，压到 40KB 保稳


def _lit(v):
    """把 Python 值转成 SQL 字面量（转义单引号）。"""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return "'" + s + "'"


def insert_batch(acc, uuid, token, table, cols, rows, log_every=2000):
    """用内联字面量打包 INSERT，按 SQL 长度分批（绕过 D1 参数上限 100）。"""
    head = f"INSERT INTO {table} ({','.join(cols)}) VALUES "
    colprefix = "(" + ",".join("?" * len(cols)) + ")"  # 仅用于估长
    n = 0
    chunk, chunk_len = [], len(head)
    for row in rows:
        tup = "(" + ",".join(_lit(v) for v in row) + ")"
        if chunk and (chunk_len + len(tup) + 1) > MAX_SQL:
            d1_query(acc, uuid, token, head + ",".join(chunk))
            n += len(chunk)
            if n % log_every < len(chunk):
                print(f"    {table}: {n}/{len(rows)}")
            chunk, chunk_len = [], len(head)
        chunk.append(tup)
        chunk_len += len(tup) + 1
    if chunk:
        d1_query(acc, uuid, token, head + ",".join(chunk))
        n += len(chunk)
    print(f"    {table}: {n}/{len(rows)}")
    return n


def load_persons(acc, uuid, token):
    rows = []
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            rows.append((
                r["id"], r.get("cbdb_id"), r["name"], r.get("surname"),
                r.get("from"), r.get("to"), r.get("dynasty"),
                r.get("polity"), r.get("zi"),
                json.dumps(r.get("hao") or [], ensure_ascii=False),
                json.dumps(r.get("shi") or [], ensure_ascii=False),
                json.dumps(r.get("addr") or [], ensure_ascii=False),
                r.get("role"), r.get("prominence"), r.get("summary"), r.get("source"),
            ))
    print(f"  persons 共 {len(rows)} 行")
    return insert_batch(acc, uuid, token, "persons",
        ["id","cbdb_id","name","surname","birth","death","dynasty","polity",
         "zi","hao","shi","addr","role","prominence","summary","source"], rows)


def load_kinships(acc, uuid, token):
    rows = []
    with open(os.path.join(BUILD, "kinship_edges.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            rows.append((r["a"], r["b"], r["rel"], r.get("source")))
    print(f"  kinships 共 {len(rows)} 行")
    return insert_batch(acc, uuid, token, "kinships", ["a","b","rel","source"], rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--account", required=True)
    ap.add_argument("--db", required=True)
    ap.add_argument("--token", default=os.environ.get("CF_TOKEN", ""))
    ap.add_argument("--only", default="persons,kinships")
    args = ap.parse_args()
    if not args.token:
        sys.exit("需要 --token 或 CF_TOKEN 环境变量")

    tables = args.only.split(",")
    t0 = time.time()
    if "persons" in tables:
        print("导入 persons:")
        print("  →", load_persons(args.account, args.db, args.token), "行")
    if "kinships" in tables:
        print("导入 kinships:")
        print("  →", load_kinships(args.account, args.db, args.token), "行")
    print(f"\n完成，耗时 {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
