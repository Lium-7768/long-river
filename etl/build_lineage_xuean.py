#!/usr/bin/env python3
"""补数据C11v4：学案师承（用「小传正文首句的姓名」定位真实人物）。

学案结构：
  前言区：成员名单（每行「稱號姓號先生名」），第一个是案主（宗师）
  小传区：'== 标题 ==' 后正文首句「XXX字YY，...」——XXX 即真实全名

方法：按顺序把「成员名单」与「小传正文首句姓名」对齐（都是同一学派、同序）。
案主 = 第一个小传姓名；其门人 = 后续小传姓名。
"""
import sqlite3, os, re
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 正文首句：姓名 + 字/號
BIO_START = re.compile(r'^[\u3000\s]*([\u4e00-\u9fa5]{2,4})[字號号]')


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    name2id = {}
    for pid, nm in con.execute("SELECT id,name FROM persons WHERE name IS NOT NULL"):
        name2id.setdefault(nm, pid)
    names = set(name2id)
    existing = {(t, s) for t, s in con.execute("SELECT teacher,student FROM lineage")}

    rows = []
    seen = set()

    for book in ('明儒学案', '宋元学案'):
        for vol, content in con.execute("SELECT volume,content FROM texts WHERE book=?", (book,)):
            lines = content.split('\n')
            # 收集小传姓名（正文首句），按出现顺序
            bios = []
            for line in lines:
                if line.strip().startswith('=='):
                    continue
                m = BIO_START.match(line)
                if m:
                    nm = t2s.convert(m.group(1))
                    bios.append(nm)
            # 过滤：只保留在 persons 的
            bios = [b for b in bios if b in names]
            # 去重保序
            seenb = set()
            bios = [b for b in bios if not (b in seenb or seenb.add(b))]
            if len(bios) < 2:
                continue
            master = bios[0]
            for stu in bios[1:]:
                tid, sid = name2id.get(master), name2id.get(stu)
                if not tid or not sid or tid == sid or (tid, sid) in existing or (tid, sid) in seen:
                    continue
                seen.add((tid, sid))
                rows.append((tid, sid, '学案师承', f'{book}·{vol}', None))

    con.executemany("INSERT INTO lineage VALUES (?,?,?,?,?)", rows)
    con.commit()
    print(f"✓ 新增 lineage: {len(rows)}")
    for r in con.execute("""SELECT pt.name,ps.name,l.src_book FROM lineage l
        JOIN persons pt ON pt.id=l.teacher JOIN persons ps ON ps.id=l.student
        WHERE l.rel='学案师承' LIMIT 15"""):
        print("  ", " → ".join(r[:2]), f"[{r[2]}]")
    print("lineage 总:", con.execute("SELECT COUNT(*) FROM lineage").fetchone()[0])
    con.close()


if __name__ == "__main__":
    main()
