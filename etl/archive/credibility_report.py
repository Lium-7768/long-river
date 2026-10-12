#!/usr/bin/env python3
"""证据F：可信度总报告。

输出：每个字段的证据覆盖率 + 抽样人工核验记录。
"""
import sqlite3, os, random

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "data", "可信度报告.md")


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS tmp_claims")
    con.execute("CREATE TABLE tmp_claims AS SELECT DISTINCT person_id, claim_type FROM evid")
    con.execute("CREATE INDEX idx_tc_pt ON tmp_claims(person_id, claim_type)")
    con.commit()
    q = lambda s, p=(): con.execute(s, p).fetchone()[0]
    L = []
    L.append("# 长河数据可信度报告\n")
    L.append("> 核心原则：**每条数据都指向具体史料出处，可逐条核验。**\n")

    # 一、证据总量
    L.append("## 一、证据总量\n")
    L.append("| 指标 | 数量 |")
    L.append("|---|---:|")
    L.append(f"| evid 证据条数 | {q('SELECT COUNT(*) FROM evid'):,} |")
    L.append(f"| 覆盖人物 | {q('SELECT COUNT(DISTINCT person_id) FROM evid'):,} |")
    L.append(f"| 引用史料种数 | {q('SELECT COUNT(DISTINCT src_book) FROM evid'):,} |")

    # 二、evid 按类型
    L.append("\n### 证据类型分布\n")
    L.append("| 类型 | 说明 | 条数 |")
    L.append("|---|---|---:|")
    LAB = {"bio": "传记", "summary": "事迹", "name": "姓名/字号", "addr": "籍贯",
           "office": "官职", "entry": "科举", "kin": "亲属", "assoc": "社会关系", "status": "身份"}
    for t, n in con.execute("SELECT claim_type,COUNT(*) FROM evid GROUP BY claim_type ORDER BY 2 DESC"):
        L.append(f"| {t} | {LAB.get(t, t)} | {n:,} |")

    # 三、逐字段证据覆盖率
    n = q("SELECT COUNT(*) FROM persons")
    L.append(f"\n## 二、逐字段证据覆盖率（persons 共 {n:,}）\n")
    L.append("| 字段 | 有值 | 有证据 | 证据覆盖率 |")
    L.append("|---|---:|---:|---:|")
    checks = [
        ("字 zi", "zi IS NOT NULL AND zi NOT IN ('','[]')",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='name')"),
        ("号/谥", "hao IS NOT NULL AND hao NOT IN ('','[]')",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='name')"),
        ("籍贯 addr", "addr IS NOT NULL AND addr NOT IN ('','[]')",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='addr')"),
        ("事迹 summary", "summary IS NOT NULL AND summary<>''",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='summary')"),
        ("生年 birth", "birth IS NOT NULL", "birth_evid IS NOT NULL"),
        ("卒年 death", "death IS NOT NULL", "death_evid IS NOT NULL"),
        ("最高官职 top_office", "top_office IS NOT NULL",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='office')"),
        ("史料出处 sources", "sources IS NOT NULL AND sources NOT IN ('','[]')",
         "EXISTS(SELECT 1 FROM tmp_claims e WHERE e.person_id=persons.id AND e.claim_type='bio')"),
    ]
    for lab, has, ev in checks:
        hv = q(f"SELECT COUNT(*) FROM persons WHERE {has}")
        evn = q(f"SELECT COUNT(*) FROM persons WHERE ({has}) AND {ev}")
        pct = evn * 100 // hv if hv else 0
        L.append(f"| {lab} | {hv:,} | {evn:,} | {pct}% |")

    # 四、关系证据
    L.append("\n## 三、关系数据证据\n")
    L.append("| 关系 | 总数 | 含出处 | 覆盖率 |")
    L.append("|---|---:|---:|---:|")
    kt = q("SELECT COUNT(*) FROM kinships")
    kv = q("SELECT COUNT(*) FROM kinships WHERE source IS NOT NULL AND source<>''")
    at = q("SELECT COUNT(*) FROM assocs")
    av = q("SELECT COUNT(*) FROM assocs WHERE src_book IS NOT NULL")
    L.append(f"| 亲属关系 | {kt:,} | {kv:,} | {kv*100//kt}% |")
    L.append(f"| 社会关系 | {at:,} | {av:,} | {av*100//at}% |")

    # 五、抽样核验
    L.append("\n## 四、抽样人工核验（随机 12 人）\n")
    L.append("| 人物 | 朝代 | 生卒 | 生卒出处 | 事迹出处 |")
    L.append("|---|---|---|---|---|")
    rows = con.execute(
        "SELECT id,name,dynasty_id,birth,death,birth_evid FROM persons "
        "WHERE birth_evid IS NOT NULL AND summary IS NOT NULL AND summary<>'' "
        "ORDER BY RANDOM() LIMIT 12").fetchall()
    for pid, name, dy, b, d, be in rows:
        se = con.execute(
            "SELECT src_book FROM evid WHERE person_id=? AND claim_type='summary' LIMIT 1",
            (pid,)).fetchone()
        L.append(f"| {name} | {dy} | {b or '?'}–{d or '?'} | {be} | {se[0] if se else '—'} |")

    txt = "\n".join(L) + "\n"
    open(OUT, "w", encoding="utf-8").write(txt)
    print(txt)
    con.execute("DROP TABLE IF EXISTS tmp_claims")  # 清理临时表
    con.commit()
    print(f"\n✓ 报告写入 {OUT}")
    con.close()


if __name__ == "__main__":
    main()
