#!/usr/bin/env python3
"""从公版两汉史书（史记/汉书/后汉书）补全名人。

模式：「XX字YY，ZZ人也」/「XX，字YY，ZZ人」
用途：CBDB 对两汉覆盖极弱（仅千余人），大量两汉名人缺失/错标，
     用史书原文补入 persons（含字号/籍贯/事迹）。
"""
import sqlite3, re, os, sys, json

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")

PAT = re.compile(r"([\u4e00-\u9fff]{2,4})[，,]?\s*字\s*([\u4e00-\u9fff]{1,3})[，,]([\u4e00-\u9fff]{2,10}?)(?:人也|人|縣人)")

# 非人名黑名单（句子片段误配）
BAD_NAMES = {"轵人也", "名何", "某氏"}


def main():
    con = sqlite3.connect(DB)
    # 史书 → 朝代
    BOOK_DY = {"史记": "han-w", "汉书": "han-w", "后汉书": "han-e"}
    # 已在库的两汉人名
    have = set(r[0] for r in con.execute(
        "SELECT name FROM persons WHERE dynasty_id IN ('han-w','han-e','xin','qin')"))

    added = 0
    for book, dy in BOOK_DY.items():
        for vol, c in con.execute("SELECT volume,content FROM texts WHERE book=?", (book,)):
            for m in PAT.finditer(c):
                nm, zi, addr = m.groups()
                if nm in BAD_NAMES or len(nm) < 2:
                    continue
                # 地名合理性：结尾应为 州/縣/人/郡/…，或以「人也」结尾的域
                if nm in have:
                    continue
                # 取该传记首句作为 summary
                start = m.start()
                tail = c[start:start + 120]
                sent = re.split(r"[。；]", tail)
                desc = sent[0][:60] if sent else None
                # 新 id
                new_id = f"hanshu-{book}-{vol}-{nm}"
                # 幂等
                if con.execute("SELECT 1 FROM persons WHERE id=?", (new_id,)).fetchone():
                    continue
                con.execute("""INSERT INTO persons
                    (id,cbdb_id,name,surname,birth,death,polity,zi,hao,shi,addr,
                     role,prominence,summary,source,dynasty_id,fame_score,top_office)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (new_id, None, nm, None, None, None, None, zi, None, None,
                     json.dumps([addr], ensure_ascii=False) if addr else None,
                     None, 6, desc, f"《{book}·卷{vol}》", dy, 15, None))
                added += 1
    con.commit()
    print(f"✓ 两汉史书补入: {added:,}")
    print(f"  两汉现: {con.execute(chr(39)+'SELECT COUNT(*) FROM persons WHERE dynasty_id IN (\"han-w\",\"han-e\",\"xin\")'+chr(39)).fetchone()[0] if False else con.execute('SELECT COUNT(*) FROM persons WHERE dynasty_id IN (\"han-w\",\"han-e\",\"xin\")').fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
