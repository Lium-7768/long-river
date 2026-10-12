#!/usr/bin/env python3
"""补数据C46：帝王 庙号→本名 人工补全（史料公认）。

Wikidata 对清帝/部分帝王 native 缺失或为满文，补一张公认的庙号→本名表：
  康熙帝→玄烨、雍正帝→胤禛、乾隆帝→弘历、光绪帝→载湉 …
来源：《清史稿·本纪》《清实录》及清代帝王世系（公有领域）。
"""
import sqlite3, os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

# 庙号/通称 → (本名, 朝代id, 在位起, 在位止)
MANUAL = {
    # 清（《清史稿·本纪》）
    '清太祖': ('努尔哈赤', 'qing', 1616, 1626),
    '清太宗': ('皇太极', 'qing', 1626, 1643),
    '顺治帝': ('福临', 'qing', 1643, 1661),
    '康熙帝': ('玄烨', 'qing', 1661, 1722),
    '雍正帝': ('胤禛', 'qing', 1722, 1735),
    '乾隆帝': ('爱新觉罗弘历', 'qing', 1735, 1796),
    '嘉庆帝': ('颙琰', 'qing', 1796, 1820),
    '道光帝': ('旻宁', 'qing', 1820, 1850),
    '咸丰帝': ('奕詝', 'qing', 1850, 1861),
    '同治帝': ('载淳', 'qing', 1861, 1875),
    '光绪帝': ('载湉', 'qing', 1875, 1908),
    '宣统帝': ('溥仪', 'qing', 1908, 1912),
    # 明
    '嘉靖帝': ('朱厚熜', 'ming', 1521, 1567),
    '万历帝': ('朱翊钧', 'ming', 1572, 1620),
    '崇祯帝': ('朱由检', 'ming', 1627, 1644),
    '洪武帝': ('朱元璋', 'ming', 1368, 1398),
    '永乐帝': ('朱棣', 'ming', 1402, 1424),
    # 汉
    '汉武帝': ('刘彻', 'han-w', -141, -87),
    '汉高祖': ('刘邦', 'han-w', -202, -195),
    '汉光武帝': ('刘秀', 'han-e', 25, 57),
    '汉献帝': ('刘协', 'han-e', 189, 220),
    '汉文帝': ('刘恒', 'han-w', -180, -157),
    '汉景帝': ('刘启', 'han-w', -157, -141),
    '汉宣帝': ('刘询', 'han-w', -74, -49),
    # 唐
    '唐高祖': ('李渊', 'tang', 618, 626),
    '唐太宗': ('李世民', 'tang', 626, 649),
    '唐玄宗': ('李隆基', 'tang', 712, 756),
    '唐高宗': ('李治', 'tang', 649, 683),
    '武则天': ('武曌', 'tang', 690, 705),
    # 宋
    '宋太祖': ('赵匡胤', 'song-w', 960, 976),
    '宋仁宗': ('赵祯', 'song-w', 1022, 1063),
    '宋真宗': ('赵恒', 'song-w', 997, 1022),
    '宋神宗': ('赵顼', 'song-w', 1067, 1085),
    '宋徽宗': ('赵佶', 'song-e', 1100, 1126),
    '宋钦宗': ('赵桓', 'song-e', 1126, 1127),
    '宋高宗': ('赵构', 'song-e', 1127, 1162),
    '宋孝宗': ('赵昚', 'song-e', 1162, 1189),
    '宋理宗': ('赵昀', 'song-e', 1224, 1264),
    '宋恭帝': ('赵㬎', 'song-e', 1274, 1276),
    # 隋
    '隋文帝': ('杨坚', 'sui', 581, 604),
    '隋炀帝': ('杨广', 'sui', 604, 618),
    # 南北朝/晋
    '梁武帝': ('萧衍', 'nanbei', 502, 549),
    '北魏孝文帝': ('元宏', 'nanbei', 471, 499),
    '晋武帝': ('司马炎', 'jin', 266, 290),
    '晋元帝': ('司马睿', 'jin', 318, 323),
    # 秦
    '秦始皇': ('嬴政', 'qin', -221, -210),
}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    n_new = n_upd = 0
    for title, (native, dyn, s, e) in MANUAL.items():
        row = con.execute("SELECT qid FROM emperor WHERE title=? OR native=?", (title, native)).fetchone()
        if row:
            con.execute(
                "UPDATE emperor SET native=?, dynasty_id=?, reign_start=?, reign_end=? WHERE qid=?",
                (native, dyn, s, e, row[0]))
            n_upd += 1
        else:
            qid = 'manual-' + native
            con.execute("INSERT OR REPLACE INTO emperor VALUES (?,?,?,?,?,?,?,?,?)",
                        (qid, title, native, '["%s"]' % native, dyn, None, None, s, e))
            n_new += 1
    con.commit()
    print(f"✓ emperor 人工补全：新增 {n_new}，更新 {n_upd}")
    for r in con.execute("SELECT title,native,dynasty_id,reign_start,reign_end FROM emperor WHERE qid LIKE 'manual-%' LIMIT 8"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
