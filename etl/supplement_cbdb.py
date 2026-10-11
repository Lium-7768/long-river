#!/usr/bin/env python3
"""补充未被 build_from_cbdb 纳入的 CBDB 人物 → 写入我们自己的表。

背景：build_from_cbdb.py 只取了 DY2DYNASTY 已映射的朝代代码，
遗漏了南北朝/五代十国/三国细分等代码（北魏1011、東晉404、南梁365、
北周288、南齊264、後漢250、三國魏191、陳178…）。

本脚本：
1. 用扩展的 DY2DYNASTY 映射，找出遗漏的「中国史」人物
2. 补入 persons（含字/号/谥/籍贯）
3. 补入 kinships / offices / entries / works
4. 按生卒细分到 22 档（nanbei/wudai/sanguo/song 等）

幂等：已存在的人跳过。
"""
import json, os, re, sqlite3, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "lr-song.sqlite3")

# 扩展映射：未映射的 CBDB 朝代代码 → 我们的 22 档（中国史），None = 不纳入
DY2DYNASTY_EXT = {
    2: "qin", 6: "tang", 19: "ming", 20: "qing", 29: "han-w", 25: "han-e",
    15: "song-w", 3: "sanguo", 4: "nanbei", 23: "jin", 5: "sui", 18: "yuan",
    16: "liao", 17: "jin-chao", 78: "xixia", 1: "zhou-e",
    # ---- 新增（此前未映射）----
    30: "nanbei",   # 北魏
    31: "nanbei",   # 北周
    32: "nanbei",   # 南齐
    35: "nanbei",   # 北齐
    40: "nanbei",   # 西魏
    41: "nanbei",   # 东魏
    44: "nanbei",   # 南梁
    24: "nanbei",   # 陈
    37: "nanbei",   # 西梁
    68: "nanbei",   # 东梁
    27: "jin",      # 东晋
    26: "sanguo",   # 三国魏
    42: "sanguo",   # 三国吴
    53: "sanguo",   # 三国蜀
    52: "wudai",    # 后汉（五代）
    47: "wudai",    # 后唐
    49: "wudai",    # 后周
    48: "wudai",    # 后晋
    34: "wudai",    # 后梁
    75: "wudai",    # 前蜀
    10: "wudai",    # 南唐
    11: "wudai",    # 吴越
    12: "wudai",    # 闽国
    13: "wudai",    # 南汉
    8:  "wudai",    # 后蜀
    9:  "wudai",    # 吴（十国）
    36: "wudai",    # 吴（杨）
    38: "wudai",    # 楚（马）
    55: "wudai",    # 南平
    66: "wudai",    # 北汉
    # 十六国 → nanbei（同一历史时期）
    39: "nanbei", 45: "nanbei", 50: "nanbei", 51: "nanbei", 56: "nanbei",
    60: "nanbei", 62: "nanbei", 63: "nanbei", 64: "nanbei", 65: "nanbei",
    69: "nanbei", 70: "nanbei", 71: "nanbei", 72: "nanbei", 73: "nanbei",
    74: "nanbei", 76: "nanbei", 87: "nanbei",
    61: "qin",      # 赢秦
    77: "tang",     # 周（武则天）→ 唐
    46: "xin",      # 新（王莽）
    28: "nanbei",   # 宋（刘裕）→ 南北朝
    57: "song-w",   # 伪齐
    82: "jin",      # 晋
    83: "han-w",    # 汉
    # ---- 域外/现代（不纳入）----
    0: None, 14: None, 21: None, 22: None, 58: None, 67: None, 84: None,
    79: None, 59: None, 81: None,
}

DY2POLITY = {2: "秦汉", 6: "唐", 19: "明", 20: "清", 29: "西汉", 25: "东汉",
             15: "宋", 3: "三国", 4: "南北朝", 23: "晋", 5: "隋", 18: "元",
             16: "辽", 17: "金", 78: "西夏", 30: "北魏", 31: "北周", 32: "南齐",
             35: "北齐", 44: "南梁", 24: "陈", 27: "东晋", 52: "后汉",
             47: "后唐", 49: "后周", 48: "后晋", 34: "后梁"}


def refine_dynasty(dy, birth, death):
    """按生卒年细分（宋→北宋/南宋；汉→西汉/东汉）"""
    y = birth or death
    if not y:
        return dy
    if dy == "song-w":
        return "song-e" if y >= 1127 else "song-w"
    if dy == "han-w":
        return "han-e" if y >= 25 else "han-w"
    return dy


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    ours = set(r[0] for r in con.execute("SELECT cbdb_id FROM persons WHERE cbdb_id IS NOT NULL"))

    # 1. 找遗漏的中国史人物
    codes = [c for c, v in DY2DYNASTY_EXT.items() if v]
    marks = ",".join("?" * len(codes))
    rows = con.execute(f"""
        SELECT c_personid, c_name_chn, c_surname_chn, c_mingzi_chn,
               c_birthyear, c_deathyear, c_dy, c_index_year, c_female
        FROM cbdb_BIOG_MAIN
        WHERE c_dy IN ({marks}) AND c_name_chn IS NOT NULL
    """, codes).fetchall()

    todo = [r for r in rows if r["c_personid"] not in ours]
    print(f"遗漏且属中国史: {len(todo):,} 人")

    # 2. 补入 persons
    added = 0
    new_ids = []
    for r in todo:
        dy = refine_dynasty(DY2DYNASTY_EXT.get(r["c_dy"]),
                            r["c_birthyear"], r["c_deathyear"])
        pid = r["c_personid"]
        new_id = f"cbdb-{pid}"
        # 幂等：按 cbdb_id 再确认
        exists = con.execute("SELECT 1 FROM persons WHERE cbdb_id=?", (pid,)).fetchone()
        if exists:
            continue
        con.execute("""INSERT INTO persons
            (id, cbdb_id, name, surname, birth, death, polity, zi, hao, shi,
             addr, role, prominence, summary, source, dynasty_id, fame_score, top_office)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (new_id, pid, r["c_name_chn"], r["c_surname_chn"],
             r["c_birthyear"] or None, r["c_deathyear"] or None,
             DY2POLITY.get(r["c_dy"]), None, None, None, None, None,
             0, None, "CBDB cbdb_20261003", dy, 0, None))
        new_ids.append(pid)
        added += 1
    con.commit()
    print(f"✓ 新增 persons: {added:,}")
    if not new_ids:
        print("无新增，退出"); con.close(); return

    # 3. 补 kinships / offices / entries / works（用 cbdb_id → our id 映射）
    idmap = {r[0]: r[1] for r in con.execute(
        "SELECT cbdb_id, id FROM persons WHERE cbdb_id IS NOT NULL")}
    keep = set(new_ids)

    # kinships
    n = 0
    for r in con.execute("SELECT c_personid, c_kin_id, c_kin_code FROM cbdb_KIN_DATA"):
        a, b = r[0], r[1]
        if a not in keep and b not in keep:
            continue
        if a in idmap and b in idmap:
            con.execute("INSERT INTO kinships VALUES (?,?,?,?)",
                        (idmap[a], idmap[b], str(r[2]), "CBDB"))
            n += 1
    con.commit(); print(f"✓ kinships: {n:,}")

    # offices
    n = 0
    for r in con.execute("SELECT c_personid, c_office_id, c_firstyear FROM cbdb_POSTED_TO_OFFICE_DATA"):
        if r[0] not in keep or r[0] not in idmap:
            continue
        con.execute("INSERT INTO offices VALUES (?,?,?)",
                    (idmap[r[0]], str(r[1]), r[2] or None))
        n += 1
    con.commit(); print(f"✓ offices: {n:,}")

    # entries
    n = 0
    for r in con.execute("SELECT c_personid, c_entry_code, c_year FROM cbdb_ENTRY_DATA"):
        if r[0] not in keep or r[0] not in idmap:
            continue
        con.execute("INSERT INTO entries VALUES (?,?,?)",
                    (idmap[r[0]], str(r[1]), r[2] or None))
        n += 1
    con.commit(); print(f"✓ entries: {n:,}")

    print("✓ 完成")
    con.close()


if __name__ == "__main__":
    main()
