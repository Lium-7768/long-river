#!/usr/bin/env python3
"""从 cbdb_STATUS_DATA 提取「身份/角色」→ persons.role（此前 0% 覆盖）。

STATUS_DATA 一人可能有多条身份（皇帝/武将/僧人/进士…）。
策略：取最具标识性的一条（优先级：皇帝 > 皇后 > 名臣类 > 宗教 > 其他），
用中文描述写入 role。
"""
import sqlite3, os, sys
from collections import defaultdict

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "data", "db", "lr-song.sqlite3")

# 优先级（越小越优先展示）
PRIORITY = {
    26: 1, 27: 2,                      # 皇帝 / 皇后
    2: 3, 29: 4, 12: 5, 9: 6, 4: 7,    # 武将/宦官/儒学/书法家/天文
    33: 8, 34: 8,                      # 状元/进士类（若有）
    7: 9, 8: 9, 19: 9, 20: 9,          # 宗教
    3: 10, 25: 10, 13: 10, 14: 11,     # 工匠/学官/胥吏/布衣
    16: 12, 28: 12, 32: 12,            # 妾/主家/管理家事
    22: 20, 23: 20, 24: 20, 30: 20,    # 早卒/未婚而卒/未仕/落第
}


def main():
    con = sqlite3.connect(DB)
    # 代码 → 中文
    code2chn = {r[0]: r[1] for r in con.execute(
        "SELECT c_status_code, c_status_desc_chn FROM cbdb_STATUS_CODES")}

    # 收集每人所有状态
    per = defaultdict(set)
    for pid, code in con.execute(
            "SELECT c_personid, c_status_code FROM cbdb_STATUS_DATA"):
        if code is not None and code >= 0:
            per[pid].add(code)

    # id 映射
    idmap = {r[0]: r[1] for r in con.execute(
        "SELECT cbdb_id, id FROM persons WHERE cbdb_id IS NOT NULL")}

    n = 0

    def clean(x):
        # CBDB 多数身份标签自带方括号（如 [為官者：文]），括号是格式非噪声 → 去括号保留
        if not x:
            return None
        x = x.strip("[]（）()【】 ").strip()
        return x if x and x != "未詳" else None

    for pid, codes in per.items():
        if pid not in idmap:
            continue
        # 选最优
        best = sorted(codes, key=lambda c: PRIORITY.get(c, 15))[0]
        label = clean(code2chn.get(best))
        if not label:
            for c in codes:
                label = clean(code2chn.get(c))
                if label:
                    break
        if not label:
            continue
        con.execute("UPDATE persons SET role=? WHERE id=? AND (role IS NULL OR role='')",
                    (label, idmap[pid]))
        n += 1
    con.commit()
    print(f"✓ role 填充: {n:,}")
    cov = con.execute("SELECT COUNT(*) FROM persons WHERE role IS NOT NULL AND role<>''").fetchone()[0]
    tot = con.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
    print(f"  role 覆盖: {cov:,} / {tot:,} ({cov*100//tot}%)")
    con.close()


if __name__ == "__main__":
    main()
