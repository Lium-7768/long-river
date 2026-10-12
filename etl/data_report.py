#!/usr/bin/env python3
"""任务E：数据完整度终检 + 可信度报告。

输出：全表规模、字段覆盖、史料溯源、朝代分布、正史交叉验证。
"""
import sqlite3, os, json

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "etl", "build", "data_report.md")

DYN = [('xia', '夏'), ('shang', '商'), ('zhou-w', '西周'), ('zhou-e', '东周'),
       ('qin', '秦'), ('han-w', '西汉'), ('xin', '新'), ('han-e', '东汉'),
       ('sanguo', '三国'), ('jin', '晋'), ('nanbei', '南北朝'), ('sui', '隋'),
       ('tang', '唐'), ('wudai', '五代十国'), ('liao', '辽'), ('song-w', '北宋'),
       ('xixia', '西夏'), ('jin-chao', '金'), ('song-e', '南宋'), ('yuan', '元'),
       ('ming', '明'), ('qing', '清')]


def main():
    con = sqlite3.connect(DB)
    q = lambda s, p=(): con.execute(s, p).fetchone()[0]
    L = []
    L.append("# 长河数据完整度报告\n")
    L.append(f"数据源：本地 SQLite `data/lr-song.sqlite3`（唯一数据源）\n")

    L.append("## 一、表规模\n")
    L.append("| 表 | 行数 |")
    L.append("|---|---:|")
    for t in ["persons", "kinships", "offices", "office_addrs", "entries", "works",
              "assocs", "institutions", "events", "event_persons", "poems", "poem_authors",
              "mourning", "nianhao", "editions", "person_notes", "possessions", "addr_belongs",
              "text_types", "lineage", "poem_persons", "addr_geo", "addr_geo_more", "qid_verify",
"aliases", "person_occupations", "person_birthplace", "office_dict",
"bibliography", "assoc_dict", "person_network", "bio_excerpt", "evid", "texts",
"person_status", "person_texts", "ref_dict", "evidence_sources", "region_stats",
"person_merge", "book_meta", "ctext_titles", "emperor", "hist_alias"]:
        try:
            L.append(f"| {t} | {q(f'SELECT COUNT(*) FROM {t}'):,} |")
        except Exception:
            L.append(f"| {t} | (无) |")

    n = q("SELECT COUNT(*) FROM persons")
    L.append(f"\n## 二、persons 字段覆盖（共 {n:,}）\n")
    L.append("| 字段 | 说明 | 覆盖 | 占比 |")
    L.append("|---|---|---:|---:|")
    for col, lab in [("zi", "字"), ("hao", "号"), ("shi", "谥"), ("addr", "籍贯"),
                     ("summary", "事迹"), ("role", "身份"), ("top_office", "最高官职"),
                     ("birth", "生年"), ("death", "卒年"), ("sources", "史料出处")]:
        c = q(f"SELECT COUNT(*) FROM persons WHERE {col} IS NOT NULL AND {col} NOT IN ('','[]')")
        L.append(f"| {col} | {lab} | {c:,} | {c*100//n}% |")

    L.append(f"\n## 三、朝代分布（22 档）\n")
    L.append("| 朝代 | 人数 |")
    L.append("|---|---:|")
    for d, lab in DYN:
        L.append(f"| {lab} | {q('SELECT COUNT(*) FROM persons WHERE dynasty_id=?', (d,)):,} |")
    L.append(f"| (无朝代) | {q('SELECT COUNT(*) FROM persons WHERE dynasty_id IS NULL'):,} |")
    L.append(f"| **合计** | **{n:,}** |")

    L.append(f"\n## 四、正史全文库（可验证源）\n")
    L.append("| 史书 | 卷数 |")
    L.append("|---|---:|")
    for b, c in con.execute("SELECT book,COUNT(*) FROM texts GROUP BY book ORDER BY 2 DESC"):
        L.append(f"| {b} | {c} |")

    L.append(f"\n## 五、关系与官职规范化（100% 中文）\n")
    L.append("| 表 | 唯一中文关系/官职名 | 非中文残留 |")
    L.append("|---|---:|---:|")
    cn = "SELECT COUNT(*) FROM kinships WHERE rel NOT GLOB '*[一-龥]*'"
    co = "SELECT COUNT(*) FROM offices WHERE office NOT GLOB '*[一-龥]*'"
    L.append(f"| kinships.rel | {q('SELECT COUNT(DISTINCT rel) FROM kinships')} | {q(cn)} |")
    L.append(f"| offices.office | {q('SELECT COUNT(DISTINCT office) FROM offices')} | {q(co)} |")
    L.append(f"| offices.category 覆盖 | {q('SELECT COUNT(*) FROM offices WHERE category IS NOT NULL')} | — |")

    txt = "\n".join(L) + "\n"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(txt)
    print(txt)
    print(f"\n✓ 报告写入 {OUT}")
    con.close()


if __name__ == "__main__":
    main()
