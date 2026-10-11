#!/usr/bin/env python3
"""通用正史抽取器：从公版史书全文（纪传体）抽人物。

支持：史记、汉书、后汉书（the-quizzman 系列，维基文库校对）
抽取「XXX者，…（人也 | ，字Y）」强信号 + 篇章名主传主。
输出 persons 结构（同 extract_shiji.py），带原典出处。

用法：
    python3 etl/extract_histories.py <书目录> <书名> <朝代映射模式> <out.jsonl>
朝代映射模式：shiji | hanshu | houhanshu | auto
"""
import json, os, re, sys

# 篇章名关键词 → 朝代
DY_KEYWORDS = [
    # 后汉书 / 三国
    ("光武", "han-e"), ("显宗", "han-e"), ("肃宗", "han-e"),
    ("三国", "sanguo"), ("魏", "sanguo"), ("蜀", "sanguo"), ("吴", "sanguo"),
    # 汉书
    ("高帝", "han-w"), ("惠帝", "han-w"), ("高后", "han-w"), ("文帝", "han-w"),
    ("景帝", "han-w"), ("武帝", "han-w"), ("昭帝", "han-w"), ("宣帝", "han-w"),
    ("元帝", "han-w"), ("成帝", "han-w"), ("哀帝", "han-w"), ("平帝", "han-w"),
    # 史记
    ("五帝", "zhou-e"), ("夏本纪", "xia"), ("殷本纪", "shang"), ("周本纪", "zhou-w"),
    ("秦本纪", "qin"), ("秦始皇", "qin"), ("项羽", "qin"),
    ("高祖", "han-w"), ("吕太后", "han-w"), ("孝文", "han-w"), ("孝景", "han-w"),
]


def guess_dy(title, default):
    for kw, dy in DY_KEYWORDS:
        if kw in title:
            return dy
    return default


def valid_name(n):
    return bool(n) and 2 <= len(n) <= 4 and bool(re.fullmatch(r"[\u4e00-\u9fff]+", n))


def parse_title(raw):
    m = re.search(r"^title:\s*(.+)$", raw, re.M)
    title = m.group(1).strip() if m else ""
    tname = re.sub(r"^卷[一二三四五六七八九十百]+[上下]*[\s　]*", "", title)
    tname = re.sub(r"第[一二三四五六七八九十百]+[上下]?$", "", tname).strip()
    volm = re.search(r"卷([一二三四五六七八九十百]+)", title)
    return title, tname, (volm.group(1) if volm else "?")


def main():
    src, bookname, default_dy, out = (
        sys.argv[1], sys.argv[2],
        sys.argv[3] if len(sys.argv) > 3 else "auto",
        sys.argv[4] if len(sys.argv) > 4 else "etl/build/hist.jsonl")

    recs = {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".md"):
            continue
        raw = open(os.path.join(src, fn), encoding="utf-8").read()
        title, tname, vol = parse_title(raw)
        dy = guess_dy(title, default_dy)
        if dy == "auto":
            continue
        srcname = f"《{bookname}·卷{vol}·{tname}》" if tname else f"《{bookname}·卷{vol}》"
        body = raw.split("---", 2)[-1]

        # 模式 A：全名+字，如「张步字文公，琅邪不其人也」
        for m in re.finditer(
                r"([\u4e00-\u9fff]{2,4})字([\u4e00-\u9fff]{1,3})[，,]([^。]{0,20}?)(人也|人)",
                body):
            name = m.group(1)
            if not valid_name(name) or name[-1] in "也矣之者而以其於不所为与则且乃乎哉焉":
                continue
            rec = recs.setdefault(name, {
                "name": name, "dynasty": dy, "polity": None,
                "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                "desc": None, "source": srcname, "prominence": 6,
                "cbdb_id": None, "_dynasty_id": dy,
            })
            rec["zi"] = [m.group(2)]
            pm = re.search(r"^([\u4e00-\u9fff]{1,6}?)人?$", m.group(3))
            if pm and not rec["addr_names"]:
                rec["addr_names"] = [pm.group(1)]
            if not rec["desc"]:
                rec["desc"] = body[m.start():m.start() + 50].replace("\n", "")[:50]

        # 模式 B：XXX（者）？，…（人也 | 字Y）
        for m in re.finditer(
                r"([\u4e00-\u9fff]{2,4})者[，,]([^。]{0,25}?)(人也|，字([\u4e00-\u9fff]{1,3}))",
                body):
            name = m.group(1)
            if not valid_name(name):
                continue
            if name[-1] in "也矣之者而以其於不所为与则且乃乎哉焉":
                continue
            rec = recs.setdefault(name, {
                "name": name, "dynasty": dy, "polity": None,
                "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                "desc": None, "source": srcname, "prominence": 5,
                "cbdb_id": None, "_dynasty_id": dy,
            })
            if m.group(4):
                rec["zi"] = [m.group(4)]
            pm = re.search(r"^([\u4e00-\u9fff]{1,6}?)人?$", m.group(2))
            if pm and not rec["addr_names"]:
                rec["addr_names"] = [pm.group(1)]
            if not rec["desc"]:
                rec["desc"] = body[m.start():m.start() + 50].replace("\n", "")[:50]

    with open(out, "w", encoding="utf-8") as f:
        for r in recs.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    import collections
    c = collections.Counter(r["dynasty"] for r in recs.values())
    print(f"✓ 《{bookname}》抽取 {len(recs)} 人 → {out}")
    for k, v in c.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
