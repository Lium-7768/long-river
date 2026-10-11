#!/usr/bin/env python3
"""CBDB → long-river ETL。

产物（写入 etl/build/）：
  persons.jsonl   全部宋代人物（含生卒/字号/籍贯/威望分层）
  kinships.jsonl  亲属边（双向）
  appointments.jsonl  官职任免
  offices.json     官职字典（宋段用到的）
  places.json      地名（宋段人物涉及）
  entries.jsonl    入仕记录
  works.jsonl      著作（BIOG_TEXT_DATA）
  stats.json       覆盖率 / 分层统计

设计原则（对齐 doc/requirements.md §8）：
  - 硬事实（生卒年/字号/亲属/官职/入仕）以 CBDB 为准
  - 只做映射与清洗，不生成任何内容
  - prominence 分层供 UI 决定"谁上时间轴"，不丢数据

用法:
    python3 etl/build_from_cbdb.py [--db ...] [--out etl/build]
"""
import argparse
import glob
import json
import os
import sqlite3
import sys

try:
    from opencc import OpenCC
    _T2S = OpenCC("t2s")
except ImportError:
    _T2S = None


def t2s(x):
    """繁体→简体（CBDB 源为繁体；项目统一简体）。"""
    if not x:
        return x
    return _T2S.convert(x) if _T2S else x

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 宋段相关政权：宋15 辽16 金17 + 并入宋的十国
# 宋代及其并立政权 + 秦汉唐明清（本次扩展）
# 15宋 16辽 17金 78西夏 8后蜀 10南唐 11吴越 12闽 13南汉 7五代
# 2秦汉 6唐 19明 20清 29西汉 25东汉
# 15宋 16辽 17金 78西夏 8后蜀 10南唐 11吴越 12闽 13南汉 7五代
# 2秦汉 6唐 19明 20清 29西汉 25东汉
# 新增：3三国 4南北朝 23西晋 5隋 18元 1汉前 14高丽
DY_INCLUDE = (15, 16, 17, 78, 8, 10, 11, 12, 13, 7, 2, 6, 19, 20, 29, 25,
              3, 4, 23, 5, 18, 1, 14)

# CBDB 政权 code → 本项目 polity 枚举
DY2POLITY = {
    15: "宋", 16: "辽", 17: "金", 78: "西夏",
    8: "后蜀", 10: "南唐", 11: "吴越", 12: "闽", 13: "南汉", 7: "五代",
    2: "秦汉", 6: "唐", 19: "明", 20: "清", 29: "西汉", 25: "东汉",
    3: "三国", 4: "南北朝", 23: "晋", 5: "隋", 18: "元", 1: "汉前", 14: "高丽",
}

# 本项目朝代 id（dynasties.ts）← CBDB 朝代码
DY2DYNASTY = {
    2: "qin",       # 秦汉（CBDB 未细分，由 build_sqlite_full 按生卒细分）
    6: "tang",
    19: "ming",
    20: "qing",
    29: "han-w",
    25: "han-e",
    15: "song-w",   # 宋：本项目已拆宋北宋南，由 split 按年份细分
    3: "sanguo",
    4: "nanbei",
    23: "jin",
    5: "sui",
    18: "yuan",
    16: "liao",
    17: "jin-chao",
    78: "xixia",
    1: "zhou-e",    # 汉前（先秦：孔丘等，归东周/春秋战国）
    14: "gaoli",    # 高丽（域外，暂存）
}


def find_db(explicit):
    if explicit:
        return explicit
    cands = sorted(glob.glob(os.path.join(ROOT, "etl", "data", "*.sqlite3")))
    if not cands:
        sys.exit("找不到 CBDB sqlite，先跑 bash etl/fetch.sh")
    return cands[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db")
    ap.add_argument("--out", default=os.path.join(ROOT, "etl", "build"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    con = sqlite3.connect(find_db(args.db))
    con.row_factory = sqlite3.Row

    dy_marks = ",".join(str(d) for d in DY_INCLUDE)
    print(f"==> 筛选政权 {DY_INCLUDE}")

    # ---------- 1. 人物主表 ----------
    print("==> 读取 BIOG_MAIN")
    persons = {}
    for r in con.execute(f"""
        SELECT c_personid, c_name_chn, c_surname_chn, c_mingzi_chn,
               c_birthyear, c_deathyear, c_dy, c_choronym_code, c_index_year,
               c_female
        FROM BIOG_MAIN WHERE c_dy IN ({dy_marks}) AND c_name_chn IS NOT NULL
    """):
        pid = r["c_personid"]
        persons[pid] = {
            "cbdb_id": pid,
            "name": r["c_name_chn"],
            "surname": r["c_surname_chn"],
            "mingzi": r["c_mingzi_chn"],
            "birth": r["c_birthyear"],
            "death": r["c_deathyear"],
            "dy": r["c_dy"],
            "polity": DY2POLITY.get(r["c_dy"], "宋"),
            "dynasty": DY2DYNASTY.get(r["c_dy"]),
            "choronym_code": r["c_choronym_code"],
            "female": bool(r["c_female"]),
            "zi": [], "hao": [], "shi": [], "other_names": [],
            "addr": [], "office": [], "kin": [], "entry": [], "works": [],
            "prominence": 0,
        }
    print(f"    人物 {len(persons)}")

    def keep_only(pids):
        keep = set(pids)
        con.execute("CREATE TEMP TABLE keep(c_personid INTEGER PRIMARY KEY)")
        con.executemany("INSERT INTO keep VALUES(?)", ((p,) for p in keep))

    keep_only(persons.keys())

    # ---------- 2. 字号 / 谥 / 别号 ----------
    print("==> ALTNAME_DATA")
    TYPE_MAP = {"字": "zi", "諡號": "shi", "室名、別號": "hao", "別名": "other_names",
                "别名": "other_names", "小名": "other_names", "法號": "hao", "法号": "hao"}
    for r in con.execute("""
        SELECT a.c_personid, a.c_alt_name_chn, c.c_name_type_desc_chn
        FROM ALTNAME_DATA a JOIN keep k ON a.c_personid=k.c_personid
        LEFT JOIN ALTNAME_CODES c ON a.c_alt_name_type_code=c.c_name_type_code
        WHERE a.c_alt_name_chn IS NOT NULL
    """):
        p = persons.get(r["c_personid"])
        if not p:
            continue
        bucket = TYPE_MAP.get(r["c_name_type_desc_chn"])
        if bucket and r["c_alt_name_chn"] not in p[bucket]:
            p[bucket].append(r["c_alt_name_chn"])

    # ---------- 3. 亲属 ----------
    print("==> KIN_DATA")
    kin_rows = []
    for r in con.execute("""
        SELECT k.c_personid, k.c_kin_id, kc.c_kinrel_chn, b.c_name_chn AS kin_name
        FROM KIN_DATA k JOIN keep kk ON k.c_personid=kk.c_personid
        LEFT JOIN KINSHIP_CODES kc ON k.c_kin_code=kc.c_kincode
        LEFT JOIN BIOG_MAIN b ON k.c_kin_id=b.c_personid
    """):
        p = persons.get(r["c_personid"])
        if not p:
            continue
        rel = r["c_kinrel_chn"] or ""
        p["kin"].append({"rel": rel, "kin_id": r["c_kin_id"], "kin_name": r["kin_name"]})
        kin_rows.append((r["c_personid"], r["c_kin_id"], rel, r["kin_name"]))

    # ---------- 4. 官职 ----------
    print("==> POSTED_TO_OFFICE_DATA")
    offices_used = {}
    for r in con.execute("""
        SELECT p.c_personid, p.c_office_id, o.c_office_chn, p.c_firstyear, p.c_lastyear
        FROM POSTED_TO_OFFICE_DATA p JOIN keep k ON p.c_personid=k.c_personid
        LEFT JOIN OFFICE_CODES o ON p.c_office_id=o.c_office_id
    """):
        person = persons.get(r["c_personid"])
        if not person or not r["c_office_chn"]:
            continue
        person["office"].append({
            "office": t2s(r["c_office_chn"]), "from": r["c_firstyear"], "to": r["c_lastyear"],
        })
        oid = r["c_office_id"]
        if oid not in offices_used:
            offices_used[oid] = t2s(r["c_office_chn"])

    # ---------- 5. 籍贯 / 地址 ----------
    print("==> BIOG_ADDR_DATA")
    places_used = {}
    for r in con.execute("""
        SELECT b.c_personid, b.c_addr_id, b.c_addr_type, a.c_name_chn,
               bc.c_addr_desc_chn, b.c_firstyear, b.c_lastyear
        FROM BIOG_ADDR_DATA b JOIN keep k ON b.c_personid=k.c_personid
        LEFT JOIN ADDR_CODES a ON b.c_addr_id=a.c_addr_id
        LEFT JOIN BIOG_ADDR_CODES bc ON b.c_addr_type=bc.c_addr_type
        WHERE a.c_name_chn IS NOT NULL
    """):
        p = persons.get(r["c_personid"])
        if not p:
            continue
        p["addr"].append({
            "place": r["c_name_chn"], "type": r["c_addr_desc_chn"],
            "from": r["c_firstyear"], "to": r["c_lastyear"], "addr_id": r["c_addr_id"],
        })
        places_used[r["c_addr_id"]] = r["c_name_chn"]

    # ---------- 6. 入仕 ----------
    print("==> ENTRY_DATA")
    for r in con.execute("""
        SELECT e.c_personid, e.c_entry_code, e.c_year, ec.c_entry_desc_chn
        FROM ENTRY_DATA e JOIN keep k ON e.c_personid=k.c_personid
        LEFT JOIN ENTRY_CODES ec ON e.c_entry_code=ec.c_entry_code
    """):
        p = persons.get(r["c_personid"])
        if p:
            p["entry"].append({"type": t2s(r["c_entry_desc_chn"]), "year": r["c_year"]})

    # ---------- 7. 著作 ----------
    print("==> BIOG_TEXT_DATA")
    works_rows = []
    for r in con.execute("""
        SELECT t.c_textid, t.c_personid, t.c_role_id, t.c_year
        FROM BIOG_TEXT_DATA t JOIN keep k ON t.c_personid=k.c_personid
    """):
        p = persons.get(r["c_personid"])
        if p:
            p["works"].append({"textid": r["c_textid"], "role": r["c_role_id"], "year": r["c_year"]})
            works_rows.append((r["c_textid"], r["c_personid"], r["c_role_id"], r["c_year"]))

    # ---------- 8. prominence 分层 ----------
    print("==> 计算 prominence")
    STAT = {"person": 1, "office": 1, "kin": 1, "works": 1, "entry": 1, "zi": 1}
    for p in persons.values():
        s = 0
        if p["birth"] is not None and p["death"] is not None:
            s += 1  # 完整生卒
        for k, v in STAT.items():
            if p.get(k):
                s += v
        p["prominence"] = s
        # 精简：地址只保留去重后的地名词
        seen = []
        for a in p["addr"]:
            if a["place"] not in seen:
                seen.append(a["place"])
        p["addr_names"] = seen

    # 分层统计
    tiers = {}
    for p in persons.values():
        tiers[p["prominence"]] = tiers.get(p["prominence"], 0) + 1

    # ---------- 输出 ----------
    print("==> 写出")
    with open(os.path.join(args.out, "persons.jsonl"), "w", encoding="utf-8") as f:
        for p in persons.values():
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    with open(os.path.join(args.out, "kinships.jsonl"), "w", encoding="utf-8") as f:
        for row in kin_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    with open(os.path.join(args.out, "appointments.jsonl"), "w", encoding="utf-8") as f:
        for p in persons.values():
            for o in p["office"]:
                f.write(json.dumps({"person": p["name"], "cbdb_id": p["cbdb_id"], **o},
                                   ensure_ascii=False) + "\n")

    with open(os.path.join(args.out, "entries.jsonl"), "w", encoding="utf-8") as f:
        for p in persons.values():
            for e in p["entry"]:
                f.write(json.dumps({"person": p["name"], "cbdb_id": p["cbdb_id"], **e},
                                   ensure_ascii=False) + "\n")

    with open(os.path.join(args.out, "works.jsonl"), "w", encoding="utf-8") as f:
        for row in works_rows:
            f.write(json.dumps({"textid": row[0], "cbdb_id": row[1], "role": row[2],
                                "year": row[3]}, ensure_ascii=False) + "\n")

    with open(os.path.join(args.out, "offices.json"), "w", encoding="utf-8") as f:
        json.dump(offices_used, f, ensure_ascii=False, indent=1)

    with open(os.path.join(args.out, "places.json"), "w", encoding="utf-8") as f:
        json.dump(places_used, f, ensure_ascii=False, indent=1)

    stats = {
        "cbdb_source": os.path.basename(find_db(args.db)),
        "persons": len(persons),
        "with_birth_death": sum(1 for p in persons.values() if p["birth"] and p["death"]),
        "with_office": sum(1 for p in persons.values() if p["office"]),
        "with_kin": sum(1 for p in persons.values() if p["kin"]),
        "with_zi": sum(1 for p in persons.values() if p["zi"]),
        "with_entry": sum(1 for p in persons.values() if p["entry"]),
        "with_works": sum(1 for p in persons.values() if p["works"]),
        "kinship_edges": len(kin_rows),
        "offices": len(offices_used),
        "places": len(places_used),
        "prominence_tiers": dict(sorted(tiers.items(), reverse=True)),
        "tier_ge5": sum(v for k, v in tiers.items() if k >= 5),
        "tier_ge4": sum(v for k, v in tiers.items() if k >= 4),
        "polity_counts": {},
    }
    pc = {}
    for p in persons.values():
        pc[p["polity"]] = pc.get(p["polity"], 0) + 1
    stats["polity_counts"] = pc
    with open(os.path.join(args.out, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    con.close()
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
