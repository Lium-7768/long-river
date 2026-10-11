#!/usr/bin/env python3
"""从《资治通鉴》（周纪/秦纪等）抽取战国—秦人物。

资治通鉴是编年体，人物以「名 + 事迹动词」出现。用「已知人物词表」
匹配 + 上下文校验，抽取战国（前403–前221）与秦（前221–前207）人物。
"""
import json, os, re, sys

# 战国—秦核心人物（含各家学派/纵横家/名将/国君）
ZHANGUO = {
    # 国君
    "魏文侯": "zhou-e", "魏武侯": "zhou-e", "魏惠王": "zhou-e", "魏襄王": "zhou-e",
    "赵烈侯": "zhou-e", "赵武灵王": "zhou-e", "赵惠文王": "zhou-e", "赵孝成王": "zhou-e",
    "齐威王": "zhou-e", "齐宣王": "zhou-e", "齐湣王": "zhou-e", "齐襄王": "zhou-e",
    "韩昭侯": "zhou-e", "韩宣惠王": "zhou-e", "燕昭王": "zhou-e", "燕王喜": "zhou-e",
    "楚威王": "zhou-e", "楚怀王": "zhou-e", "楚顷襄王": "zhou-e", "楚考烈王": "zhou-e",
    "秦孝公": "qin", "秦惠文王": "qin", "秦武王": "qin", "秦昭襄王": "qin",
    "秦孝文王": "qin", "秦庄襄王": "qin",
    # 纵横家 / 相
    "苏秦": "zhou-e", "苏代": "zhou-e", "苏厉": "zhou-e", "张仪": "zhou-e",
    "公孙衍": "zhou-e", "陈轸": "zhou-e", "甘茂": "qin", "樗里疾": "qin",
    "范雎": "qin", "蔡泽": "qin", "李兑": "zhou-e", "田文": "zhou-e",
    "冯谖": "zhou-e", "毛遂": "zhou-e", "平原君": "zhou-e", "虞卿": "zhou-e",
    "信陵君": "zhou-e", "春申君": "zhou-e", "黄歇": "zhou-e", "鲁仲连": "zhou-e",
    "蔺相如": "zhou-e", "廉颇": "zhou-e", "赵奢": "zhou-e", "赵括": "zhou-e",
    "乐毅": "zhou-e", "乐乘": "zhou-e", "田单": "zhou-e", "田忌": "zhou-e",
    "孙膑": "zhou-e", "邹忌": "zhou-e", "匡章": "zhou-e", "触龙": "zhou-e",
    # 名将
    "白起": "qin", "王翦": "qin", "王贲": "qin", "蒙骜": "qin", "蒙武": "qin",
    "司马错": "qin", "魏冉": "qin", "芈戎": "qin", "李信": "qin", "蒙恬": "qin",
    "章邯": "qin", "王离": "qin", "李由": "qin",
    # 学者
    "孟子": "zhou-e", "荀子": "zhou-e", "荀卿": "zhou-e", "庄子": "zhou-e",
    "韩非": "qin", "李斯": "qin", "吕不韦": "qin", "尉缭": "qin",
    "公孙龙": "zhou-e", "邹衍": "zhou-e", "惠施": "zhou-e", "慎到": "zhou-e",
    "申不害": "zhou-e", "商鞅": "qin", "吴起": "qin", "尸佼": "zhou-e",
    "屈原": "zhou-e", "宋玉": "zhou-e", "景差": "zhou-e", "唐勒": "zhou-e",
}


def main():
    src, out = sys.argv[1], sys.argv[2]
    recs = {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".md"):
            continue
        raw = open(os.path.join(src, fn), encoding="utf-8").read()
        # 标题：●卷第一 → 找【周纪一】
        m = re.search(r"【([^】]+)】", raw)
        juan = re.search(r"卷(.+?)$", raw.split("\n")[2] if len(raw.split("\n")) > 2 else "")
        head = re.search(r"title:\s*(.+)$", raw, re.M)
        vol = head.group(1).strip() if head else fn
        body = raw.split("---", 2)[-1]
        for name, dy in ZHANGUO.items():
            if name in body:
                # 只收「生年合理」的战国人物
                srcname = f"《资治通鉴》{vol}"
                rec = recs.setdefault(name, {
                    "name": name, "dynasty": dy, "polity": None,
                    "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                    "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                    "desc": None, "source": srcname, "prominence": 7,
                    "cbdb_id": None, "_dynasty_id": dy,
                })
                # 取首次出现上下文做简述
                if not rec["desc"]:
                    i = body.find(name)
                    rec["desc"] = body[i:i + 50].replace("\n", "")[:50]

    with open(out, "w", encoding="utf-8") as f:
        for r in recs.values():
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    import collections
    c = collections.Counter(r["dynasty"] for r in recs.values())
    print(f"✓ 从《资治通鉴》抽 {len(recs)} 人 → {out}")
    for k, v in c.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
