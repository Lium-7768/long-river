#!/usr/bin/env python3
"""补数据C7：诗词作者→人物 消歧链接 poem_persons。

问题：poems.author 直连 persons.name 时，遇到同名异代（唐·朱庆余 vs 明·朱庆余）
会被错连。本脚本用「诗朝代优先」消歧：
  1. 优先匹配 persons.name = author 且 dynasty 相容者；
  2. dynasty 用 poem_authors.dynasty 或 poems.poem_dynasty 归一；
  3. 无相容者 → 标记 NULL（宁缺毋滥）。
产出 poem_persons(poem_id, author, person_id, confidence)。
"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 诗朝代 → 可接受的 persons.dynasty_id 集合（含跨代相容）
COMPAT = {
    'tang': {'tang', 'wudai'},
    'song-w': {'song-w', 'song-e', 'song'},
    'song-e': {'song-e', 'song-w', 'song', 'yuan'},
    'song': {'song-w', 'song-e', 'song', 'yuan', 'tang'},
    'yuan': {'yuan', 'song-e', 'song-w', 'ming'},
    'ming': {'ming', 'yuan', 'qing'},
    'qing': {'qing', 'ming', 'minguo'},
    'wudai': {'wudai', 'tang', 'song-w'},
    'zhou-w': {'zhou-w'}, 'zhou-e': {'zhou-e'}, 'han-e': {'han-e'},
}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    # 人物：name → [(id, dyn)]
    people = {}
    for pid, name, dyn in con.execute("SELECT id,name,dynasty_id FROM persons"):
        people.setdefault(name, []).append((pid, dyn))

    con.execute("DROP TABLE IF EXISTS poem_persons")
    con.execute("CREATE TABLE poem_persons (poem_id INTEGER, author TEXT, person_id TEXT, confidence TEXT)")
    con.execute("CREATE INDEX idx_pp_poem ON poem_persons(poem_id)")
    con.execute("CREATE INDEX idx_pp_pid ON poem_persons(person_id)")

    batch = []
    n_match = n_ambig = n_none = 0
    for pid, author, pdyn in con.execute(
            "SELECT id,author,COALESCE(poem_dynasty,dynasty) FROM poems WHERE author IS NOT NULL AND author<>''"):
        cands = people.get(author)
        if not cands:
            n_none += 1
            continue
        if len(cands) == 1:
            batch.append((pid, author, cands[0][0], 'unique'))
            n_match += 1
        else:
            compat = COMPAT.get(pdyn, set())
            ok = [cid for cid, cd in cands if cd in compat]
            if len(ok) == 1:
                batch.append((pid, author, ok[0], 'dyn'))
                n_match += 1
            elif len(ok) > 1:
                batch.append((pid, author, ok[0], 'dyn-multi'))
                n_ambig += 1
            else:
                n_none += 1
        if len(batch) >= 50000:
            con.executemany("INSERT INTO poem_persons VALUES (?,?,?,?)", batch)
            batch = []
    if batch:
        con.executemany("INSERT INTO poem_persons VALUES (?,?,?,?)", batch)
    con.commit()
    print(f"✓ poem_persons: {n_match + n_ambig:,}（unique+dyn）| 无法消歧/无人物: {n_none:,}")
    print("置信度分布:")
    for r in con.execute("SELECT confidence,COUNT(*) FROM poem_persons GROUP BY 1"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
