#!/usr/bin/env python3
"""给 persons 加 top_office 字段：从 offices 里提取「最高代表官职」。"""
import sqlite3, sys, time
DB = sys.argv[1] if len(sys.argv) > 1 else 'data/lr-song.sqlite3'
db = sqlite3.connect(DB)

cols = [r[1] for r in db.execute("PRAGMA table_info(persons)")]
if 'top_office' not in cols:
    db.execute("ALTER TABLE persons ADD COLUMN top_office TEXT")
    print("✓ 新增 top_office")

# 官职等级（高→低），取第一个命中
RANK = ['丞相', '宰相', '平章', '参知政事', '枢密使', '同知枢密', '尚书', '侍郎',
        '翰林', '御史中丞', '转运使', '节度使', '安抚使', '知府', '知州', '县令']

def pick(offs):
    for kw in RANK:
        for o in offs:
            if o and kw in o:
                return o
    return offs[0] if offs else None

t0 = time.time()
rows = db.execute("SELECT person_id, office FROM offices").fetchall()
byp = {}
for pid, off in rows:
    byp.setdefault(pid, []).append(off)
print(f"读取 {len(rows)} 条官职，{len(byp)} 人，用时 {time.time()-t0:.1f}s")

upd = []
for pid, offs in byp.items():
    upd.append((pick(offs), pid))
print(f"计算完成，写入…")
db.executemany("UPDATE persons SET top_office=? WHERE id=?", upd)
db.commit()
print(f"✓ 完成，共 {len(upd)} 人，总用时 {time.time()-t0:.1f}s")

print()
print("=== 样本 ===")
for name in ['司马光','苏轼','王安石','欧阳修','岳飞','范仲淹','辛弃疾']:
    r = db.execute("SELECT name, top_office FROM persons WHERE name=?", (name,)).fetchone()
    if r: print(f"  {r[0]}: {r[1]}")
db.close()
