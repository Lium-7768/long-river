#!/usr/bin/env python3
"""
计算 fame_score：用于「代表人物」排序。
fame ≈ office*2 + kinship + works*3
用聚合表一次性算完（避免 O(n²) 相关子查询）。
"""
import sqlite3, sys, time
DB = sys.argv[1] if len(sys.argv) > 1 else 'data/lr-song.sqlite3'
db = sqlite3.connect(DB)
t0=time.time()

cols = [r[1] for r in db.execute("PRAGMA table_info(persons)")]
if 'fame_score' not in cols:
    db.execute("ALTER TABLE persons ADD COLUMN fame_score INTEGER")
    print("✓ 新增 fame_score 字段")

# 聚合计数（每个表扫一遍）
print("统计 offices…")
db.execute("CREATE TEMP TABLE oc AS SELECT person_id, COUNT(*) n FROM offices GROUP BY person_id")
print("统计 kinships…")
db.execute("""CREATE TEMP TABLE kc AS
              SELECT pid, COUNT(*) n FROM (
                SELECT a AS pid FROM kinships UNION ALL SELECT b FROM kinships
              ) GROUP BY pid""")
print("统计 works…")
db.execute("CREATE TEMP TABLE wc AS SELECT person_id, COUNT(*) n FROM works GROUP BY person_id")

print("写入 fame_score…")
db.execute("""
    UPDATE persons SET fame_score =
      COALESCE((SELECT n FROM oc WHERE oc.person_id=persons.id),0)*2
    + COALESCE((SELECT n FROM kc WHERE kc.pid=persons.id),0)
    + COALESCE((SELECT n FROM wc WHERE wc.person_id=persons.id),0)*3
""")
db.commit()
print(f"✓ 完成，用时 {time.time()-t0:.1f}s")
print()
for d,nm in [('song-w','北宋'),('song-e','南宋')]:
    print(f"=== {nm} fame top 12 ===")
    for r in db.execute(f"SELECT name,fame_score,birth,death FROM persons WHERE dynasty_id='{d}' AND prominence>=5 ORDER BY fame_score DESC LIMIT 12"):
        print(f"  {r[0]}  fame={r[1]}  {r[2] or '?'}~{r[3] or '?'}")
    print()
db.close()
