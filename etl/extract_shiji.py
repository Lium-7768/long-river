#!/usr/bin/env python3
"""从《史记》等正史全文抽取人物（姓名/字号/传记/籍贯/出处）。

数据源：the-quizzman/shiji（《史记》130 卷 markdown，维基文库校对）
输出：persons 结构（供 merge 用），每条带**原典出处**（史记·卷X·篇名）+ 传记首句。

提取规则（正史列传标准句式）：
  - 「XXX者，YY人也」         → 姓名 + 籍贯
  - 「字ZZ」/「字ZZ」          → 字
  - 「XXX，字ZZ，YY人也」      → 综合
  - 篇名如「卷六十三 老子韩非列传」→ 传主

用法：
    python3 etl/extract_shiji.py /tmp/shiji data/build/shiji_persons.jsonl
"""
import json, os, re, sys

# 篇名 → 主要传主（列传/世家的主角）
TITLE_MAIN = {
    "项羽本纪": "项羽", "高祖本纪": "刘邦", "吕太后本纪": "吕雉",
    "秦始皇本纪": "秦始皇", "秦本纪": "秦襄公",
    "吴太伯世家": "吴太伯", "齐太公世家": "太公望", "鲁周公世家": "周公旦",
    "管蔡世家": "管叔鲜", "陈杞世家": "陈胡公", "卫康叔世家": "卫康叔",
    "晋世家": "晋唐叔虞", "楚世家": "楚熊绎", "越王句践世家": "勾践",
    "郑世家": "郑桓公", "韩世家": "韩武子", "田敬仲完世家": "田完",
    "孔子世家": "孔丘", "萧相国世家": "萧何", "曹相国世家": "曹参",
    "留侯世家": "张良", "陈丞相世家": "陈平", "外戚世家": "窦漪房",
    "伯夷列传": "伯夷", "老子韩非列传": "老子", "司马穰苴列传": "司马穰苴",
    "孙子吴起列传": "孙武", "伍子胥列传": "伍子胥", "仲尼弟子列传": "颜回",
    "商君列传": "商鞅", "苏秦列传": "苏秦", "张仪列传": "张仪",
    "樗里子甘茂列传": "樗里疾", "白起王翦列传": "白起", "孟子荀卿列传": "孟子",
    "孟尝君列传": "孟尝君", "平原君虞卿列传": "平原君", "魏公子列传": "信陵君",
    "春申君列传": "春申君", "廉颇蔺相如列传": "廉颇", "田单列传": "田单",
    "鲁仲连邹阳列传": "鲁仲连", "屈原贾生列传": "屈原", "吕不韦列传": "吕不韦",
    "李斯列传": "李斯", "蒙恬列传": "蒙恬", "黥布列传": "英布",
    "淮阴侯列传": "韩信", "田儋列传": "田儋", "张丞相列传": "张苍",
    "郦生陆贾列传": "郦食其", "刘敬叔孙通列传": "刘敬", "袁盎晁错列传": "袁盎",
    "扁鹊仓公列传": "扁鹊", "李将军列传": "李广", "卫将军骠骑列传": "卫青",
    "平津侯主父列传": "公孙弘", "南越列传": "赵佗",
    "司马相如列传": "司马相如", "汲郑列传": "汲黯", "儒林列传": "伏生",
    "酷吏列传": "郅都", "大宛列传": "张骞", "货殖列传": "范蠡",
    "游侠列传": "郭解", "刺客列传": "荆轲", "魏其武安侯列传": "窦婴",
    "韩长孺列传": "韩安国", "五宗世家": "刘荣", "梁孝王世家": "刘武",
    "淮南衡山列传": "刘安", "吴王濞列传": "刘濞",
}

# 篇名 → 所属朝代
TITLE_DY = {
    "五帝本纪": "zhou-e", "夏本纪": "xia", "殷本纪": "shang",
    "周本纪": "zhou-w", "秦本纪": "qin", "秦始皇本纪": "qin",
    "项羽本纪": "qin", "高祖本纪": "han-w", "吕太后本纪": "han-w",
    "孝文本纪": "han-w", "孝景本纪": "han-w",
    "吴太伯世家": "zhou-e", "齐太公世家": "zhou-w", "鲁周公世家": "zhou-w",
    "管蔡世家": "zhou-w", "陈杞世家": "zhou-e", "卫康叔世家": "zhou-w",
    "晋世家": "zhou-e", "楚世家": "zhou-w", "越王句践世家": "zhou-e",
    "郑世家": "zhou-e", "韩世家": "zhou-e", "田敬仲完世家": "zhou-e",
    "孔子世家": "zhou-e",
    "伯夷列传": "zhou-w", "老子韩非列传": "zhou-e", "司马穰苴列传": "zhou-e",
    "孙子吴起列传": "zhou-e", "伍子胥列传": "zhou-e", "仲尼弟子列传": "zhou-e",
    "商君列传": "qin", "苏秦列传": "zhou-e", "张仪列传": "zhou-e",
    "樗里子甘茂列传": "qin", "白起王翦列传": "qin", "孟子荀卿列传": "zhou-e",
    "孟尝君列传": "zhou-e", "平原君虞卿列传": "zhou-e", "魏公子列传": "zhou-e",
    "春申君列传": "zhou-e", "廉颇蔺相如列传": "zhou-e", "田单列传": "zhou-e",
    "鲁仲连邹阳列传": "zhou-e", "屈原贾生列传": "zhou-e", "吕不韦列传": "qin",
    "李斯列传": "qin", "蒙恬列传": "qin", "黥布列传": "han-w",
    "淮阴侯列传": "han-w", "田儋列传": "han-w", "张丞相列传": "han-w",
    "郦生陆贾列传": "han-w", "刘敬叔孙通列传": "han-w", "袁盎晁错列传": "han-w",
    "扁鹊仓公列传": "han-w", "李将军列传": "han-w", "卫将军骠骑列传": "han-w",
    "平津侯主父列传": "han-w", "南越列传": "han-w",
    "司马相如列传": "han-w", "汲郑列传": "han-w",
}

# 姓名合法性
def valid_name(n):
    if not n or len(n) < 2 or len(n) > 4:
        return False
    # 不能含标点/数字
    return bool(re.fullmatch(r"[\u4e00-\u9fff]+", n))


def parse_chapter(path):
    raw = open(path, encoding="utf-8").read()
    m = re.search(r"^title:\s*(.+)$", raw, re.M)
    title = m.group(1).strip() if m else ""
    # 去掉「卷X 」前缀 + 末尾「第N」序号
    tname = re.sub(r"^卷[一二三四五六七八九十百]+[\s　]*", "", title)
    tname = re.sub(r"第[一二三四五六七八九十百]+$", "", tname).strip()
    volm = re.search(r"卷([一二三四五六七八九十百]+)", title)
    vol = volm.group(1) if volm else "?"
    body = raw.split("---", 2)[-1]
    return title, tname, vol, body


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shiji"
    out = sys.argv[2] if len(sys.argv) > 2 else "data/build/shiji_persons.jsonl"
    recs = {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".md"):
            continue
        title, tname, vol, body = parse_chapter(os.path.join(src, fn))
        dy = TITLE_DY.get(tname)
        if not dy:
            continue
        srcname = f"《史记·卷{vol}·{tname}》"
        # 只抽「开篇传主」：正文首句的「XXX者，…（人也|，字Y）」——精度最高
        paras=[pp.strip() for pp in body.split("\n") if pp.strip() and not pp.startswith("#")]
        if paras:
            first=paras[0]
            m=re.match(r"([\u4e00-\u9fff]{2,4})者[，,]", first)
            if m:
                nm=m.group(1)
                person=recs.setdefault(nm, {
                    "name": nm, "dynasty": dy, "polity": None,
                    "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                    "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                    "desc": None, "source": srcname, "prominence": 7,
                    "cbdb_id": None, "_dynasty_id": dy,
                })
                z=re.search(r"字([\u4e00-\u9fff]{1,3})", first)
                if z: person["zi"]=[z.group(1)]
                pl=re.search(r"者[，,]([\u4e00-\u9fff]{1,6}?)(?:人也|人)[，,。]", first)
                if pl: person["addr_names"]=[pl.group(1)]
                person["desc"]=person["desc"] or first[:60]

        # 全书扫描：仅「XXX者，YY人也」或「XXX者，…，字ZZ」（强信号）
        for m in re.finditer(
                r"([\u4e00-\u9fff]{2,4})者[，,]([^。]{0,30}?)(人也|，字([\u4e00-\u9fff]{1,3}))",
                body):
            name=m.group(1)
            if not valid_name(name):
                continue
            rec=recs.setdefault(name, {
                "name": name, "dynasty": dy, "polity": None,
                "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                "desc": None, "source": srcname, "prominence": 6,
                "cbdb_id": None, "_dynasty_id": dy,
            })
            if m.group(4): rec["zi"]=[m.group(4)]
            pm=re.search(r"^([\u4e00-\u9fff]{1,6}?)人?$", m.group(2))
            if pm: rec["addr_names"]=[pm.group(1)]

        # 篇名主传主
        main_person = TITLE_MAIN.get(tname)
        if main_person and valid_name(main_person):
            rec = recs.setdefault(main_person, {
                "name": main_person, "dynasty": dy, "polity": None,
                "birth": None, "death": None, "zi": [], "hao": [], "shi": [],
                "addr_names": [], "office": [], "kin": [], "entry": [], "works": [],
                "desc": None, "source": srcname, "prominence": 7,
                "cbdb_id": None, "_dynasty_id": dy,
            })
            rec["desc"] = rec["desc"] or f"{tname}传主"

    rows = list(recs.values())
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"✓ 从《史记》抽取 {len(rows)} 人 → {out}")
    # 按朝代统计
    import collections
    c = collections.Counter(r["dynasty"] for r in rows)
    for k, v in c.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
