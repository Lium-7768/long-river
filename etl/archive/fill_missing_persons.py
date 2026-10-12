#!/usr/bin/env python3
"""深度检查A：补入被 DY_INCLUDE 白名单漏掉的 CBDB 人物（~1.9万）。

漏掉原因：build_from_cbdb.py 用 c_dy 白名单，排除了：
  0=未詳 / 21=中華民國 / 22=中華人民共和國 / 84=朝鮮 / 58=韓國
  / 67=新羅 / 59=西遼 / 79=北元 / 81=鄭(王世充) / NULL

映射：
  21,22            → minguo    (民国/近代)
  84,58,67         → chaoxian  (朝鲜半岛)
  59               → liao      (西辽)
  79               → yuan      (北元)
  81               → tang      (隋末郑 617-621)
  0, NULL          → NULL      (朝代未详，仍保留)
"""
import sqlite3, os, json

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

DY_MAP = {21: "minguo", 22: "minguo", 84: "chaoxian", 58: "chaoxian",
          67: "chaoxian", 59: "liao", 79: "yuan", 81: "tang", 0: None}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    our = set(r[0] for r in con.execute("SELECT cbdb_id FROM persons WHERE cbdb_id IS NOT NULL"))

    # 缺的人
    rows = []
    for pid, name, by, dy, addr in con.execute(
            "SELECT c_personid,c_name_chn,c_birthyear,c_dy,c_deathyear FROM cbdb_BIOG_MAIN"):
        if pid in our or not name:
            continue
        rows.append((pid, name, by, dy, addr))
    print(f"待补: {len(rows):,}")

    # 引入既有 id 生成规则所需
    import re
    def slug(name):
        return re.sub(r"[^\w]", "", name)[:20]

    batch = []
    for pid, name, by, dy, addr in rows:
        dyn = DY_MAP.get(dy, None)
        nid = f"cbdb-{pid}"
        birth = by if by and by != 0 else None
        batch.append((nid, name, birth, None, dyn, pid))

    # 卒年单独
    deaths = {}
    for pid, dy in con.execute("SELECT c_personid,c_deathyear FROM cbdb_BIOG_MAIN"):
        if dy and dy != 0:
            deaths[pid] = dy

    ins = []
    for nid, name, birth, _, dyn, pid in batch:
        ins.append((nid, name, birth, deaths.get(pid, None), dyn, pid, 0))
    con.executemany(
        "INSERT OR IGNORE INTO persons (id,name,birth,death,dynasty_id,cbdb_id,prominence) "
        "VALUES (?,?,?,?,?,?,?)", ins)
    con.commit()
    print(f"✓ 补入 persons: {len(ins):,}")
    print("persons 总数:", con.execute("SELECT COUNT(*) FROM persons").fetchone()[0])
    for d in ["minguo", "chaoxian", "liao", "yuan", "tang"]:
        n = con.execute("SELECT COUNT(*) FROM persons WHERE dynasty_id=?", (d,)).fetchone()[0]
        print(f"  {d}: {n:,}")
    print("  未详(NULL):", con.execute("SELECT COUNT(*) FROM persons WHERE dynasty_id IS NULL").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main()
