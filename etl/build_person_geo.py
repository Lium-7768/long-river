#!/usr/bin/env python3
"""补数据C31：人物籍贯坐标 person_geo（支撑籍贯地图）。

用 addr_geo/addr_geo_more 的地名→坐标，为 persons.addr 中每处籍贯补经纬度。
"""
import sqlite3, os, json
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    geo = {}
    for nm, lon, lat in con.execute("SELECT name,lon,lat FROM addr_geo WHERE lon<>0 AND lat<>0"):
        geo.setdefault(nm, (lon, lat))
    for nm, lon, lat in con.execute("SELECT name,lon,lat FROM addr_geo_more"):
        geo.setdefault(nm, (lon, lat))
    con.execute("DROP TABLE IF EXISTS person_geo")
    con.execute("CREATE TABLE person_geo(person_id TEXT, addr TEXT, lon REAL, lat REAL)")
    rows = []
    for pid, addr in con.execute("SELECT id,addr FROM persons WHERE addr IS NOT NULL AND addr<>'[]'"):
        try:
            arr = json.loads(addr)
        except Exception:
            continue
        for a in arr:
            nm = a if isinstance(a, str) else (a.get('name') if isinstance(a, dict) else None)
            if nm and nm in geo:
                lon, lat = geo[nm]
                rows.append((pid, nm, lon, lat))
    con.executemany("INSERT INTO person_geo VALUES (?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_pg_pid ON person_geo(person_id)")
    con.commit()
    print(f"✓ person_geo: {len(rows):,} 条（覆盖 {len({r[0] for r in rows}):,} 人）")
    for r in con.execute("SELECT p.name,g.addr,g.lon,g.lat FROM person_geo g JOIN persons p ON p.id=g.person_id LIMIT 6"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
