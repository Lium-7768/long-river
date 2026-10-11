#!/usr/bin/env python3
"""用《资治通鉴》补全已知人物（汉/唐等）的**事迹描述 + 出处**。

策略：资治通鉴是编年体，人物名已知。对 DB 中已有的人物（按姓名精确匹配），
若其在资治通鉴某卷出现，则记录「首次出现上下文」与卷号作 source，
用于**补全 summary（事迹）** 并标注**可核验出处**。

用法：
    python3 etl/enrich_from_zztj.py <资治通鉴目录> <目标朝代id> <out.jsonl>
"""
import json, os, re, sqlite3, sys

# 卷 → 朝代段（按资治通鉴编纂顺序）
# 周纪1-5 / 秦纪6-8 / 汉纪9-68 / 魏纪69-78 / 晋纪79-118 /
# 宋纪119-134 / 齐纪135-144 / 梁纪145-166 / 陈纪167-176 /
# 隋纪177-184 / 唐纪185-265 / 后梁唐晋汉周纪266-294
SEG = [
    (1, 5, "zhou-e"), (6, 8, "qin"), (9, 68, "han"),
    (69, 78, "sanguo"), (79, 118, "jin"), (119, 134, "nanbei"),
    (135, 144, "nanbei"), (145, 166, "nanbei"), (167, 176, "nanbei"),
    (177, 184, "sui"), (185, 265, "tang"), (266, 294, "wudai"),
]


def seg_of(chapter):
    for lo, hi, dy in SEG:
        if lo <= chapter <= hi:
            return dy
    return None


def main():
    src, want_dy, out = sys.argv[1], sys.argv[2], sys.argv[3]

    # DB 中的姓名（限目标朝代）
    con = sqlite3.connect("data/lr-song.sqlite3")
    names = set()
    for (nm,) in con.execute(
            "SELECT DISTINCT name FROM persons WHERE dynasty_id=? AND length(name)>=2 AND length(name)<=4",
            (want_dy,)):
        names.add(nm)
    print(f"DB 中 {want_dy} 候选名 {len(names)}")

    recs = {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".md"):
            continue
        raw = open(os.path.join(src, fn), encoding="utf-8").read()
        m = re.search(r"chapter:\s*(\d+)", raw)
        ch = int(m.group(1)) if m else 0
        seg = seg_of(ch)
        if seg != want_dy and not (want_dy == "han" and seg == "han"):
            # 汉拆两段：<23 西汉，>=23 东汉（粗略：汉纪9-68 前半西汉后半东汉）
            pass
        body = raw.split("---", 2)[-1]
        # 确定本卷朝代
        if want_dy in ("han-w", "han-e"):
            half = "han-w" if ch <= 38 else "han-e"  # 汉纪9-68，约前38卷西汉
            if seg != "han":
                continue
            rec_dy = half
        else:
            if seg != want_dy:
                continue
            rec_dy = want_dy

        head = re.search(r"title:\s*(.+)$", raw, re.M)
        vol = head.group(1).strip() if head else fn
        for nm in names:
            # 边界校验：避免「大王尊之」被当作「王尊」
            idxs = [mm.start() for mm in re.finditer(re.escape(nm), body)]
            ok = False
            for i in idxs:
                prev = body[i - 1] if i > 0 else "。"
                nxt = body[i + len(nm)] if i + len(nm) < len(body) else "。"
                # 前字是常见「人名首字/称谓」→ 可能被吞进气（如 雍王+章邯）
                if prev in "大小王公侯伯子男其之此是欲使令与从及至为以夫天地人曰":
                    continue
                # 后字是动词/语气 → 边界清晰
                if nxt in "曰为拜卒死立封攻伐谋杀言谓谏谏之与从及至欲令":
                    ok = True
                    break
                # 前后都是句读 → 也接受
                if prev in "。，；、：\n" and nxt in "。，；、：\n":
                    ok = True
                    break
            if ok:
                rec = recs.setdefault(nm, {
                    "name": nm, "dynasty": rec_dy, "polity": None,
                    "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                    "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                    "desc": None, "source": f"《资治通鉴》{vol}", "prominence": 6,
                    "cbdb_id": None, "_dynasty_id": rec_dy,
                })
                if not rec["desc"]:
                    i = body.find(nm)
                    # 取人名所在整句（前到。；后到。；）
                    st = max(body.rfind("。", 0, i), body.rfind("；", 0, i),
                             body.rfind("\n", 0, i)) + 1
                    en = min([x for x in (body.find("。", i), body.find("；", i),
                              body.find("\n", i)) if x > 0] or [i + 60])
                    sent = body[st:en].strip().replace("\n", "")
                    rec["desc"] = sent[:80] if 6 <= len(sent) <= 120 else body[i:i + 50].replace("\n", "")[:50]

    with open(out, "w", encoding="utf-8") as f:
        for r in recs.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"✓ 匹配 {len(recs)} 人 → {out}")


if __name__ == "__main__":
    main()
