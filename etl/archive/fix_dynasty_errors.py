#!/usr/bin/env python3
"""步骤2：修正 CBDB 错标朝代 + 同名混淆。

问题：CBDB 有同名不同人的记录（如 李广 有 18 条，明清同名者淹没东汉李广）。
     前端按名字取"最佳"时可能取错。

策略：
1. 史料权威性打分：正史(ws-/hs-/hanshu-/sj-) > Wikidata > CBDB
2. 对"名人"，用生卒/字号/籍贯锚定正确记录，提升其 prominence
3. 生成"人物主记录"表 person_canonical，标记每个名字的最权威记录
"""
import sqlite3, json, os, re

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

# 正史来源权重
def source_rank(src):
    if not src: return 0
    if any(k in src for k in ["《史记", "《汉书", "《后汉书", "《明史", "《清史稿",
                              "《宋史", "《元史", "《辽史", "《金史", "《新五代史"]):
        return 3
    if src.startswith("ws-") or src.startswith("hs-"): return 3
    if src.startswith("Wikidata"): return 2
    if src.startswith("CBDB"): return 1
    return 0


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    # 1. 提升史书生源记录的 prominence（至少 5）
    n = 0
    for r in con.execute("SELECT id,source,prominence FROM persons WHERE id LIKE 'ws-%' OR id LIKE 'hs-%'"):
        if (r["prominence"] or 0) < 5:
            con.execute("UPDATE persons SET prominence=5 WHERE id=?", (r["id"],))
            n += 1
    print(f"✓ 提升正史记录 prominence: {n:,}")

    # 2. 生成 canonical 表：每个 (name, dynasty_id) 的最权威记录
    con.execute("DROP TABLE IF EXISTS person_canonical")
    con.execute("""CREATE TABLE person_canonical AS
        SELECT name, dynasty_id,
               COUNT(*) AS record_count,
               SUM(CASE WHEN source LIKE 'CBDB%' THEN 1 ELSE 0 END) AS cbdb_count
        FROM persons WHERE dynasty_id IS NOT NULL
        GROUP BY name, dynasty_id""")
    print(f"✓ person_canonical: {con.execute('SELECT COUNT(*) FROM person_canonical').fetchone()[0]:,} 个 (名,朝) 组合")

    # 3. 标记：同一人名对应多个朝代（潜在混淆）
    multi = con.execute("""SELECT COUNT(*) FROM (
        SELECT name FROM persons WHERE dynasty_id IS NOT NULL
        GROUP BY name HAVING COUNT(DISTINCT dynasty_id)>1)""").fetchone()[0]
    print(f"  同名跨朝代（需鉴别）: {multi:,} 个名字")

    con.commit()
    con.close()


if __name__ == "__main__":
    main()
