#!/usr/bin/env python3
"""全量重建本地 SQLite —— 直接从 build_from_cbdb.py 的产物（persons.jsonl 等）。

与 build_local_sqlite.py 的区别：后者依赖 merge_dataset.py 产出的
merged_persons.jsonl（含宋代原型散文、id、from/to）。本脚本直接从
persons.jsonl 派生 id 与 from/to，适用于"多朝代全量"场景。

用法:
    python3 etl/build_sqlite_full.py --build /tmp/build-all -o data/lr-song.sqlite3
"""
import argparse, json, os, re, sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
CREATE INDEX idx_persons_dynasty ON persons(dynasty);
CREATE INDEX idx_persons_name ON persons(name);
CREATE INDEX idx_persons_prom ON persons(prominence);
CREATE INDEX idx_kinships_a ON kinships(a);
CREATE INDEX idx_offices_pid ON offices(person_id);
CREATE INDEX idx_works_pid ON works(person_id);
"""

# 拼音：优先 pypinyin，缺省退化为 "p"
try:
    from pypinyin import lazy_pinyin as _lp
except ImportError:
    _lp = None

try:
    from opencc import OpenCC
    _T2S = OpenCC("t2s")
except Exception:
    _T2S = None


def t2s(x):
    """繁体→简体（源为繁体，项目统一简体）。"""
    return _T2S.convert(x) if (x and _T2S) else x


def _pinyin2(name):
    if _lp is None:
        return "p"
    parts = "".join(_lp(name[:2]))
    return re.sub(r"[^a-z]", "", parts.lower()) or "p"


def jdump(v):
    return json.dumps(v if v is not None else [], ensure_ascii=False)


def make_id(name, cbdb_id, used):
    pyd = _pinyin2(name)
    base = f"{pyd}-{cbdb_id}" if cbdb_id is not None else f"{pyd}-x"
    cand, n = base, 2
    while cand in used:
        cand = f"{base}-{n}"
        n += 1
    used.add(cand)
    return cand


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", default="/tmp/build-all")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()
    B = args.build

    if os.path.exists(args.out):
        os.remove(args.out)
    con = sqlite3.connect(args.out)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    con.executescript(SCHEMA)

    # ---- persons ----
    used_ids = set()
    cbdb2id = {}
    rows = []
    def fix_dynasty(r):
        """c_dy=2 是「秦漢」合并，按生卒/index_year 细分 qin/han-w/han-e。"""
        dy = r.get("dynasty")
        if dy != "qin":  # 仅 2(秦汉) 需细分
            return dy
        yr = r.get("birth") or r.get("death")
        if yr is None:
            return "qin"
        if yr < -206:
            return "qin"
        if yr <= 9:
            return "han-w"
        return "han-e"

    for line in open(os.path.join(B, "persons.jsonl"), encoding="utf-8"):
        r = json.loads(line)
        r["name"] = t2s(r["name"])
        r["surname"] = t2s(r.get("surname"))
        r["dynasty"] = fix_dynasty(r)
        pid = make_id(r["name"], r.get("cbdb_id"), used_ids)
        cbdb2id[r["cbdb_id"]] = pid
        rows.append((
            pid, r.get("cbdb_id"), r["name"], r.get("surname"),
            r.get("birth"), r.get("death"), r.get("dynasty"), r.get("polity"),
            (r.get("zi") or [None])[0] if isinstance(r.get("zi"), list) else r.get("zi"),
            jdump(r.get("hao")), jdump(r.get("shi")), jdump(r.get("addr_names")),
            None, r.get("prominence"), None, "CBDB cbdb_20261003",
        ))
    con.executemany("INSERT INTO persons VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    print(f"persons: {len(rows)}")

    # ---- kinships（cbdb_id → project id）----
    rows = []
    for line in open(os.path.join(B, "kinships.jsonl"), encoding="utf-8"):
        a, b, rel, kin_name = json.loads(line)
        pa, pb = cbdb2id.get(a), cbdb2id.get(b)
        if pa and pb:
            rows.append((pa, pb, rel, kin_name))
    con.executemany("INSERT INTO kinships VALUES (?,?,?,?)", rows)
    print(f"kinships: {len(rows)}")

    # ---- offices ----
    rows = []
    for line in open(os.path.join(B, "appointments.jsonl"), encoding="utf-8"):
        r = json.loads(line)
        pid = cbdb2id.get(r.get("cbdb_id"))
        if pid and r.get("office"):
            rows.append((pid, r["office"], r.get("from")))
    con.executemany("INSERT INTO offices VALUES (?,?,?)", rows)
    print(f"offices: {len(rows)}")

    # ---- entries（字段名 type）----
    rows = []
    for line in open(os.path.join(B, "entries.jsonl"), encoding="utf-8"):
        r = json.loads(line)
        pid = cbdb2id.get(r.get("cbdb_id"))
        if pid and (r.get("type") or r.get("entry")):
            rows.append((pid, r.get("type") or r.get("entry"), r.get("year")))
    con.executemany("INSERT INTO entries VALUES (?,?,?)", rows)
    print(f"entries: {len(rows)}")

    # ---- works（textid → 标题需 work_titles.json）----
    wt = {}
    wt_path = os.path.join(B, "work_titles.json")
    if os.path.exists(wt_path):
        wt = json.load(open(wt_path, encoding="utf-8"))
    rows = []
    for line in open(os.path.join(B, "works.jsonl"), encoding="utf-8"):
        r = json.loads(line)
        pid = cbdb2id.get(r.get("cbdb_id"))
        if not pid:
            continue
        title = r.get("title")
        if not title and r.get("textid") is not None:
            title = wt.get(str(r["textid"]))
        if title:
            rows.append((pid, title, r.get("category")))
    con.executemany("INSERT INTO works VALUES (?,?,?)", rows)
    print(f"works: {len(rows)}")

    con.commit()
    for t in ["persons", "kinships", "offices", "entries", "works"]:
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:10} {n}")
    con.close()


if __name__ == "__main__":
    main()
