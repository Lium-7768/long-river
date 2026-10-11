#!/usr/bin/env python3
"""古诗词A：引入 chinese-poetry 数据集 → poems / poem_authors。

源：/tmp/cp/po（sparse clone of chinese-poetry/chinese-poetry，公版）
目标表：
  poems(id, title, author, dynasty, genre, content, n_lines)
  poem_authors(name, dynasty, n_poems)

各源格式：
  全唐诗/poet.tang.*.json  [{author,paragraphs[],title,id}]  唐
  全唐诗/poet.song.*.json  [{author,paragraphs[],title}]     宋
  宋词/ci.song.*.json      [{author,paragraphs[],rhythmic}]  宋
  元曲/yuanqu.json         [{dynasty,author,paragraphs[],title}] 元
  诗经/shijing.json        [{title,chapter,section,content[]}]  先秦
  楚辞/chuci.json          [{title,section,author,content[]}]  先秦
  论语/lunyu.json          [{chapter,paragraphs[]}]           先秦
  曹操诗集/caocao.json     [{title,paragraphs[]}]             汉
  纳兰性德/*.json          [{title,para[],author}]            清
"""
import sqlite3, json, os, glob, time
from opencc import OpenCC

SRC = "/tmp/cp/po"
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")
t2s = OpenCC("t2s")


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS poems")
    con.execute("""CREATE TABLE poems (
        id INTEGER PRIMARY KEY, title TEXT, author TEXT, dynasty TEXT,
        genre TEXT, content TEXT, n_lines INTEGER, src TEXT
    )""")
    rows = []
    seen = set()

    def add(title, author, dynasty, genre, lines, src):
        content = "\n".join(lines).strip()
        if not content:
            return
        content = t2s.convert(content)
        title = t2s.convert((title or "").strip())
        author = t2s.convert((author or "").strip())
        key = (title, author, content[:40])
        if key in seen:
            return
        seen.add(key)
        rows.append((title, author, dynasty, genre, content, len(lines), src))

    t0 = time.time()
    # 唐诗 / 宋诗
    for fp in glob.glob(f"{SRC}/全唐诗/poet.tang.*.json"):
        for p in load(fp):
            add(p.get("title"), p.get("author"), "tang", "诗", p.get("paragraphs", []), "全唐诗")
    print(f"唐诗: {len(rows):,}  ({time.time()-t0:.0f}s)")
    for fp in glob.glob(f"{SRC}/全唐诗/poet.song.*.json"):
        for p in load(fp):
            add(p.get("title"), p.get("author"), "song", "诗", p.get("paragraphs", []), "全宋诗")
    print(f"宋诗: {len(rows):,}  ({time.time()-t0:.0f}s)")
    # 宋词
    for fp in glob.glob(f"{SRC}/宋词/ci.song.*.json"):
        for p in load(fp):
            add(p.get("rhythmic"), p.get("author"), "song", "词", p.get("paragraphs", []), "全宋词")
    print(f"宋词: {len(rows):,}  ({time.time()-t0:.0f}s)")
    # 元曲
    for p in load(f"{SRC}/元曲/yuanqu.json"):
        add(p.get("title"), p.get("author"), "yuan", "曲", p.get("paragraphs", []), "全元曲")
    print(f"元曲: {len(rows):,}")
    # 诗经
    for p in load(f"{SRC}/诗经/shijing.json"):
        add(p.get("title"), "佚名", "zhou-w", "诗", p.get("content", []), "诗经")
    # 楚辞
    for p in load(f"{SRC}/楚辞/chuci.json"):
        add(p.get("title"), p.get("author"), "zhou-e", "辞", p.get("content", []), "楚辞")
    # 论语
    for p in load(f"{SRC}/论语/lunyu.json"):
        add(p.get("chapter"), "孔子", "zhou-w", "文", p.get("paragraphs", []), "论语")
    # 曹操
    for p in load(f"{SRC}/曹操诗集/caocao.json"):
        add(p.get("title"), "曹操", "han-e", "诗", p.get("paragraphs", []), "曹操诗集")
    # 纳兰性德
    for p in load(f"{SRC}/纳兰性德/纳兰性德诗集.json"):
        add(p.get("title"), p.get("author") or "纳兰性德", "qing", "词", p.get("para", []), "纳兰词")
    print(f"合计: {len(rows):,}  ({time.time()-t0:.0f}s)")

    con.executemany(
        "INSERT INTO poems (title,author,dynasty,genre,content,n_lines,src) "
        "VALUES (?,?,?,?,?,?,?)", rows)
    con.execute("CREATE INDEX idx_poems_author ON poems(author)")
    con.execute("CREATE INDEX idx_poems_dynasty ON poems(dynasty)")

    # 作者表
    con.execute("DROP TABLE IF EXISTS poem_authors")
    con.execute("""CREATE TABLE poem_authors AS
        SELECT author AS name, dynasty, COUNT(*) AS n_poems
        FROM poems WHERE author IS NOT NULL AND author<>''
        GROUP BY author, dynasty""")
    con.execute("CREATE INDEX idx_pa_name ON poem_authors(name)")
    con.commit()

    print(f"\n✓ poems: {con.execute('SELECT COUNT(*) FROM poems').fetchone()[0]:,}")
    print(f"✓ poem_authors: {con.execute('SELECT COUNT(*) FROM poem_authors').fetchone()[0]:,}")
    print("\n按朝代:")
    for r in con.execute("SELECT dynasty,COUNT(*) FROM poems GROUP BY dynasty ORDER BY 2 DESC"):
        print(f"  {r[0]}: {r[1]:,}")
    con.close()


if __name__ == "__main__":
    main()
