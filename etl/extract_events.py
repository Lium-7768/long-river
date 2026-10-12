#!/usr/bin/env python3
"""深度检查D：提取历史事件表 events（新维度）。

cbdb_EVENT_CODES(117) = 事件定义（名称/起止年/地点/朝代）
cbdb_EVENTS_DATA(427) = 人物参与事件（角色/年份）

→ events(event_id, name, fy, ly, dy, addr)
→ event_persons(person_id, event_id, role, year)
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

DY2D = {15: "song-w", 16: "liao", 17: "jin-chao", 18: "yuan", 19: "ming",
        20: "qing", 6: "tang", 25: "han-e", 29: "han-w", 3: "sanguo",
        4: "jin", 82: "jin", 83: "han-w", 52: "han-e"}


def main():
    con = sqlite3.connect(DB)
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    addrs = {r[0]: t2s.convert((r[1] or '').strip()) for r in con.execute("SELECT c_addr_id,c_name_chn FROM cbdb_ADDR_CODES")}

    # 事件定义
    con.execute("DROP TABLE IF EXISTS events")
    con.execute("""CREATE TABLE events (
        event_id INTEGER PRIMARY KEY, name TEXT, fy INTEGER, ly INTEGER,
        dynasty_id TEXT, addr TEXT, source TEXT
    )""")
    ev = []
    for eid, name, fy, ly, addr, dy, src in con.execute(
            "SELECT c_event_code,c_event_name_chn,c_fy_yr,c_ly_yr,c_addr_id,c_dy,c_source FROM cbdb_EVENT_CODES"):
        nm = t2s.convert((name or '').strip())
        if not nm or nm == '未詳':
            continue
        ev.append((eid, nm, fy or None, ly or None, DY2D.get(dy),
                   addrs.get(addr) if addr else None, None))
    con.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?)", ev)
    print(f"✓ events: {len(ev):,}")

    # 人物-事件
    con.execute("DROP TABLE IF EXISTS event_persons")
    con.execute("""CREATE TABLE event_persons (
        person_id TEXT, event_id INTEGER, role TEXT, year INTEGER
    )""")
    ep = []
    for pid, eid, role, year in con.execute(
            "SELECT c_personid,c_event_code,c_role,c_year FROM cbdb_EVENTS_DATA"):
        iid = idmap.get(pid)
        if not iid:
            continue
        ep.append((iid, eid, t2s.convert((role or '').strip()) or None,
                   year if year and year != 0 else None))
    con.executemany("INSERT INTO event_persons VALUES (?,?,?,?)", ep)
    con.execute("CREATE INDEX idx_ep_pid ON event_persons(person_id)")
    con.execute("CREATE INDEX idx_ep_eid ON event_persons(event_id)")
    con.commit()
    print(f"✓ event_persons: {len(ep):,}")
    print(f"  涉及人物: {con.execute('SELECT COUNT(DISTINCT person_id) FROM event_persons').fetchone()[0]:,}")
    print("\n事件样例:")
    for r in con.execute("SELECT name,fy,ly,dynasty_id FROM events ORDER BY fy LIMIT 6"):
        print(f"  {r[0]} ({r[1]}–{r[2]}) {r[3]}")
    con.close()


if __name__ == "__main__":
    main()
