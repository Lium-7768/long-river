#!/usr/bin/env python3
"""补数据C21：人物↔正史原文片段（bio_excerpt）。

对库内人物，在对应朝代正史里定位其传记（「姓名，字…」或「姓名字…」），
抽取 300~800 字传记片段，存 bio_excerpt(person_id, book, volume, excerpt)。
这是「可回溯一手史料」的核心。
"""
import sqlite3, os, re, sys
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

DYN_BOOK = {
    'song-w': '宋史', 'song-e': '宋史', 'tang': '旧唐书', 'han-w': '汉书',
    'han-e': '后汉书', 'ming': '明史', 'qing': '清史稿', 'sui': '隋书',
    'jin': '晋书', 'wudai': '旧五代史', 'yuan': '元史',
}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS bio_excerpt")
    con.execute("""CREATE TABLE bio_excerpt (
        person_id TEXT, book TEXT, volume TEXT, excerpt TEXT)""")
    con.execute("CREATE INDEX idx_be_pid ON bio_excerpt(person_id)")
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    total = 0
    for dyn, book in DYN_BOOK.items():
        have = con.execute("SELECT COUNT(*) FROM texts WHERE book=?", (book,)).fetchone()[0]
        if not have:
            continue
        # 取该朝代有生卒/名声较高的人物
        people = con.execute(
            "SELECT id,name FROM persons WHERE dynasty_id=? AND name IS NOT NULL "
            "AND length(name)>=2 ORDER BY COALESCE(fame_score,0) DESC, prominence DESC LIMIT ?",
            (dyn, lim)).fetchall()
        n = 0
        for pid, name in people:
            # 传记锚：「姓名，字X」或「姓名字X」
            pat = re.compile(re.escape(name) + r'[，,]?字[\u4e00-\u9fa5]{1,3}')
            rows = con.execute("SELECT volume,content FROM texts WHERE book=? AND content LIKE ? LIMIT 5",
                               (book, '%' + name + '%')).fetchall()
            for vol, content in rows:
                m = pat.search(content)
                if not m:
                    continue
                start = max(0, m.start() - 10)
                excerpt = content[start:start + 700]
                # 截到句号/换行
                cut = excerpt.find('\n')
                if cut > 150:
                    excerpt = excerpt[:cut]
                con.execute("INSERT INTO bio_excerpt VALUES (?,?,?,?)", (pid, book, vol, excerpt))
                n += 1
                break
        con.commit()
        print(f"  ✓ {dyn}({book}): {n} 条传记片段")
        total += n
    print(f"\n✓ bio_excerpt 总 {total}")
    for r in con.execute("SELECT p.name,b.book,substr(b.excerpt,1,60) FROM bio_excerpt b "
                         "JOIN persons p ON p.id=b.person_id LIMIT 5"):
        print("  ", r[0], "|", r[1], "|", r[2].replace('\n', ' '))
    con.close()


if __name__ == "__main__":
    main()
