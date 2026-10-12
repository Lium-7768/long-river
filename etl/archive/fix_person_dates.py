#!/usr/bin/env python3
"""把 DB 中与史实不符的生卒年，按正史记载更正（只改确证的错项）。

来源：各正史本传 + 学界公认年代（《中国历史纪年表》）。
不改变人物归属朝代，也不删除记录——只订正明显错误的时间。
"""
import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else "data/lr-song.sqlite3"

# name -> (birth, death, 依据)   None 表示不修改该项
FIX = {
    # 赵高：生年史无明确记载，Wikidata 的 -300 属臆测；卒于前207（子婴即位后）。
    "赵高":   (None, -207, "《史记·秦始皇本纪》卒于前207年"),
    # 妇好：武丁时期（约前1250–前1200），Wikidata -1300 偏早约50年。
    "妇好":   (-1250, -1200, "殷墟妇好墓/甲骨断代 武丁时期"),
    # 齐桓公：生于前725左右（史记未载确切生年，学界通行说法），卒前643。
    "齐桓公": (-725, -643, "《史记·齐太公世家》前685–前643在位"),
    # 周文王：卒年有前1056/前1050/前1046诸说，Wikidata -1049 可接受，不改。
}

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
fixed = 0
for nm, (b, d, why) in FIX.items():
    for r in con.execute(
            "SELECT id,birth,death FROM persons WHERE name=? AND source LIKE 'Wikidata%'",
            (nm,)):
        sets, args = [], []
        if b is not None:
            sets.append("birth=?"); args.append(b)
        if d is not None:
            sets.append("death=?"); args.append(d)
        if not sets:
            continue
        args.append(r["id"])
        con.execute(f"UPDATE persons SET {','.join(sets)} WHERE id=?", args)
        fixed += 1
        print(f"✓ 订正 {nm}: {r['birth']}~{r['death']} → {b}~{d}   ({why})")
con.commit()
print(f"\n共订正 {fixed} 条")
con.close()
