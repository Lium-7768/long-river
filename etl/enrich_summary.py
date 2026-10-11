#!/usr/bin/env python3
"""用《资治通鉴》匹配结果补全 persons.summary（事迹）+ source（出处）。
仅当 summary 为空时写入；不新增人物（只补全原名）。
"""
import json, sqlite3, sys

def main():
    src, db = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data/lr-song.sqlite3"
    rows = [json.loads(l) for l in open(src, encoding="utf-8")]
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    updated = 0
    for r in rows:
        nm, desc, srcname = r["name"], r.get("desc"), r.get("source")
        if not desc:
            continue
        # 更新该姓名下 summary 为空的记录
        cur = con.execute(
            "UPDATE persons SET summary=?, source=COALESCE(source,?) "
            "WHERE name=? AND (summary IS NULL OR summary='')",
            (desc, srcname, nm))
        updated += cur.rowcount
    con.commit()
    con.close()
    print(f"✓ 补全 {updated} 条 summary/source（来自 {src}）")


if __name__ == "__main__":
    main()
