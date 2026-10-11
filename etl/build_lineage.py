#!/usr/bin/env python3
"""补数据C1：学派师承 lineage 表。

从 assocs 抽出「师承/学术」关系（双向去重）：
  学生/门人/弟子/同学/讲学/学脉传承 …
产出 lineage(teacher, student, rel, direction, source) —— teacher 授业 → student 受业。
"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 关系码 → (语义)。key=code；若「X为Y的学生」则 X=student, Y=teacher
TEACH_CODES = {
    22: ('student', '学生'), 23: ('teacher', '学生'),
    34: ('member', '学派成员'), 35: ('school', '学派成员'),
    36: ('student', '弟子'), 37: ('teacher', '弟子'),
    117: ('peer', '同门'), 108: ('peer', '论学'),
    126: ('teacher', '传其学'), 127: ('student', '受其学'),
    72: ('writer', '撰学术源宗'), 73: ('subject', '学术源宗'),
    140: ('praiser', '赞扬其学'), 141: ('praised', '其学受赞扬'),
}


def main():
    c = sqlite3.connect(DB)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("DROP TABLE IF EXISTS lineage")
    c.execute("""CREATE TABLE lineage (
        teacher TEXT, student TEXT, rel TEXT, source TEXT, src_book TEXT
    )""")
    rows = []
    for pid, aid, code, rn, src, book in c.execute(
            "SELECT person_id,assoc_id,rel_code,rel_name,source,src_book FROM assocs WHERE rel_code IN (%s)"
            % ",".join(str(k) for k in TEACH_CODES)):
        role, rel = TEACH_CODES[code]
        if role == 'student':      # pid 是学生，aid 是老师
            rows.append((aid, pid, rel, src, book))
        elif role == 'teacher':    # pid 是老师
            rows.append((pid, aid, rel, src, book))
        elif role in ('member', 'school'):   # 学派成员（双向）
            rows.append((aid, pid, rel, src, book))
        elif role in ('peer',):    # 同门：互相
            rows.append((pid, aid, rel, src, book))
            rows.append((aid, pid, rel, src, book))
        elif role in ('teacher', 'writer', 'subject', 'praiser', 'praised'):
            pass
    # 去重（同 teacher+student+rel）
    seen = set()
    dedup = []
    for t, s, r, src, b in rows:
        if t == s:
            continue
        k = (t, s, r)
        if k in seen:
            continue
        seen.add(k)
        dedup.append((t, s, r, src, b))
    c.executemany("INSERT INTO lineage VALUES (?,?,?,?,?)", dedup)
    c.commit()
    print(f"✓ lineage: {len(dedup)}")
    print("涉及老师:", c.execute("SELECT COUNT(DISTINCT teacher) FROM lineage").fetchone()[0])
    print("涉及学生:", c.execute("SELECT COUNT(DISTINCT student) FROM lineage").fetchone()[0])
    for r in c.execute("""SELECT pt.name, ps.name, l.rel FROM lineage l
        JOIN persons pt ON pt.id=l.teacher JOIN persons ps ON ps.id=l.student LIMIT 8"""):
        print("  ", " → ".join(r[:2]), f"[{r[2]}]")
    c.close()


if __name__ == "__main__":
    main()
