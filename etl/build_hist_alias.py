#!/usr/bin/env python3
"""补数据C47：历史人物别名映射 hist_alias（异体/庙号/本名）。

profiles 的 figures 用通称（汉明帝/天祚帝/魏徵/毕昇），CBDB 存本名/异体
（刘庄/耶律延禧/魏征/毕升）。建一张公认的通称→本名映射表。
来源：《后汉书》《旧唐书》《辽史》等正史本纪（公有领域）。
"""

import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 通称 → 库内本名/异体（公有领域正史）
ALIAS = {
    # 东汉帝王（《后汉书·本纪》）
    '汉明帝': '刘庄', '汉章帝': '刘炟', '汉和帝': '刘肇', '汉桓帝': '刘志', '汉灵帝': '刘宏',
    '汉献帝': '刘协', '汉光武帝': '刘秀', '汉明帝刘庄': '刘庄',
    # 唐（两《唐书》）
    '魏徵': '魏征',
    # 辽（《辽史·本纪》）
    '天祚帝': '耶律延禧', '辽天祚帝': '耶律延禧',
    # 宋（《宋史·本纪》）
    '宋孝宗': '赵昚',
    # 科技/文化人物（本名异体）
    '毕昇': '毕升', '监禄': '史禄', '萧太后': '萧绰', '承天太后': '萧绰',
    '陶渊明': '陶潜', '陶潛': '陶潜',
    # 北魏
    '北魏太武帝': '拓跋焘', '北魏孝文帝': '元宏',
    # 松赞干布
    '松赞干布': '勃窣野论赞',
    # 异体字/繁简差异
    '赵孟頫': '赵孟𫖯',
    # 帝王本名（维基/正史）
    '乾隆帝': '爱新觉罗弘历', '清高宗': '爱新觉罗弘历',
    '明英宗': '朱祁镇', '明太祖': '朱元璋', '明成祖': '朱棣',
    '商纣王': '帝辛', '殷纣王': '帝辛',
    '姜子牙': '太公望', '姜尚': '太公望', '吕尚': '太公望',
    # 五代
    '李存勖': '唐庄宗',
}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS hist_alias")
    con.execute("CREATE TABLE hist_alias(alias TEXT PRIMARY KEY, real_name TEXT, note TEXT)")
    con.executemany("INSERT OR REPLACE INTO hist_alias VALUES (?,?,?)",
                    [(k, v, '正史本名/异体') for k, v in ALIAS.items()])
    con.commit()
    print(f"✓ hist_alias: {len(ALIAS)} 条")
    for r in con.execute("SELECT alias,real_name FROM hist_alias LIMIT 10"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
