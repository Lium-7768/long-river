#!/usr/bin/env python3
"""把原型里遗漏的散文补挂到正确的库记录上，并同步 D1。

背景：merge_dataset.py 的 can_claim 逻辑过严——同名异人时一个都不给原型 id，
导致 748 篇散文没挂上。本脚本按「同名 + 生卒匹配」找回 738 篇。

用法：
    python3 etl/fix_summaries.py --local                 # 只修本地 SQLite
    python3 etl/fix_summaries.py --local --remote <ACC> <UUID>   # 同时修 D1
"""
import argparse, json, os, sqlite3, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, "etl", "fixes", "missing_summaries.json")


def lit(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def d1(acc, uuid, tok, sql):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{acc}/d1/database/{uuid}/query",
        data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        method="POST")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if "write limit" in body:
                raise SystemExit("D1 日写入额度用尽，请等 UTC 午夜后重试")
            if attempt < 2:
                time.sleep(2 ** attempt); continue
            raise RuntimeError(body[:200])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true")
    ap.add_argument("--remote", nargs=2, metavar=("ACCOUNT", "UUID"))
    ap.add_argument("--token", default=os.environ.get("CF_TOKEN", ""))
    a = ap.parse_args()
    fixes = json.load(open(FIX, encoding="utf-8"))
    print(f"待应用修复: {len(fixes)} 条")

    if a.local:
        con = sqlite3.connect(os.path.join(ROOT, "data", "lr-song.sqlite3"))
        n = 0
        for r in fixes:
            n += con.execute("UPDATE persons SET summary=? WHERE id=?",
                             (r["summary"], r["target"])).rowcount
        con.commit()
        tot = con.execute("SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL").fetchone()[0]
        print(f"本地 SQLite: 更新 {n} 行，现有 summary {tot}")

    if a.remote:
        if not a.token:
            sys.exit("需要 --token 或 CF_TOKEN")
        acc, uuid = a.remote
        for i, r in enumerate(fixes):
            d1(acc, uuid, a.token,
               f"UPDATE persons SET summary={lit(r['summary'])} WHERE id={lit(r['target'])}")
            if (i + 1) % 100 == 0:
                print(f"  D1: {i + 1}/{len(fixes)}")
        print(f"D1: 更新 {len(fixes)} 条")


if __name__ == "__main__":
    main()
