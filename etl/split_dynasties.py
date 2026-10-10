#!/usr/bin/env python3
"""
把 persons.polity 按时间拆到更细的朝代上。

背景：
- 导入的 CBDB 数据 98.5% 标为 polity='两宋'（一个大桶，含唐末五代~宋末）
- 北宋/南宋 字段各自只有 32/111 人，几乎不可用
- dynasty 字段全空
- 只有 8% 有 birth，但 entries.year 覆盖 40534 人

拆分规则（保守，不臆断）：
1. 辽/金/西夏/南宋/北宋 等已有明确 polity 的，保留（这些是 CBDB 给的，可信）
2. polity='两宋' 的人：
   a. 有 birth → 按 birth 归入 北宋(960-1127) / 南宋(1127-1279)
   b. 无 birth 但有 entries.year → 用最早 entry year 推定
   c. 都没有 → 保留 '两宋'（不臆断）
3. 新增 dynasty_id 字段存粗分结果，不覆盖原 polity（原始数据保留）
"""
import sqlite3
import sys

DB = sys.argv[1] if len(sys.argv) > 1 else 'data/lr-song.sqlite3'

# 朝代边界（与 web/content/dynasties.ts 一致）
RANGES = [
    ('song-w', '北宋', 960, 1127),
    ('song-e', '南宋', 1127, 1279),
]

def classify_by_year(y):
    """年份 → dynasty_id；不落在宋代范围返回 None"""
    if y is None:
        return None
    for did, name, a, b in RANGES:
        if a <= y < b:
            return did
    return None

def main():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row

    # 加字段
    cols = [r[1] for r in db.execute("PRAGMA table_info(persons)")]
    if 'dynasty_id' not in cols:
        db.execute("ALTER TABLE persons ADD COLUMN dynasty_id TEXT")
        print("✓ 新增 dynasty_id 字段")

    # 1. 先给已有明确 polity 的直接映射
    polity_map = {
        '辽': 'liao', '金': 'jin-chao', '西夏': 'xixia',
        '北宋': 'song-w', '南宋': 'song-e',
    }
    for pol, did in polity_map.items():
        n = db.execute("UPDATE persons SET dynasty_id=? WHERE polity=?", (did, pol)).rowcount
        print(f"  polity='{pol}' → {did}: {n} 人")

    # 2. 两宋：按「活动锚点」拆
    #    锚点优先级：death > 最早entry年 > birth
    #    理由：用 birth 会把岳飞(1103,卒1141)/李清照(1084,卒1155)错划北宋；
    #    这些人活动于南宋，用死亡/仕途年份才准。
    #
    # 2a. 有 death
    n1 = 0
    for did, name, a, b in RANGES:
        n1 += db.execute(
            "UPDATE persons SET dynasty_id=? WHERE polity='两宋' AND dynasty_id IS NULL "
            "AND death IS NOT NULL AND death>=? AND death<?",
            (did, a, b)
        ).rowcount
    print(f"  两宋 by death: {n1} 人")

    # 2b. 无 death 但有 entry 年份
    db.execute("""CREATE TEMP TABLE IF NOT EXISTS first_year AS
                  SELECT person_id, MIN(year) AS y FROM entries
                  WHERE year IS NOT NULL AND year>0
                  GROUP BY person_id""")
    n2 = 0
    for did, name, a, b in RANGES:
        n2 += db.execute("""
            UPDATE persons SET dynasty_id=? WHERE polity='两宋' AND dynasty_id IS NULL
            AND id IN (SELECT person_id FROM first_year WHERE y>=? AND y<?)
        """, (did, a, b)).rowcount
    print(f"  两宋 by entry: {n2} 人")

    # 2c. 最后才用 birth
    n3 = 0
    for did, name, a, b in RANGES:
        n3 += db.execute(
            "UPDATE persons SET dynasty_id=? WHERE polity='两宋' AND dynasty_id IS NULL "
            "AND birth IS NOT NULL AND birth>=? AND birth<?",
            (did, a, b)
        ).rowcount
    print(f"  两宋 by birth (兜底): {n3} 人")

    # 3. 其余两宋保留 NULL（不臆断）
    rest = db.execute("SELECT COUNT(*) FROM persons WHERE polity='两宋' AND dynasty_id IS NULL").fetchone()[0]
    print(f"  两宋 未归类（保留待定）: {rest} 人")

    db.commit()

    # 结果统计
    print()
    print("=== dynasty_id 分布 ===")
    for r in db.execute("SELECT dynasty_id, COUNT(*) n FROM persons GROUP BY dynasty_id ORDER BY n DESC"):
        print(f"  {r['dynasty_id']}: {r['n']}")
    db.close()

if __name__ == '__main__':
    main()
