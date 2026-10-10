#!/usr/bin/env python3
"""合并 CBDB 硬事实与原型散文 → 生成完整宋段人物库。

策略（对齐 doc/requirements.md §8.1 分工原则 + 用户"不隐藏数据"铁律）：

  硬事实（生卒/字号/亲属/官职/入仕/籍贯）以 CBDB 为准；
  散文（summary）优先取原型已有者，无则留空待补；
  原型有而 CBDB 无的人物 → 保留（标 source=prototype）。

输出 etl/build/merged_persons.jsonl：每行一个可直接进 data.js 的 person 对象。
**不改动 prototype/data.js**——本脚本只产出候选数据集，合并入库需人工确认。

用法:
    python3 etl/merge_dataset.py [--out etl/build] [--only-core]
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")

try:
    from opencc import OpenCC
    T2S = OpenCC("t2s")
except ImportError:
    T2S = None

CBDB_SRC = "CBDB cbdb_20261003"

# 拼音声母韵母表（生成 id 用；与原型既有的 'su-shi' 风格一致）
# 这里不追求完美拼音——id 只需唯一且稳定；用 cbdb_id 兜底。
PINYIN = {
    "苏": "su", "王": "wang", "李": "li", "张": "zhang", "刘": "liu",
    "陈": "chen", "杨": "yang", "赵": "zhao", "黄": "huang", "周": "zhou",
    "吴": "wu", "徐": "xu", "孙": "sun", "胡": "hu", "朱": "zhu",
    "高": "gao", "林": "lin", "何": "he", "郭": "guo", "马": "ma",
    "罗": "luo", "梁": "liang", "宋": "song", "郑": "zheng", "谢": "xie",
    "韩": "han", "唐": "tang", "冯": "feng", "于": "yu", "董": "dong",
    "萧": "xiao", "程": "cheng", "曹": "cao", "袁": "yuan", "邓": "deng",
    "许": "xu", "傅": "fu", "沈": "shen", "曾": "zeng", "彭": "peng",
    "吕": "lv", "苏": "su", "卢": "lu", "蒋": "jiang", "蔡": "cai",
    "贾": "jia", "丁": "ding", "魏": "wei", "薛": "xue", "叶": "ye",
    "阎": "yan", "余": "yu", "潘": "pan", "杜": "du", "戴": "dai",
    "夏": "xia", "钟": "zhong", "汪": "wang", "田": "tian", "任": "ren",
    "姜": "jiang", "范": "fan", "方": "fang", "石": "shi", "姚": "yao",
    "谭": "tan", "廖": "liao", "邹": "zou", "熊": "xiong", "金": "jin",
    "陆": "lu", "郝": "hao", "孔": "kong", "白": "bai", "崔": "cui",
    "康": "kang", "毛": "mao", "邱": "qiu", "秦": "qin", "江": "jiang",
    "史": "shi", "顾": "gu", "侯": "hou", "邵": "shao", "孟": "meng",
    "龙": "long", "万": "wan", "段": "duan", "雷": "lei", "钱": "qian",
    "汤": "tang", "尹": "yin", "黎": "li", "易": "yi", "常": "chang",
    "武": "wu", "乔": "qiao", "贺": "he", "赖": "lai", "龚": "gong",
    "文": "wen", "庞": "pang", "樊": "fan", "兰": "lan", "殷": "yin",
    "施": "shi", "陶": "tao", "洪": "hong", "翟": "zhai", "安": "an",
    "颜": "yan", "倪": "ni", "严": "yan", "牛": "niu", "温": "wen",
    "芦": "lu", "季": "ji", "俞": "yu", "章": "zhang", "鲁": "lu",
    "葛": "ge", "伍": "wu", "韦": "wei", "申": "shen", "尤": "you",
    "毕": "bi", "聂": "nie", "焦": "jiao", "向": "xiang", "柳": "liu",
    "骆": "luo", "祝": "zhu", "纪": "ji", "欧": "ou", "舒": "shu",
    "屈": "qu", "项": "xiang", "祁": "qi", "童": "tong", "苗": "miao",
    "凌": "ling", "费": "fei", "纪": "ji", "靳": "jin", "盛": "sheng",
}


def t2s(s):
    return T2S.convert(s) if T2S else s


def clean_name(n):
    """CBDB 用「氏(父名女序号)」做女性消歧，去掉括号补注做显示名。"""
    n = t2s(n)
    n = re.sub(r"\([^)]*\)", "", n).strip()
    return n or t2s(n)


def load_prototype():
    """原型人物 + summary，按简体名建索引。"""
    src = open(os.path.join(ROOT, "prototype", "data.js"), encoding="utf-8").read()
    out = {}
    # 带 summary 的完整匹配
    for m in re.finditer(
        r"\{ id: '(?P<id>[^']+)', name: '(?P<name>[^']+)', type: 'person'[^}]*?"
        r"from: (?P<from>[\dnull]+), to: (?P<to>[\dnull]+)(?P<rest>[^}]*)\}",
        src, re.S,
    ):
        rest = m.group("rest")
        summ = re.search(r"summary: '((?:[^'\\]|\\.)*)'", rest)
        z = re.search(r"zi: '([^']*)'", rest)
        p = re.search(r"polity: '([^']*)'", rest)
        role = re.search(r"role: '([^']*)'", rest)
        out[t2s(m.group("name"))] = {
            "id": m.group("id"),
            "name": m.group("name"),
            "from": None if m.group("from") == "null" else int(m.group("from")),
            "to": None if m.group("to") == "null" else int(m.group("to")),
            "zi": z.group(1) if z else None,
            "polity": p.group(1) if p else None,
            "role": role.group(1) if role else None,
            "summary": summ.group(1).replace("\\'", "'") if summ else None,
        }
    return out


POLITY_MAP = {"宋": "两宋", "辽": "辽", "金": "金", "五代": "两宋",
              "后蜀": "两宋", "南唐": "两宋", "吴越": "两宋", "闽": "两宋", "南汉": "两宋"}


def infer_role(song_person):
    """从 CBDB 字段推断角色（帝王/名臣/名将/文人/学者/艺技/宗僧）。"""
    offices = " ".join(o["office"] for o in song_person.get("office", []))
    if re.search(r"皇帝|帝$", song_person["name"]) or "翰林學士" in offices:
        pass
    # 简化启发：有大量著作→文人；有军职→名将；其余名臣
    if re.search(r"節度使|都指揮|統制|宣撫|經略|兵馬|防禦使|觀察使|總管|都統|指揮使", offices):
        return "名将"
    if len(song_person.get("works", [])) >= 3:
        return "文人"
    if song_person["name"].endswith("帝") or song_person["name"] in (
            "宋太祖", "宋太宗", "宋真宗", "宋仁宗", "宋英宗", "宋神宗", "宋哲宗",
            "宋徽宗", "宋钦宗", "宋高宗", "宋孝宗", "宋光宗", "宋宁宗", "宋理宗",
            "宋度宗", "宋恭帝", "宋端宗", "宋帝昺"):
        return "帝王"
    return "名臣"


def make_id(name_s, cbdb_id, used):
    """生成稳定唯一 id。"""
    pyd = "".join(PINYIN.get(c, "") for c in name_s[:2]).lower() or "p"
    base = f"{pyd}-{cbdb_id}"
    cand = base
    n = 2
    while cand in used:
        cand = f"{base}-{n}"
        n += 1
    used.add(cand)
    return cand


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=BUILD)
    ap.add_argument("--only-core", action="store_true",
                    help="只导出 prominence>=4（约1万人）")
    ap.add_argument("--min-prom", type=int, default=0)
    args = ap.parse_args()

    proto = load_prototype()
    print(f"原型人物: {len(proto)}")

    # 先统计每个简体名在 CBDB 里的出现次数：>1 即同名异人，仅首个可占用原型 id
    name_freq = {}
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            if d["prominence"] < args.min_prom:
                continue
            sname = t2s(d["name"])
            name_freq[sname] = name_freq.get(sname, 0) + 1

    used_ids = set(p["id"] for p in proto.values())
    claimed_proto = set()  # 已被占用的原型 id（同名异人只给一个）
    merged = []
    stat = {"from_cbdb": 0, "with_proto_summary": 0, "no_summary": 0,
            "proto_only": 0, "conflicts_flagged": 0}

    # ---- CBDB 侧 ----
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            sname = t2s(d["name"])
            if d["prominence"] < args.min_prom:
                continue
            proto_rec = proto.get(sname)
            rec = {
                "cbdb_id": d["cbdb_id"],
                "name": clean_name(d["name"]),
                "raw_name": sname if clean_name(d["name"]) != sname else None,
                "surname": t2s(d["surname"]) if d["surname"] else None,
                "polity": POLITY_MAP.get(d["polity"], "两宋"),
                "from": d["birth"] or None,
                "to": d["death"] or None,
                "zi": t2s(d["zi"][0]) if d["zi"] else None,
                "hao": [t2s(h) for h in d["hao"]],
                "shi": [t2s(s) for s in d["shi"]],
                "role": infer_role(d),
                "prominence": d["prominence"],
                "addr": [t2s(a) for a in d.get("addr_names", [])],
                "n_office": len(d["office"]),
                "n_kin": len(d["kin"]),
                "n_entry": len(d["entry"]),
                "n_works": len(d["works"]),
                "source": CBDB_SRC,
                "refs": [{"source": CBDB_SRC, "locator": f"c_personid={d['cbdb_id']}"}],
            }
            # CBDB 源数据偶有生年>卒年（录入错误），标注不静默丢弃
            if rec["from"] and rec["to"] and rec["from"] > rec["to"]:
                rec["approx"] = True
                rec["refs"].append({"source": CBDB_SRC,
                                    "note": "原库生年晚于卒年，疑录入有误，已标注"})
                stat["date_inverted"] = stat.get("date_inverted", 0) + 1
            # 政权误标过滤：生卒完全落在宋段(830–1300)之外的剔除
            # （如 CBDB 把唐人标为五代、元人标为宋）
            if rec["from"] and rec["to"] and (rec["to"] < 830 or rec["from"] > 1300):
                stat["out_of_scope"] = stat.get("out_of_scope", 0) + 1
                continue
            if rec["raw_name"] is None:
                del rec["raw_name"]
            stat["from_cbdb"] += 1

            # 优先用原型 id / summary —— 仅当该名在 CBDB 唯一，或首个占用者
            proto_rec = proto.get(sname)
            can_claim = proto_rec and (
                name_freq.get(sname, 1) == 1 and proto_rec["id"] not in claimed_proto
            )
            if can_claim:
                rec["id"] = proto_rec["id"]
                claimed_proto.add(proto_rec["id"])
            else:
                rec["id"] = make_id(sname, d["cbdb_id"], used_ids)

            # 散文与冲突处理：只要 CBDB 这个人是原型那个人，就挂上（同名异人时仅首个）
            if proto_rec and (name_freq.get(sname, 1) == 1 or proto_rec["id"] in claimed_proto):
                if proto_rec["summary"]:
                    rec["summary"] = proto_rec["summary"]
                    stat["with_proto_summary"] += 1
                # 冲突并列（不覆盖）
                if proto_rec["from"] and d["birth"] and abs(proto_rec["from"] - d["birth"]) > 1:
                    rec["refs"].append({"source": "原型(LLM)",
                                        "locator": f"birthyear={proto_rec['from']}"})
                    stat["conflicts_flagged"] += 1
                elif proto_rec["to"] and d["death"] and abs(proto_rec["to"] - d["death"]) > 1:
                    rec["refs"].append({"source": "原型(LLM)",
                                        "locator": f"deathyear={proto_rec['to']}"})
                    stat["conflicts_flagged"] += 1
                # 原型有而 CBDB 无的生卒 → 保留原型值（多值）
                if not rec["from"] and proto_rec["from"]:
                    rec["from"] = proto_rec["from"]
                if not rec["to"] and proto_rec["to"]:
                    rec["to"] = proto_rec["to"]
                # CBDB 无字号而原型有
                if not rec["zi"] and proto_rec["zi"]:
                    rec["zi"] = proto_rec["zi"]
            if not rec.get("summary"):
                stat["no_summary"] += 1

            merged.append(rec)

    # ---- 原型独有（CBDB 未匹配）----
    cbdb_names = set()
    with open(os.path.join(BUILD, "persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            cbdb_names.add(t2s(json.loads(line)["name"]))
    for sname, p in proto.items():
        if sname not in cbdb_names:
            merged.append({
                "id": p["id"], "name": p["name"], "polity": p["polity"] or "两宋",
                "from": p["from"], "to": p["to"], "zi": p["zi"], "role": p["role"],
                "summary": p["summary"], "prominence": None,
                "source": "prototype", "refs": [{"source": "原型(待CBDB补录)"}],
            })
            stat["proto_only"] += 1

    out = os.path.join(args.out, "merged_persons.jsonl")
    os.makedirs(args.out, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for r in merged:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # 去重 id 检查
    ids = [r["id"] for r in merged]
    dups = len(ids) - len(set(ids))
    stat["total"] = len(merged)
    stat["dup_ids"] = dups

    print(json.dumps(stat, ensure_ascii=False, indent=2))
    print(f"\n写出: {out}")


if __name__ == "__main__":
    main()
