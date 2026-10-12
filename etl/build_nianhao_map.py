#!/usr/bin/env python3
"""补数据C50：年号表标准化（nianhao → 归属 24 朝）。

nianhao 原 dynasty 为细粒度政权名（北魏/北宋/三国吴…），
映射到 app 的 24 个 dynasty_id，并修正「中华民国 end=3000」异常。
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# nianhao.dynasty → app dynasty_id
MAP = {
    '夏': 'xia', '商': 'shang', '周': 'zhou-w', '秦': 'qin',
    '西汉': 'han-w', '新朝': 'xin', '东汉': 'han-e',
    '三国魏': 'sanguo', '三国蜀': 'sanguo', '三国吴': 'sanguo', '吴': 'sanguo',
    '西晋': 'jin', '东晋': 'jin',
    '刘宋': 'nanbei', '南齐': 'nanbei', '南梁': 'nanbei', '陈': 'nanbei',
    '北魏': 'nanbei', '东魏': 'nanbei', '西魏': 'nanbei', '北齐': 'nanbei', '北周': 'nanbei',
    '前凉': 'nanbei', '前燕': 'nanbei', '前秦': 'nanbei', '前赵': 'nanbei', '北凉': 'nanbei',
    '北燕': 'nanbei', '南凉': 'nanbei', '南燕': 'nanbei', '后凉': 'nanbei', '后燕': 'nanbei',
    '后秦': 'nanbei', '后赵': 'nanbei', '西凉': 'nanbei', '西秦': 'nanbei', '西燕': 'nanbei',
    '成汉': 'nanbei',
    '隋': 'sui', '唐': 'tang',
    '五代后梁': 'wudai', '五代后唐': 'wudai', '五代后晋': 'wudai', '五代后汉': 'wudai',
    '五代后周': 'wudai', '后梁': 'wudai', '南唐': 'wudai', '前蜀': 'wudai', '南汉': 'wudai',
    '后蜀': 'wudai', '吴越': 'wudai', '闽': 'wudai', '北汉': 'wudai',
    '辽': 'liao', '西辽': 'liao', '北元': 'yuan', '蒙古元': 'yuan',
    '北宋': 'song-w', '南宋': 'song-e', '西夏': 'xixia', '金': 'jin-chao',
    '元': 'yuan', '明': 'ming', '南明': 'ming', '清': 'qing',
    '中华民国': 'minguo', '伪齐': 'song-e', '大西': 'ming', '大顺': 'ming',
    '郑（王世充）': 'tang',
}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    # 加 dynasty_id 列
    cols = [r[1] for r in con.execute("PRAGMA table_info(nianhao)")]
    if 'dynasty_id' not in cols:
        con.execute("ALTER TABLE nianhao ADD COLUMN dynasty_id TEXT")
    hit = miss = 0
    miss_names = set()
    for nid, dyn in con.execute("SELECT id, dynasty FROM nianhao"):
        d = MAP.get(dyn)
        if d:
            con.execute("UPDATE nianhao SET dynasty_id=? WHERE id=?", (d, nid))
            hit += 1
        else:
            miss += 1
            miss_names.add(dyn)
    # 修正 中华民国 end=3000 → 1949
    con.execute("UPDATE nianhao SET end=1949 WHERE end>2020")
    con.commit()
    print(f"✓ 年号映射：命中 {hit}，未映射 {miss}")
    print(f"  未映射政权：{sorted(miss_names) or '无'}")
    # 统计
    for r in con.execute("SELECT dynasty_id, COUNT(*) FROM nianhao WHERE dynasty_id IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
