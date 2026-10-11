#!/usr/bin/env python3
"""数据缺口报告：自有表 vs 各数据源，逐项对齐，输出还差什么。"""
import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")


def main():
    con = sqlite3.connect(DB)
    q = lambda s: con.execute(s).fetchone()[0]

    print("═" * 64)
    print("长河数据缺口报告")
    print("═" * 64)
    n = q("SELECT COUNT(*) FROM persons")
    print(f"\n【自有表规模】")
    for t in ["persons", "kinships", "offices", "entries", "works", "texts"]:
        print(f"  {t:12} {q(f'SELECT COUNT(*) FROM {t}'):>10,}")

    print(f"\n【persons 字段覆盖】(共 {n:,})")
    for col, l in [("zi", "字"), ("hao", "号"), ("shi", "谥"), ("addr", "籍贯"),
                   ("summary", "事迹"), ("role", "身份"), ("top_office", "最高官职"),
                   ("birth", "生年"), ("death", "卒年")]:
        if col in ("zi",):
            c = q("SELECT COUNT(*) FROM persons WHERE zi IS NOT NULL AND zi<>''")
        else:
            c = q(f"SELECT COUNT(*) FROM persons WHERE {col} IS NOT NULL AND {col} NOT IN ('','[]')")
        print(f"  {l:8} {col:10} {c:>8,} ({c*100//n}%)")

    print(f"\n【CBDB 原料 vs 已提取】(库内人)")
    ids = set(r[0] for r in con.execute("SELECT cbdb_id FROM persons WHERE cbdb_id IS NOT NULL"))
    for t, col, ours in [
            ("cbdb_KIN_DATA", "c_personid", "kinships"),
            ("cbdb_POSTED_TO_OFFICE_DATA", "c_personid", "offices"),
            ("cbdb_ENTRY_DATA", "c_personid", "entries"),
            ("cbdb_BIOG_ADDR_DATA", "c_personid", "persons.addr(type1)"),
            ("cbdb_STATUS_DATA", "c_personid", "persons.role"),
            ("cbdb_ALTNAME_DATA", "c_personid", "persons.zi/hao/shi"),
            ("cbdb_ASSOC_DATA", "c_personid", "未提取"),
            ("cbdb_BIOG_TEXT_DATA", "c_personid", "works")]:
        inlib = sum(1 for (p,) in con.execute(f"SELECT {col} FROM {t}") if p in ids)
        print(f"  {t:30} {inlib:>9,} → {ours}")

    print(f"\n【仍未纳入的中国史人物】")
    print(f"  CBDB BIOG_MAIN 总: {q('SELECT COUNT(*) FROM cbdb_BIOG_MAIN'):,}")
    print(f"  我们库 cbdb_id:    {len(ids):,}")
    print(f"  差:                {q('SELECT COUNT(*) FROM cbdb_BIOG_MAIN')-len(ids):,}（多为域外/未詳/民国）")

    con.close()


if __name__ == "__main__":
    main()
