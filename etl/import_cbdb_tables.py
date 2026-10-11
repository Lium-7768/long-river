#!/usr/bin/env python3
"""把 CBDB 源库的**全部表**复制进本地 lr-song.sqlite3。

策略：
- 本地加工表（persons/kinships/offices/entries/works）保持不变
- CBDB 所有原始表 → 加前缀 `cbdb_` 复制（如 cbdb_BIOG_MAIN）
- 不复制 sqlite 内部表（sqlite_*）
- 幂等：已存在的表跳过（除非 --force）

用法：
    python3 etl/import_cbdb_tables.py <cbdb.sqlite3> [目标库] [--force]
"""
import sqlite3, sys, re

PREFIX = "cbdb_"
# 本地加工表（不覆盖）
LOCAL_TABLES = {"persons", "kinships", "offices", "entries", "works"}


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else "etl/data/cbdb_20261003.sqlite3"
    dst_path = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "data/lr-song.sqlite3"
    force = "--force" in sys.argv

    src = sqlite3.connect(src_path)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(dst_path)

    # CBDB 需要复制的表
    tables = [r[0] for r in src.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    dst_existing = set(r[0] for r in dst.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"))

    copied = skipped = 0
    rows_total = 0
    for t in tables:
        target = PREFIX + t
        if target in dst_existing and not force:
            skipped += 1
            continue
        if force and target in dst_existing:
            dst.execute(f'DROP TABLE IF EXISTS "{target}"')

        # 取建表 SQL，替换表名
        ddl = src.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (t,)).fetchone()[0]
        if not ddl:
            continue
        # 去掉 CREATE TABLE ... 的表名，换成 target
        ddl_new = re.sub(r'CREATE TABLE (IF NOT EXISTS )?"?[^"(]+"?',
                         f'CREATE TABLE "{target}"', ddl, count=1)
        dst.execute(ddl_new)

        # 复制数据（用 INSERT INTO ... SELECT，通过 ATTACH 更快）
        cols = [c[1] for c in src.execute(f'PRAGMA table_info("{t}")')]
        collist = ",".join(f'"{c}"' for c in cols)
        # 分批读 → 写
        cur = src.execute(f'SELECT {collist} FROM "{t}"')
        placeholders = ",".join("?" * len(cols))
        n = 0
        while True:
            batch = cur.fetchmany(5000)
            if not batch:
                break
            dst.executemany(
                f'INSERT INTO "{target}" ({collist}) VALUES ({placeholders})',
                [tuple(r) for r in batch])
            n += len(batch)
        rows_total += n
        copied += 1
        print(f"  ✓ {t} → {target}: {n} 行")

    dst.commit()
    print(f"\n✓ 复制 {copied} 表、{rows_total} 行；跳过 {skipped} 表（已存在）")
    src.close()
    dst.close()


if __name__ == "__main__":
    main()
