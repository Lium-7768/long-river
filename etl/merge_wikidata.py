#!/usr/bin/env python3
"""把 fetch_wikidata.py 抓取的 Wikidata 人物并入本地 SQLite。

- id：wk-{qid}（稳定、可直链 wikidata.org）
- summary：用 Wikidata 描述
- source：Wikidata Qid（可核验）
- prominence：5（有独立条目）
用法:
    python3 etl/merge_wikidata.py data/lr-song.sqlite3 etl/build/wikidata_persons.jsonl
"""
import json, sqlite3, sys, time

DB = sys.argv[1] if len(sys.argv) > 1 else "data/lr-song.sqlite3"
SRC = sys.argv[2] if len(sys.argv) > 2 else "etl/build/wikidata_persons.jsonl"

rows = [json.loads(l) for l in open(SRC, encoding="utf-8")]
print(f"读取 {len(rows)} 条 Wikidata 人物")

db = sqlite3.connect(DB)
db.execute("PRAGMA journal_mode=OFF")
existing = {r[0] for r in db.execute("SELECT id FROM persons")}
existing_names = {}
for pid, nm, dy in db.execute("SELECT id, name, dynasty_id FROM persons"):
    existing_names.setdefault((nm, dy), pid)

ins, skipped, seen = [], 0, set()
for r in rows:
    dy = r["_dynasty_id"]
    qid = r["wikidata_qid"]
    pid = f"wk-{qid}"
    if pid in existing or pid in seen:
        skipped += 1
        continue
    seen.add(pid)
    # 同名同朝已存在则跳过（避免与 CBDB 重复）
    if (r["name"], dy) in existing_names:
        skipped += 1
        continue
    ins.append((
        pid, None, r["name"], r.get("surname"),
        r.get("birth"), r.get("death"), dy, r.get("polity"),
        None, "[]", "[]", "[]",
        None, r.get("prominence", 5),
        r.get("desc"), r.get("source"),
        dy, r.get("prominence", 5) * 3,   # fame_score：按 sitelinks 知名度放大
    ))

db.executemany(
    """INSERT INTO persons
       (id,cbdb_id,name,surname,birth,death,dynasty,polity,zi,hao,shi,addr,
        role,prominence,summary,source,dynasty_id,fame_score)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", ins)
db.commit()
print(f"✓ 插入 {len(ins)}，跳过 {skipped}（已存在/同名）")

# 按朝代统计
print("\n各朝代人物数（合并后）:")
for dy, n in db.execute(
        "SELECT dynasty_id, COUNT(*) FROM persons WHERE dynasty_id IS NOT NULL "
        "GROUP BY dynasty_id ORDER BY 2 DESC"):
    print(f"  {dy}: {n}")
print(f"\n总人数: {db.execute('SELECT COUNT(*) FROM persons').fetchone()[0]}")
db.close()
