#!/usr/bin/env python3
"""证据A：建立逐条数据证据表 evid。

每条加工数据（字/号/籍贯/官职/科举/亲属/社会关系）都指向具体史料出处。

evid(person_id, claim_type, claim_value, src_book, src_pages, src_id)
  claim_type: zi/hao/shi/addr/office/entry/kin/assoc/bio
  src_book:   书名（《明史》《縉紳錄》《唐代墓誌彙編》…）
  src_pages:  页码/编号
  src_id:     cbdb source id（可回溯 cbdb_TEXT_CODES）
"""
import sqlite3, os
from opencc import OpenCC
t2s = OpenCC('t2s')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "lr-song.sqlite3")

# (表, 出处列, claim_type)
SRC_TABLES = [
    ("cbdb_ALTNAME_DATA", "c_source", "name"),     # 字/号/谥
    ("cbdb_BIOG_ADDR_DATA", "c_source", "addr"),   # 籍贯
    ("cbdb_POSTED_TO_OFFICE_DATA", "c_source", "office"),  # 官职
    ("cbdb_ENTRY_DATA", "c_source", "entry"),      # 科举
    ("cbdb_KIN_DATA", "c_source", "kin"),          # 亲属
    ("cbdb_ASSOC_DATA", "c_source", "assoc"),      # 社会关系
    ("cbdb_STATUS_DATA", "c_source", "status"),    # 身份
]


def main():
    con = sqlite3.connect(DB)
    idmap = {r[0]: r[1] for r in con.execute("SELECT cbdb_id,id FROM persons WHERE cbdb_id IS NOT NULL")}
    books = {r[0]: t2s.convert((r[1] or '').strip()) for r in con.execute("SELECT c_textid,c_title_chn FROM cbdb_TEXT_CODES")}

    con.execute("DROP TABLE IF EXISTS evid")
    con.execute("""CREATE TABLE evid (
        person_id TEXT NOT NULL,
        claim_type TEXT NOT NULL,
        src_book   TEXT,
        src_pages  TEXT,
        src_id     INTEGER
    )""")

    total = 0
    for tbl, col, ctype in SRC_TABLES:
        pid_col = "c_personid"
        batch = []
        for row in con.execute(f"SELECT {pid_col}, {col} FROM {tbl}"):
            pid, sid = row[0], row[1]
            iid = idmap.get(pid)
            if not iid:
                continue
            book = books.get(sid)
            if not book:
                continue
            batch.append((iid, ctype, book, None, sid))
        con.executemany("INSERT INTO evid VALUES (?,?,?,?,?)", batch)
        total += len(batch)
        print(f"  {tbl}: {len(batch):,}")
        con.commit()

    # BIOG_SOURCE_DATA 带页码 → 单独处理（bio 类）
    batch = []
    for pid, sid, pages in con.execute("SELECT c_personid,c_textid,c_pages FROM cbdb_BIOG_SOURCE_DATA"):
        iid = idmap.get(pid)
        if not iid:
            continue
        book = books.get(sid)
        if not book:
            continue
        batch.append((iid, "bio", book, pages or None, sid))
    con.executemany("INSERT INTO evid VALUES (?,?,?,?,?)", batch)
    print(f"  BIOG_SOURCE_DATA(带页码): {len(batch):,}")
    total += len(batch)

    con.commit()
    con.execute("CREATE INDEX idx_evid_pid ON evid(person_id)")
    con.execute("CREATE INDEX idx_evid_type ON evid(claim_type)")
    con.commit()
    print(f"\n✓ evid 总计: {total:,}")
    print(f"  唯一人物: {con.execute('SELECT COUNT(DISTINCT person_id) FROM evid').fetchone()[0]:,}")
    print(f"  唯一书目: {con.execute('SELECT COUNT(DISTINCT src_book) FROM evid').fetchone()[0]:,}")
    con.close()


if __name__ == "__main__":
    main()
