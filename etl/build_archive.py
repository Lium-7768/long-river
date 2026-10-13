#!/usr/bin/env python3
"""朝代档案（编辑层内容）→ SQLite。

数据源：etl/source/*.json（由早期 web/content/*.ts 转换而来，作为 ETL 输入归档）。
  etl/source/dynasties.json  → dynasty_meta      (朝代轴)
  etl/source/profiles.json   → dynasty_profile / dynasty_institution /
                               dynasty_event / dynasty_culture /
                               dynasty_figure / dynasty_territory
  etl/source/coverage.json   → territory_coverage (示意省份)

来源：历史常识整理（模型初稿 + 人工审校）。字段 source 保留史料出处。
"""
import json, os, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "data", "db", "lr-song.sqlite3")
SRC = os.path.join(HERE, "source")


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)


def j(v):
    return json.dumps(v, ensure_ascii=False) if v is not None else None


def main():
    dyn = load("dynasties.json")
    profiles = load("profiles.json")
    cov = load("coverage.json")

    db = sqlite3.connect(DB)
    db.executescript("""
    DROP TABLE IF EXISTS dynasty_meta;
    DROP TABLE IF EXISTS dynasty_profile;
    DROP TABLE IF EXISTS dynasty_institution;
    DROP TABLE IF EXISTS dynasty_event;
    DROP TABLE IF EXISTS dynasty_culture;
    DROP TABLE IF EXISTS dynasty_figure;
    DROP TABLE IF EXISTS dynasty_territory;
    DROP TABLE IF EXISTS territory_coverage;

    CREATE TABLE dynasty_meta (
      id TEXT PRIMARY KEY, name TEXT, start INTEGER, "end" INTEGER,
      note TEXT, color_var TEXT, ord INTEGER
    );
    CREATE TABLE dynasty_profile (
      dynasty_id TEXT PRIMARY KEY, overview TEXT,
      keywords TEXT, sources TEXT, completeness TEXT
    );
    CREATE TABLE dynasty_institution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dynasty_id TEXT, name TEXT, category TEXT,
      year INTEGER, end_year INTEGER, desc TEXT,
      background TEXT, impact TEXT, source TEXT, ord INTEGER
    );
    CREATE TABLE dynasty_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dynasty_id TEXT, name TEXT, category TEXT,
      year INTEGER, desc TEXT,
      background TEXT, outcome TEXT, impact TEXT, source TEXT, ord INTEGER
    );
    CREATE TABLE dynasty_culture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dynasty_id TEXT, name TEXT, category TEXT,
      year INTEGER, desc TEXT,
      background TEXT, impact TEXT, works TEXT, source TEXT, ord INTEGER
    );
    CREATE TABLE dynasty_figure (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dynasty_id TEXT, kind TEXT, item_name TEXT, name TEXT, person_id TEXT
    );
    CREATE TABLE dynasty_territory (
      dynasty_id TEXT PRIMARY KEY, capital TEXT, extent TEXT, note TEXT,
      bounds TEXT, divisions TEXT, neighbors TEXT,
      area TEXT, population TEXT, source TEXT
    );
    CREATE TABLE territory_coverage (
      dynasty_id TEXT PRIMARY KEY, provinces TEXT, note TEXT
    );
    CREATE INDEX idx_dinst_dyn ON dynasty_institution(dynasty_id);
    CREATE INDEX idx_devent_dyn ON dynasty_event(dynasty_id);
    CREATE INDEX idx_dcult_dyn ON dynasty_culture(dynasty_id);
    CREATE INDEX idx_dfig_dyn ON dynasty_figure(dynasty_id);
    """)

    for i, d in enumerate(dyn):
        db.execute("INSERT INTO dynasty_meta VALUES(?,?,?,?,?,?,?)",
                   (d["id"], d["name"], d["start"], d["end"],
                    d.get("note"), d.get("colorVar"), i))

    n_inst = n_evt = n_cul = n_fig = n_terr = 0
    for did, p in profiles.items():
        db.execute("INSERT INTO dynasty_profile VALUES(?,?,?,?,?)",
                   (did, p.get("overview"), j(p.get("keywords")),
                    j(p.get("sources")), p.get("completeness")))

        for k, inst in enumerate(p.get("institutions", [])):
            db.execute("""INSERT INTO dynasty_institution
                (dynasty_id,name,category,year,end_year,desc,background,impact,source,ord)
                VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (did, inst["name"], inst.get("category"), inst.get("year"),
                 inst.get("endYear"), inst.get("desc"), inst.get("background"),
                 inst.get("impact"), inst.get("source"), k))
            n_inst += 1
            for fg in inst.get("figures", []) or []:
                db.execute("INSERT INTO dynasty_figure(dynasty_id,kind,item_name,name,person_id) VALUES(?,?,?,?,?)",
                           (did, "institution", inst["name"], fg.get("name"), fg.get("personId")))
                n_fig += 1

        for k, e in enumerate(p.get("events", [])):
            db.execute("""INSERT INTO dynasty_event
                (dynasty_id,name,category,year,desc,background,outcome,impact,source,ord)
                VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (did, e["name"], e.get("category"), e.get("year"), e.get("desc"),
                 e.get("background"), e.get("outcome"), e.get("impact"), e.get("source"), k))
            n_evt += 1
            for fg in e.get("figures", []) or []:
                db.execute("INSERT INTO dynasty_figure(dynasty_id,kind,item_name,name,person_id) VALUES(?,?,?,?,?)",
                           (did, "event", e["name"], fg.get("name"), fg.get("personId")))
                n_fig += 1

        for k, c in enumerate(p.get("culture", [])):
            db.execute("""INSERT INTO dynasty_culture
                (dynasty_id,name,category,year,desc,background,impact,works,source,ord)
                VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (did, c["name"], c.get("category"), c.get("year"), c.get("desc"),
                 c.get("background"), c.get("impact"), j(c.get("works")), c.get("source"), k))
            n_cul += 1
            for fg in c.get("figures", []) or []:
                db.execute("INSERT INTO dynasty_figure(dynasty_id,kind,item_name,name,person_id) VALUES(?,?,?,?,?)",
                           (did, "culture", c["name"], fg.get("name"), fg.get("personId")))
                n_fig += 1

        t = p.get("territory")
        if t:
            db.execute("INSERT INTO dynasty_territory VALUES(?,?,?,?,?,?,?,?,?,?)",
                       (did, t.get("capital"), t.get("extent"), t.get("note"),
                        j(t.get("bounds")), j(t.get("divisions")),
                        j(t.get("neighbors")), t.get("area"), t.get("population"),
                        t.get("source")))
            n_terr += 1

    for did, c in cov.items():
        db.execute("INSERT INTO territory_coverage VALUES(?,?,?)",
                   (did, j(c.get("provinces")), c.get("note")))

    db.commit()
    print(f"✓ 朝代档案已入库：{DB}")
    print(f"  朝代轴 {len(dyn)} · 档案 {len(profiles)}")
    print(f"  制度 {n_inst} · 事件 {n_evt} · 文化 {n_cul} · 人物关联 {n_fig} · 疆域 {n_terr}")
    print(f"  疆域覆盖 {len(cov)}")
    db.close()


if __name__ == "__main__":
    main()
