#!/usr/bin/env python3
"""步骤3：从《史记》先秦世家/本纪抽取夏商周人物。

数据源：史记 卷1-47（本纪+先秦世家）
- 卷1-6：五帝/夏/殷/周/秦本纪
- 卷31-47：吴/齐/燕/管蔡/陈杞/卫/宋/晋/楚/越/郑/赵/魏/韩/田齐 世家

模式：== 君主名 == 分节；或正文 "X公/侯/伯/王/君 名 Y"。
过滤：噪声标题（评论/太史公/索隐）、范围式标题（A至B）。
朝代：卷1-4=上古（归 zhou-w 前的按需映射）；卷5=秦；卷31-40=西周/东周；41-47=东周
"""
import sqlite3, re, json, os
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")

NOISE = re.compile(r"評論|评论|太史公|索隱|索隐|斠勘|年表|【|至|及|以上|之際|期間|論|论|評|评|贊|赞|曰$")
# 卷 → 朝代
VOL_DY = {}
for v in [1, 2, 3]: VOL_DY[v] = "xia" if v == 2 else ("shang" if v == 3 else "xia")
VOL_DY[1] = "xia"; VOL_DY[4] = "zhou-w"; VOL_DY[5] = "qin"; VOL_DY[6] = "qin"
for v in range(31, 41): VOL_DY[v] = "zhou-w"
for v in range(41, 48): VOL_DY[v] = "zhou-e"


def main():
    con = sqlite3.connect(DB)
    have = set(r[0] for r in con.execute("SELECT name FROM persons"))
    added = 0
    for v in list(range(1, 7)) + list(range(31, 48)):
        vol = f"卷{v:03d}"
        r = con.execute("SELECT content FROM texts WHERE book='史记' AND volume=?", (vol,)).fetchone()
        if not r:
            continue
        content = re.sub(r"〈[^〉]*〉", "", r[0])
        dy = VOL_DY.get(v, "zhou-w")
        for t in re.findall(r"==\s*([^=\n]{1,14})\s*==", content):
            t = t.strip()
            if not re.match(r"^[\u4e00-\u9fff]{2,6}$", t):
                continue
            if NOISE.search(t):
                continue
            nm = t2s.convert(t)
            # 国君名常带国别前缀：齊哀公 → 齐哀公（保留，视为全名）
            # 取该节首句作 summary
            seg = re.search(r"==\s*" + re.escape(t) + r"\s*==\s*(.{0,80})", content, re.S)
            desc = None
            if seg:
                first = seg.group(1).strip().split("\n")[0]
                first = re.sub(r"^[#\s]*", "", first)
                desc = t2s.convert(first)[:60] or None
            nid = f"sj-{vol}-{nm}"
            if con.execute("SELECT 1 FROM persons WHERE id=?", (nid,)).fetchone():
                continue
            con.execute("""INSERT INTO persons
                (id,cbdb_id,name,surname,birth,death,polity,zi,hao,shi,addr,
                 role,prominence,summary,source,dynasty_id,fame_score,top_office)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (nid, None, nm, None, None, None, None, None, None, None, None,
                 "国君" if re.search(r"[公侯伯王君]$", nm) else None,
                 6, desc, f"《史记·{vol}》", dy, 12, None))
            added += 1
            have.add(nm)
    con.commit()
    print(f"✓ 先秦(史记) 补入 {added:,}")
    for d in ["xia", "shang", "zhou-w", "zhou-e"]:
        print(f"  {d}: {con.execute('SELECT COUNT(*) FROM persons WHERE dynasty_id=?', (d,)).fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
