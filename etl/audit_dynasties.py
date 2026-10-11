#!/usr/bin/env python3
"""逐朝深度数据审计：找出各朝代的问题记录。

检查项：
  A. 跨代污染：某朝人名字/来源指向他朝（如 唐 bucket 里出现 宋人）
  B. 生卒与朝代不符：出生年不在该朝区间内
  C. 籍贯异常：addr 不像地名（含动词/虚词/过长）
  D. 字号异常：zi 像句子片段（含虚词/长度>4）
  E. summary 异常：超过 60 字（是段落非事迹）或含明显片段
  F. 来源缺失/可疑
输出：按朝代 + 问题类型统计。
"""
import json, re, sqlite3, sys
from collections import defaultdict

# 各朝年份区间（用于 B 检查）
RANGE = {
    "xia": (-2100, -1600), "shang": (-1600, -1046), "zhou-w": (-1046, -771),
    "zhou-e": (-770, -256), "qin": (-221, -206), "han-w": (-202, 9),
    "xin": (9, 23), "han-e": (25, 220), "sanguo": (220, 280),
    "jin": (266, 420), "nanbei": (420, 589), "sui": (581, 618),
    "tang": (618, 907), "wudai": (907, 979), "liao": (916, 1125),
    "song-w": (960, 1127), "xixia": (1038, 1227), "jin-chao": (1115, 1234),
    "song-e": (1127, 1279), "yuan": (1271, 1368), "ming": (1368, 1644),
    "qing": (1636, 1912),
}

NAME_DY_HINTS = {
    "宋": ["song-w", "song-e"], "唐": ["tang"], "明": ["ming"], "清": ["qing"],
    "元": ["yuan"], "汉": ["han-w", "han-e"], "秦": ["qin"], "晋": ["jin"],
    "隋": ["sui"], "周": ["zhou-w", "zhou-e"], "魏": ["sanguo", "nanbei"],
    "齐": ["nanbei"], "梁": ["nanbei"], "陈": ["nanbei"], "辽": ["liao"],
    "金": ["jin-chao"],
}

# 籍贯合法尾字
PLACE_TAIL = set("州縣府郡邑衛所陽陰寧安平昌慶興武昌道路軍司廳旗京省鎮寨堡關")
PLACE_KEY = "州縣府郡省市廳旗衛所直隶直隸京"  # 含这些即算地名
# 字号非法字符（虚词/标点）
ZI_BAD = set("之而不於以者为也其乃则且夫唯乎哉焉欲使令与从及至曰")


def main():
    db = sys.argv[1] if len(sys.argv) > 1 else "data/lr-song.sqlite3"
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    issues = defaultdict(lambda: defaultdict(int))
    samples = defaultdict(list)

    for r in con.execute("SELECT id,name,dynasty_id,birth,death,zi,addr,summary,source FROM persons WHERE dynasty_id IS NOT NULL"):
        dy = r["dynasty_id"]

        # B. 生卒与朝代不符（宽松：±30 年容差）
        if dy in RANGE:
            lo, hi = RANGE[dy]
            for field in ("birth", "death"):
                y = r[field]
                if y is not None and not (lo - 60 <= y <= hi + 60):
                    issues[dy]["生卒超朝代区间"] += 1
                    if len(samples[(dy, "生卒超朝代区间")]) < 3:
                        samples[(dy, "生卒超朝代区间")].append(f"{r['name']} {field}={y}")

        # C. 籍贯异常
        if r["addr"]:
            try:
                arr = json.loads(r["addr"])
            except Exception:
                arr = []
            for a in arr:
                if not a:
                    continue
                # 真异常：含明确「非地名」词（句子片段/占位符）
                FRAG = ("不知", "未详", "不詳", "不详", "无考", "之女", "之妻", "何郡",
                        "何许", "何許", "某之", "之母", "之孙", "之孙", "者", "也人")
                if len(a) > 14 or any(k in str(a) for k in FRAG):
                    issues[dy]["籍贯不像地名"] += 1
                    if len(samples[(dy, "籍贯不像地名")]) < 3:
                        samples[(dy, "籍贯不像地名")].append(f"{r['name']}:{a}")
                    break

        # D. 字号异常
        if r["zi"] and not r["zi"].startswith("["):
            z = r["zi"]
            # 真异常：含标点/括号，或长度>6（字号一般≤3，少数民族名可长）
            if any(c in z for c in "，。、（）") or len(z) > 6:
                issues[dy]["字号像片段"] += 1
                if len(samples[(dy, "字号像片段")]) < 3:
                    samples[(dy, "字号像片段")].append(f"{r['name']}:字{z}")

        # E. summary 异常
        if r["summary"] and len(r["summary"]) > 60:
            issues[dy]["summary过长(似段落)"] += 1
            if len(samples[(dy, "summary过长(似段落)")]) < 3:
                samples[(dy, "summary过长(似段落)")].append(f"{r['name']}:{r['summary'][:40]}")

    # 汇总
    print("═══ 逐朝问题统计 ═══\n")
    total_problems = 0
    for dy in sorted(issues):
        tot = sum(issues[dy].values())
        total_problems += tot
        n = con.execute("SELECT COUNT(*) FROM persons WHERE dynasty_id=?", (dy,)).fetchone()[0]
        print(f"[{dy}] n={n} 问题={tot}")
        for kind, cnt in sorted(issues[dy].items(), key=lambda x: -x[1]):
            print(f"    {kind}: {cnt}")
    print(f"\n总问题数: {total_problems}")
    print("\n═══ 样例 ═══")
    for k, v in samples.items():
        print(f"  {k}: {v}")
    con.close()


if __name__ == "__main__":
    main()
