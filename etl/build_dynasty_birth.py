#!/usr/bin/env python3
"""补数据C6：按「生年优先」推算朝代归属 dynasty_birth。

现有 persons.dynasty_id 依据卒年（CBDB c_dy）。
本脚本另存 dynasty_birth：有生年 → 按生年定朝；无生年 → 沿用 dynasty_id。
用于交叉核验「宋末元初」等跨代人物。
"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")

# (起始年, 结束年, dynasty_id) —— 按生年落入
BANDS = [
    (618, 907, 'tang'), (907, 960, 'wudai'), (960, 1127, 'song-w'),
    (1127, 1279, 'song-e'), (1271, 1368, 'yuan'), (1368, 1644, 'ming'),
    (1644, 1912, 'qing'), (1912, 2100, 'minguo'),
]


def band(y):
    for lo, hi, d in BANDS:
        if lo <= y <= hi:
            return d
    return None


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cols = [r[1] for r in con.execute("PRAGMA table_info(persons)")]
    if 'dynasty_birth' not in cols:
        con.execute("ALTER TABLE persons ADD COLUMN dynasty_birth TEXT")
    n = 0
    upd = []
    for pid, b, d in con.execute("SELECT id,birth,dynasty_id FROM persons"):
        db = band(b) if b else None
        # 宋内细分：用 song-w/song-e 之外保持粗粒度也可
        if not db:
            db = d
        if db != d:
            upd.append((db, pid))
            n += 1
    con.executemany("UPDATE persons SET dynasty_birth=? WHERE id=?", upd)
    con.execute("UPDATE persons SET dynasty_birth=dynasty_id WHERE dynasty_birth IS NULL")
    con.commit()
    print(f"✓ dynasty_birth 与 dynasty_id 不同者: {n:,}")
    print("分布（不同者）:")
    for r in con.execute("""SELECT dynasty_id, dynasty_birth, COUNT(*) FROM persons
        WHERE dynasty_id<>dynasty_birth GROUP BY 1,2 ORDER BY 3 DESC LIMIT 12"""):
        print(f"  {r[0]} → {r[1]}: {r[2]}")
    con.close()


if __name__ == "__main__":
    main()
