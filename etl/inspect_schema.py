#!/usr/bin/env python3
"""CBDB schema 侦察 / 核对工具。

用途：把 doc/data-model.md 里"按记忆写的" CBDB→本项目 映射，与真实 dump 对照。
输出：真实字段名、行数、以及每张映射表的可用性判定。

用法:
    python3 etl/inspect_schema.py [--db etl/data/cbdb_YYYYMMDD.sqlite3]
"""
import argparse
import glob
import os
import sqlite3
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 文档声称的映射（cbdb 表 → 本项目目标）；用于逐项核对
DOC_CLAIMED = {
    "BIOG_MAIN": "Person 基础字段、生卒年、gender",
    "ALTNAME_DATA": "Person.zi / hao / altNames",
    "CHORONYM_CODES": "郡望 → Clan.seat",
    "KIN_DATA": "Kinship",
    "KINSHIP_CODES": "亲属称谓字典",
    "POSTED_TO_OFFICE_DATA": "Appointment 官职任免",
    "OFFICE_CODES": "Office",
    "ENTRY_DATA": "Person.entryPath / entryYear",
    "BIOG_TEXT_DATA": "Work",
    "ASSOC_DATA": "PersonRelation / Discipleship",
    "ADDR_CODES": "Place",
    "BIOG_ADDR_DATA": "籍贯 / 游历（文档原漏，实为籍贯主表）",
    "DYNASTIES": "政权 code 字典",
    "STATUS_DATA": "身份 / 出身",
}

# 本次 ETL 会真正读取的表
ETL_TABLES = [
    "BIOG_MAIN", "ALTNAME_DATA", "ALTNAME_CODES", "KIN_DATA", "KINSHIP_CODES",
    "POSTED_TO_OFFICE_DATA", "OFFICE_CODES", "ENTRY_DATA", "ENTRY_CODES",
    "BIOG_ADDR_DATA", "ADDR_CODES", "BIOG_ADDR_CODES", "CHORONYM_CODES",
    "BIOG_TEXT_DATA", "ASSOC_DATA", "ASSOC_CODES", "DYNASTIES", "STATUS_DATA",
]


def find_db(explicit):
    if explicit:
        return explicit
    cands = sorted(glob.glob(os.path.join(PROJECT_ROOT, "etl", "data", "*.sqlite3")))
    if not cands:
        sys.exit("找不到 CBDB sqlite，先跑 bash etl/fetch.sh")
    return cands[-1]


def cols(con, table):
    try:
        return [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')]
    except sqlite3.Error:
        return None


def count(con, table):
    try:
        return con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    except sqlite3.Error:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db")
    args = ap.parse_args()
    db = find_db(args.db)
    print(f"# CBDB schema 核对\n\n数据库: {os.path.basename(db)}  ({os.path.getsize(db)//1024//1024} MB)\n")

    con = sqlite3.connect(db)

    print("## 1. 文档声称的映射 vs 真实表\n")
    print("| CBDB 表 | 文档目标 | 存在 | 行数 |")
    print("|---|---|---|---|")
    for t, goal in DOC_CLAIMED.items():
        exists = cols(con, t) is not None
        n = count(con, t) if exists else "-"
        print(f"| `{t}` | {goal} | {'✓' if exists else '✗ 缺'} | {n} |")

    print("\n## 2. ETL 将读取的表——真实字段\n")
    for t in ETL_TABLES:
        c = cols(con, t)
        if c is None:
            print(f"- `{t}`: **不存在**")
            continue
        n = count(con, t)
        print(f"- `{t}` ({n} 行): {', '.join(c)}")

    print("\n## 3. 政权 code（DYNASTIES，宋段相关）\n")
    print("| c_dy | 中文 | 起 | 迄 |")
    print("|---|---|---|---|")
    for row in con.execute(
        "SELECT c_dy,c_dynasty_chn,c_start,c_end FROM DYNASTIES "
        "WHERE c_dy IN (6,7,8,10,11,12,13,15,16,17) ORDER BY c_dy"
    ):
        print("| {} | {} | {} | {} |".format(*row))

    print("\n## 4. 宋代覆盖\n")
    song = con.execute("SELECT COUNT(*) FROM BIOG_MAIN WHERE c_dy=15").fetchone()[0]
    print(f"- c_dy=15 (宋): **{song}** 人")
    for dy, name in [(16, "辽"), (17, "金")]:
        n = con.execute("SELECT COUNT(*) FROM BIOG_MAIN WHERE c_dy=?", (dy,)).fetchone()[0]
        print(f"- c_dy={dy} ({name}): {n} 人")
    # 关联表里落在宋区间的人
    idx = con.execute(
        "SELECT COUNT(*) FROM BIOG_MAIN WHERE c_index_year BETWEEN 960 AND 1280"
    ).fetchone()[0]
    print(f"- index_year ∈ [960,1280]: {idx} 人")

    con.close()


if __name__ == "__main__":
    main()
