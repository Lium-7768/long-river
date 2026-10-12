#!/usr/bin/env python3
"""用公版史书（我们的 texts 表）验证人物数据的真实性。

对每个人物，在史书中查找其传记（名字 + 字号），判断：
  一致性 A：名字+字号 都命中（强证据）
  一致性 B：名字命中（弱证据，至少确认人物存在）
  不一致  ：名字命中但字号不符（需人工核查）

繁简自动归一。
"""
import sqlite3, re, os, sys
from opencc import OpenCC

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")
s2t = OpenCC('s2t')
t2s = OpenCC('t2s')


def validate(limit=1000, dynasties=None, sample="random"):
    con = sqlite3.connect(DB)
    where = "zi IS NOT NULL AND zi<>''"
    if dynasties:
        marks = ",".join("'" + d + "'" for d in dynasties)
        where += f" AND dynasty_id IN ({marks})"
    order = "RANDOM()" if sample == "random" else "id"
    rows = con.execute(f"SELECT id,name,zi,addr,dynasty_id FROM persons WHERE {where} ORDER BY {order} LIMIT ?",
                       (limit,)).fetchall()

    stat = {"A": 0, "B": 0, "C": 0, "miss": 0}
    bad = []
    for pid, name, zi, addr, dy in rows:
        nameT = s2t.convert(name)
        ziT = s2t.convert(zi)
        contents = [c for (c,) in con.execute(
            "SELECT content FROM texts WHERE content LIKE ?", (f"%{nameT}%",))]
        if not contents:
            stat["miss"] += 1
            continue
        # 强证据：名字附近有「字X」
        strong = any(re.search(re.escape(nameT) + r".{0,6}字\s*" + re.escape(ziT), c)
                     for c in contents)
        if strong:
            stat["A"] += 1
        else:
            # 弱证据：有「字X」但离名字远（可能同名混淆）
            weak = any(re.search(r"字\s*" + re.escape(ziT), c) for c in contents)
            if weak:
                stat["B"] += 1
            else:
                stat["C"] += 1
                if len(bad) < 20:
                    bad.append((name, zi, dy))
    tot = sum(stat.values())
    print(f"样本 {tot}（{dynasties or '全部朝代'}）")
    print(f"  A 名字+字号双命中 : {stat['A']:>5} ({stat['A']*100//max(tot,1)}%)")
    print(f"  B 仅字号命中       : {stat['B']:>5} ({stat['B']*100//max(tot,1)}%)")
    print(f"  C 名字命中但字号不符: {stat['C']:>5} ({stat['C']*100//max(tot,1)}%)")
    print(f"  - 史书无此人       : {stat['miss']:>5} ({stat['miss']*100//max(tot,1)}%)")
    print(f"  → 可确认真实(A+B+人物存在): {(stat['A']+stat['B']+tot-stat['miss'])*100//max(tot,1)}%")
    if bad:
        print("  字号不符样例（需核查）:")
        for b in bad[:10]:
            print("    ", b)
    con.close()
    return stat


if __name__ == "__main__":
    validate(limit=2000, dynasties=["ming", "qing"], sample="random")
