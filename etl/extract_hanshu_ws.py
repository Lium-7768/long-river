#!/usr/bin/env python3
"""从维基文库完整汉书（繁体，含师古注）抽取列传人物。

模式：
  「XX，YY人也」          （无字）
  「XX，字YY，ZZ人也」     （有字）
  「XX字YY，ZZ人」
步骤：① 去注 〈…〉；② 匹配；③ 繁→简；④ 入库
"""
import sqlite3, re, json, os, sys
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

# 传首模式（在文本开头或 == 标题 后）
TITLE = re.compile(r"==\s*([^=\n]{1,12})\s*==")
BIO = re.compile(r"^([\u4e00-\u9fff]{2,4})[，,]\s*(?:字\s*([\u4e00-\u9fff]{1,3})[，,]\s*)?([\u4e00-\u9fff]{2,10}?)(?:人也|人)")
BAD = {"名何", "某氏", "其先"}


def strip_notes(s):
    return re.sub(r"〈[^〉]*〉", "", s)


def main():
    con = sqlite3.connect(DB)
    have = set(r[0] for r in con.execute("SELECT name FROM persons WHERE dynasty_id IN ('han-w','han-e')"))
    added = 0
    for vol, content in con.execute(
            "SELECT volume,content FROM texts WHERE book='汉书' AND volume LIKE '卷%'"):
        clean = strip_notes(content)
        # 按 == 标题 分节
        parts = re.split(r"==\s*([^=\n]{1,12})\s*==", clean)
        # parts = [前言, 标题1, 正文1, 标题2, 正文2, ...]
        for i in range(1, len(parts), 2):
            title = parts[i].strip()
            body = parts[i + 1] if i + 1 < len(parts) else ""
            # 标题即传主（如 "張騫"）；正文开头也可能有 "XX，YY人也"
            for seg in [title, body.strip()[:40]]:
                m = BIO.match(seg)
                if not m:
                    continue
                nm = t2s.convert(m.group(1))
                zi = t2s.convert(m.group(2)) if m.group(2) else None
                addr = t2s.convert(m.group(3)) if m.group(3) else None
                if nm in BAD or len(nm) < 2:
                    continue
                if nm in have:
                    continue
                desc = t2s.convert(re.split(r"[。；]", body.strip())[0][:60]) if body.strip() else None
                nid = f"hs-{vol}-{nm}"
                if con.execute("SELECT 1 FROM persons WHERE id=?", (nid,)).fetchone():
                    continue
                con.execute("""INSERT INTO persons
                    (id,cbdb_id,name,surname,birth,death,polity,zi,hao,shi,addr,
                     role,prominence,summary,source,dynasty_id,fame_score,top_office)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (nid, None, nm, None, None, None, None, zi, None, None,
                     json.dumps([addr], ensure_ascii=False) if addr else None,
                     None, 6, desc, f"《汉书·{vol}》", 'han-w', 15, None))
                added += 1
                have.add(nm)
    con.commit()
    print(f"✓ 汉书(维基文库) 补入 {added:,}")
    print(f"  汉-w 现: {con.execute('SELECT COUNT(*) FROM persons WHERE dynasty_id=\"han-w\"').fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
