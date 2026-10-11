#!/usr/bin/env python3
"""横向对比：把 DB 中的人物生卒/身份与权威史实对照，标出疑误。

对照基准（正史/学界公认）：
- 生卒年参考：《史记》《汉书》《后汉书》《三国志》各本传、中国历史大辞典
- 身份：以正史本传为准
本脚本只做「自动初筛」，把可疑条目列出来供人工复核。
"""
import sqlite3, sys

DB = sys.argv[1] if len(sys.argv) > 1 else "data/lr-song.sqlite3"

# 公认生卒（±容差）。格式: name -> (birth, death, tolerance, 备注)
FACTS = {
    # 秦
    "秦始皇": (-259, -210, 2, "史记·秦始皇本纪"),
    "李斯":   (-284, -208, 6, "史记·李斯列传"),
    "蒙恬":   (-259, -210, 10, "史记·蒙恬列传"),
    "赵高":   (-258, -207, 8, "史记·秦始皇本纪"),
    # 商 / 先秦
    "纣王":   (None, -1046, 3, "史记·殷本纪 帝辛"),
    "周文王": (None, -1050, 8, "史记·周本纪（卒年有前1056/1050/1046 诸说）"),
    "伊尹":   (None, None, 0, "史记·殷本纪"),
    "妇好":   (-1250, -1200, 40, "殷墟甲骨/妇好墓"),
    # 西周
    "太公望": (None, -1015, 6, "史记·齐太公世家"),
    "周成王": (None, -1021, 5, "史记·周本纪"),
    # 春秋
    "齐桓公": (-725, -643, 5, "史记·齐太公世家"),
    "晋文公": (-697, -628, 5, "史记·晋世家"),
    "孔子":   (-551, -479, 1, "史记·孔子世家"),
    "孔丘":   (-551, -479, 1, "史记·孔子世家"),
    # 三国
    "曹操":   (155, 220, 2, "三国志·武帝纪"),
    "诸葛亮": (181, 234, 1, "三国志·诸葛亮传"),
    "刘备":   (161, 223, 2, "三国志·先主传"),
    "孙权":   (182, 252, 2, "三国志·吴主传"),
    "关羽":   (None, 220, 2, "三国志·关羽传"),
    "华佗":   (145, 208, 20, "三国志·华佗传"),
    # 新
    "王莽":   (-45, 23, 3, "汉书·王莽传"),
    # 五代
    "李煜":   (937, 978, 1, "宋史/南唐书"),
    "朱温":   (852, 912, 2, "旧五代史·梁太祖纪"),
    "石敬瑭": (892, 942, 2, "旧五代史·晋高祖纪"),
}

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
rows = con.execute(
    "SELECT name,birth,death,dynasty_id,source,summary FROM persons "
    "WHERE source LIKE 'Wikidata%'").fetchall()

print(f"检查 {len(rows)} 条 Wikidata 记录\n")
errors, warns, ok = [], [], 0
for r in rows:
    nm = r["name"]
    if nm not in FACTS:
        continue
    ob, od, tol, ref = FACTS[nm]
    db_b, db_d = r["birth"], r["death"]
    issues = []
    if ob is not None and db_b is not None and abs(db_b - ob) > tol:
        issues.append(f"生年 {db_b} ≠ {ob}(±{tol})")
    if od is not None and db_d is not None and abs(db_d - od) > tol:
        issues.append(f"卒年 {db_d} ≠ {od}(±{tol})")
    if issues:
        errors.append((nm, r["dynasty_id"], "; ".join(issues), ref))
    else:
        ok += 1

print(f"✓ 相符: {ok} 条")
print(f"✗ 疑误: {len(errors)} 条\n")
for nm, dy, msg, ref in errors:
    print(f"  [{dy}] {nm}: {msg}   ← 参考：{ref}")

# 额外检查：生年 > 卒年 / 生卒为 0 / 范围离谱
print("\n=== 结构异常 ===")
bad = con.execute(
    "SELECT name,birth,death,dynasty_id FROM persons "
    "WHERE source LIKE 'Wikidata%' AND ("
    " (birth IS NOT NULL AND death IS NOT NULL AND birth>=death) OR"
    " birth=0 OR death=0)").fetchall()
for r in bad[:20]:
    print(f"  [{r['dynasty_id']}] {r['name']}: {r['birth']}~{r['death']}")
print(f"  共 {len(bad)} 条")
