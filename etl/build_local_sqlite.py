#!/usr/bin/env python3
"""从 ETL 产物重建本地 SQLite —— 与 load_d1.py 使用完全相同的 build 文件与列映射。

保证本地库与 D1 语义一致（同源）。D1 额度受限时，本地库是权威副本。

用法:
    python3 etl/build_local_sqlite.py [-o data/lr-song.sqlite3]
"""
import argparse, json, os, sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")

SCHEMA = """
CREATE TABLE persons (
  id TEXT PRIMARY KEY, cbdb_id INTEGER, name TEXT NOT NULL, surname TEXT,
  birth INTEGER, death INTEGER, dynasty TEXT, polity TEXT, zi TEXT,
  hao TEXT, shi TEXT, addr TEXT, role TEXT, prominence INTEGER,
  summary TEXT, source TEXT);
CREATE TABLE kinships (a TEXT, b TEXT, rel TEXT, source TEXT);
CREATE TABLE offices (person_id TEXT, office TEXT, year INTEGER);
CREATE TABLE entries (person_id TEXT, entry TEXT, year INTEGER);
CREATE TABLE works (person_id TEXT, title TEXT, category TEXT);
"""


def jdump(v):
    return json.dumps(v if v is not None else [], ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default=os.path.join(ROOT, "data", "lr-song.sqlite3"))
    a = ap.parse_args()

    if os.path.exists(a.out):
        os.remove(a.out)
    con = sqlite3.connect(a.out)
    con.executescript(SCHEMA)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")

    # ---- persons（与 load_d1.load_persons 同映射）----
    rows = []
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            rows.append((r["id"], r.get("cbdb_id"), r["name"], r.get("surname"),
                         r.get("from"), r.get("to"), r.get("dynasty"), r.get("polity"),
                         r.get("zi"), jdump(r.get("hao")), jdump(r.get("shi")),
                         jdump(r.get("addr")), r.get("role"), r.get("prominence"),
                         r.get("summary"), r.get("source")))
    con.executemany("INSERT INTO persons VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    print(f"persons: {len(rows)}")

    # ---- kinships ----
    rows = []
    with open(os.path.join(BUILD, "kinship_edges.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            rows.append((r["a"], r["b"], r["rel"], r.get("source")))
    con.executemany("INSERT INTO kinships VALUES (?,?,?,?)", rows)
    print(f"kinships: {len(rows)}")

    # ---- offices / entries / works：复用 load_d1_facts 的 cbdb_id→project-id 映射 ----
    idmap = {}
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("cbdb_id") is not None:
                idmap[r["cbdb_id"]] = r["id"]

    for fn, table, cols in [
        ("appointments.jsonl", "offices", ("office",)),
        ("entries.jsonl", "entries", ("entry",)),
        ("works.jsonl", "works", ("title", "category")),
    ]:
        path = os.path.join(BUILD, fn)
        if not os.path.exists(path):
            print(f"{table}: 跳过（{fn} 不存在）")
            continue
        rows = []
        for line in open(path, encoding="utf-8"):
            r = json.loads(line)
            pid = idmap.get(r.get("cbdb_id")) or r.get("person_id")
            if not pid:
                continue
            if table == "works":
                rows.append((pid, r.get("title"), r.get("category")))
            else:
                rows.append((pid, r.get(cols[0]), r.get("year")))
        ph = ",".join(["?"] * len(rows[0]))
        con.executemany(f"INSERT INTO {table} VALUES ({ph})", rows)
        print(f"{table}: {len(rows)}")

    con.commit()
    for t in ["persons", "kinships", "offices", "entries", "works"]:
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:10} {n}")
    n = con.execute("SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL").fetchone()[0]
    print(f"  有 summary {n}")
    con.close()


if __name__ == "__main__":
    main()
