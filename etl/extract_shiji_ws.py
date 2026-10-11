#!/usr/bin/env python3
"""从维基文库完整《史记》《后汉书》抽取人物。

格式：正文用 == 传主名 == 分节，节内首句为传记起首。
模式：
  ①  XX者，YY人也，字Z      （史记常见）
  ②  XX者，YY人也
  ③  XX字YY，ZZ人也          （后汉书常见）
  ④  XX，字YY，ZZ人也
去 〈注〉，繁→简。
"""
import sqlite3, re, json, os
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")

BAD = {"名何", "某氏", "其先", "不知", "明年", "是歲"}


def strip_notes(s):
    s = re.sub(r"〈[^〉]*〉", "", s)
    s = re.sub(r"\[[^\]]*\]", "", s)
    return s


PREFIX = r"(?:大將軍|大将军|丞相|太尉|御史大夫|大司馬|大司马|上將軍|上将军|將軍|将军|大行|中郎|侍中|廷尉|少府|中尉|衛尉|衛将军|驃騎將軍|车骑将军|車騎將軍)?"


def parse_bio(seg):
    """从传记首句提取 (name, zi, addr)"""
    seg = seg.strip()
    seg = re.sub(r"^" + PREFIX, "", seg)
    # 官职中缀：蕭相國何者 → 蕭何者；留侯張良者 → 張良者
    seg = re.sub(r"^([\u4e00-\u9fff])[\u4e00-\u9fff]{1,3}(?:相國|丞相|太尉|將軍|侯|君|公)([\u4e00-\u9fff])者", r"\1\2者", seg)
    seg = re.sub(r"^[\u4e00-\u9fff]{1,3}侯([\u4e00-\u9fff]{2,4})者", r"\1者", seg)
    # ① XX者，YY人也，字Z
    m = re.match(r"^([\u4e00-\u9fff]{2,4})者[，,]([\u4e00-\u9fff]{2,12}?)人也[，,]?\s*字\s*([\u4e00-\u9fff]{1,3})", seg)
    if m:
        return m.group(1), m.group(3), m.group(2)
    # ② XX者，YY人也
    m = re.match(r"^([\u4e00-\u9fff]{2,4})者[，,]([\u4e00-\u9fff]{2,12}?)人也", seg)
    if m:
        return m.group(1), None, m.group(2)
    # ③ XX字YY，ZZ人也
    m = re.match(r"^([\u4e00-\u9fff]{2,4})字([\u4e00-\u9fff]{1,3})[，,]([\u4e00-\u9fff]{2,12}?)(?:人也|人)", seg)
    if m:
        return m.group(1), m.group(2), m.group(3)
    # ④ XX，字YY，ZZ人也
    m = re.match(r"^([\u4e00-\u9fff]{2,4})[，,]字([\u4e00-\u9fff]{1,3})[，,]([\u4e00-\u9fff]{2,12}?)(?:人也|人)", seg)
    if m:
        return m.group(1), m.group(2), m.group(3)
    # ⑤ XX，YY人也
    m = re.match(r"^([\u4e00-\u9fff]{2,4})[，,]([\u4e00-\u9fff]{2,12}?)人也", seg)
    if m:
        return m.group(1), None, m.group(2)
    return None


def main():
    con = sqlite3.connect(DB)
    have = set(r[0] for r in con.execute("SELECT name FROM persons"))
    added = 0
    for book, dy in [("史记", "han-w"), ("后汉书", "han-e")]:
        for vol, content in con.execute(
                "SELECT volume,content FROM texts WHERE book=? AND volume LIKE '卷%'", (book,)):
            clean = strip_notes(content)
            parts = re.split(r"==\s*([^=\n]{1,14})\s*==", clean)
            for i in range(1, len(parts), 2):
                title = parts[i].strip()
                body = parts[i + 1] if i + 1 < len(parts) else ""
                first = body.strip().split("\n")[0][:80] if body.strip() else ""
                p = parse_bio(first) or parse_bio(title + "，")
                if not p:
                    # 用标题当人名
                    if re.match(r"^[\u4e00-\u9fff]{2,4}$", title):
                        p = (title, None, None)
                    else:
                        continue
                nm, zi, addr = p
                nm = t2s.convert(nm)
                zi = t2s.convert(zi) if zi else None
                addr = t2s.convert(addr) if addr else None
                if nm in BAD or len(nm) < 2:
                    continue
                desc = t2s.convert(first)[:60] if first else None
                nid = f"ws-{book}-{vol}-{nm}"
                if con.execute("SELECT 1 FROM persons WHERE id=?", (nid,)).fetchone():
                    continue
                # 已是库内两汉人则跳过（避免重复）
                con.execute("""INSERT INTO persons
                    (id,cbdb_id,name,surname,birth,death,polity,zi,hao,shi,addr,
                     role,prominence,summary,source,dynasty_id,fame_score,top_office)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (nid, None, nm, None, None, None, None, zi, None, None,
                     json.dumps([addr], ensure_ascii=False) if addr else None,
                     None, 5, desc, f"《{book}·{vol}》", dy, 12, None))
                added += 1
                have.add(nm)
    con.commit()
    print(f"✓ 史记/后汉书(维基文库) 补入 {added:,}")
    print(f"  han-w: {con.execute('SELECT COUNT(*) FROM persons WHERE dynasty_id=\"han-w\"').fetchone()[0]:,}")
    print(f"  han-e: {con.execute('SELECT COUNT(*) FROM persons WHERE dynasty_id=\"han-e\"').fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
