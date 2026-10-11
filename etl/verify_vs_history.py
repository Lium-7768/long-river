#!/usr/bin/env python3
"""补数据C16：史料互证——用正史全文核验人物卒年。

方法：对库内（朝代有对应正史）人物，在正史全文里找
  「{姓名}…卒，年{汉字数}」→ 折算享年；再用享年+生年 → 推算卒年，
  与库内 death 对比，统计一致/矛盾，产出报告。
"""
import sqlite3, os, re
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "史料互证报告.md")

# 朝代 → 正史书名
DYN_BOOK = {
    'song-w': '宋史', 'song-e': '宋史', 'tang': '旧唐书', 'han-w': '汉书',
    'han-e': '后汉书', 'ming': '明史', 'qing': '清史稿', 'sui': '隋书',
    'jin': '晋书', 'han-e-2': '后汉书',
}
CN = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
      '十': 10, '二十': 20, '三十': 30, '四十': 40, '五十': 50, '六十': 60, '七十': 70,
      '八十': 80, '九十': 90, '百': 100}


def cn_num(s):
    """汉字数（一~百）→ 整数，仅支持常见形式。"""
    s = s.strip()
    if s in CN:
        return CN[s]
    # 十X / X十 / X十Y
    total = 0
    if '百' in s:
        p = s.split('百')
        total += (CN.get(p[0], 1) or 1) * 100
        s = p[1] if len(p) > 1 else ''
    m = re.match(r'^([一二三四五六七八九]?)十([一二三四五六七八九]?)$', s)
    if m:
        tens = CN.get(m.group(1), 1) if m.group(1) else 1
        ones = CN.get(m.group(2), 0) if m.group(2) else 0
        return total + tens * 10 + ones
    if s in CN:
        return total + CN[s]
    return None


def main():
    con = sqlite3.connect(DB)
    lines = ["# 史料互证报告：正史卒年 vs 库内卒年\n",
             "> 用对应朝代正史全文抽取「卒，年XX」推算卒年，与 persons.death 交叉核验。\n"]
    grand = {'tested': 0, 'hit': 0, 'match': 0, 'conflict': 0}
    for dyn, book in DYN_BOOK.items():
        have = con.execute("SELECT COUNT(*) FROM texts WHERE book=?", (book,)).fetchone()[0]
        if not have:
            continue
        tested = hit = match = conflict = 0
        examples = []
        for name, birth, death in con.execute(
                "SELECT name,birth,death FROM persons WHERE dynasty_id=? "
                "AND death IS NOT NULL AND name IS NOT NULL AND length(name)>=2 LIMIT 3000", (dyn,)):
            tested += 1
            rows = con.execute("SELECT content FROM texts WHERE book=? AND content LIKE ?",
                               (book, '%' + name + '%')).fetchall()
            if not rows:
                continue
            ok = False
            for (content,) in rows:
                # 必须命中传记锚：姓名 + 字/号 或 「XX，XX人也」，再找卒年
                bio = re.search(re.escape(name) + r'[，,]?字[\u4e00-\u9fa5]{1,3}', content)
                if not bio:
                    continue
                seg = content[bio.start():bio.start() + 6000]
                m = re.search(r'(卒|薨)[^。]{0,20}?年([一二三四五六七八九十百]{1,4})', seg, re.S)
                if not m:
                    continue
                age = cn_num(m.group(2))
                if not age or age < 15 or age > 110:
                    continue
                hit += 1
                ok = True
                if birth:
                    calc = birth + age
                    if abs(calc - death) <= 3:
                        match += 1
                    elif abs(calc - death) > 8:
                        conflict += 1
                        if len(examples) < 5:
                            examples.append((name, birth, death, age, calc))
                break
            if ok:
                pass
        grand['tested'] += tested
        grand['hit'] += hit
        grand['match'] += match
        grand['conflict'] += conflict
        lines.append(f"\n## {dyn}（{book}）\n")
        lines.append(f"- 检测人物：{tested:,}")
        lines.append(f"- 正史命中「卒年」：{hit:,}")
        if hit:
            lines.append(f"- 与库内卒年一致（±3）：{match:,}（{match/hit*100:.1f}%）")
            lines.append(f"- 明显矛盾（>8年）：{conflict:,}")
        for ex in examples:
            lines.append(f"  - {ex[0]}：生{ex[1]} 享年{ex[3]} → 推算卒{ex[4]}，库内卒{ex[2]}")
    lines.append(f"\n## 总览\n")
    lines.append(f"- 总计检测：{grand['tested']:,}")
    lines.append(f"- 正史命中：{grand['hit']:,}")
    if grand['hit']:
        lines.append(f"- 一致：{grand['match']:,}（{grand['match']/grand['hit']*100:.1f}%）")
        lines.append(f"- 矛盾：{grand['conflict']:,}（{grand['conflict']/grand['hit']*100:.1f}%）")
    open(OUT, 'w', encoding='utf-8').write("\n".join(lines))
    print(f"✓ 报告写入 {OUT}")
    print(f"  检测 {grand['tested']:,} / 命中 {grand['hit']:,} / 一致 {grand['match']:,} / 矛盾 {grand['conflict']:,}")
    con.close()


if __name__ == "__main__":
    main()
