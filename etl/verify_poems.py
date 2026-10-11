#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_poems.py — 长河项目 · 诗词数据横向交叉核验

只读核验 data/lr-song.sqlite3 的 poems 表（344,106 首），产出：
  data/诗词核验报告.md        统计表 + 矛盾清单 + 名篇比对结论
  data/_verify_poems.json     结构化结果（供后续复用）

核验维度：
  1. 作者身份核验   poems.author → persons.name / cbdb_ALTNAME_DATA(字4/号5)
  2. 重复检测       (title,content) 全重复、同作者同名诗
  3. 可疑归属       无名氏/佚名占比、疑似非人名作者
  4. 名篇抽样核验   10 首名篇 content 与权威版本比对
  5. 诗→人物交叉    author→persons 的 dynasty_id 与 poem_dynasty 矛盾率

约束：绝不写 poems 表；仅 SELECT；大表查询尽量走索引 / 单次扫描。
按 AGENTS.md：年份展示带「公元/公元前」前缀。本脚本不涉及年份展示。
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import time
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "data", "lr-song.sqlite3")
REPORT = os.path.join(ROOT, "data", "诗词核验报告.md")
JSON_OUT = os.path.join(ROOT, "data", "_verify_poems.json")

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
UNKNOWN_NAMES = {
    "无名氏", "佚名", "无名", "阙名", "缺名", "无考", "不详", "闕名", "無名氏", "佚名氏",
    "无姓名", "姓名不详", "未详", "无名子",
}
# 疑似非人名：含阿拉伯数字 / 明显的符号噪声 / 空
NON_NAME_RE = re.compile(r"[0-9０-９]|[#@$%^&*_=+<>{}\[\]|\\/]|^[\s·。，、]+$")
# 数据集里表示缺字的方框字符
PLACEHOLDER_CHARS = "□■◻◼?？"


def is_unknown(author: str) -> bool:
    if author is None:
        return True
    a = author.strip()
    return a in UNKNOWN_NAMES or a == ""


def looks_non_name(author: str) -> bool:
    """疑似非人名：含数字/符号（不含常见中文间隔符）。"""
    if not author:
        return True
    a = author.strip()
    if a == "":
        return True
    # 方框缺字符本身不算非人名噪声（数据集用 □ 表示失传字），但纯方框算
    if all(c in PLACEHOLDER_CHARS for c in a):
        return True
    if NON_NAME_RE.search(a):
        # 允许「·」间隔的名（少数民族/音译名），但含 ASCII 数字/操作符则判可疑
        return True
    return False


# ----------------------------------------------------------------------------
# 1. 作者身份核验
# ----------------------------------------------------------------------------
def verify_author_identity(cur) -> dict:
    log("维度1：作者身份核验 …")
    res: dict = {}

    # poems 里不同的作者名及各自诗数（author 有索引）
    cur.execute(
        "SELECT author, COUNT(*) FROM poems GROUP BY author"
    )
    rows = cur.fetchall()
    author_counts = {a: n for a, n in rows if a is not None}
    distinct_authors = len(author_counts)
    res["distinct_authors_in_poems"] = distinct_authors
    log(f"  poems 中不同 author 数 = {distinct_authors}")

    # --- 直接 person.name 匹配 ---
    cur.execute("SELECT COUNT(DISTINCT name) FROM persons")
    res["persons_distinct_names"] = cur.fetchone()[0]

    # 规范化后建 persons.name 集合
    cur.execute("SELECT name FROM persons")
    person_names = set()
    for (nm,) in cur.fetchall():
        if nm:
            person_names.add(nm.strip())

    exact_hits = 0
    exact_hit_poems = 0
    for a, n in author_counts.items():
        if a.strip() in person_names:
            exact_hits += 1
            exact_hit_poems += n
    res["exact_name_matched_authors"] = exact_hits
    res["exact_name_matched_poems"] = exact_hit_poems
    res["exact_name_author_rate"] = round(exact_hits / distinct_authors * 100, 2)
    res["exact_name_poem_rate"] = round(
        exact_hit_poems / sum(author_counts.values()) * 100, 2
    )
    log(f"  直接 name 匹配作者 {exact_hits} ({res['exact_name_author_rate']}%)，覆盖诗 {exact_hit_poems}")

    # --- 通过 CBDB 字/号（type 4 / 5）匹配 ---
    cur.execute(
        "SELECT DISTINCT c_alt_name_chn FROM cbdb_ALTNAME_DATA "
        "WHERE c_alt_name_type_code IN (4,5) AND c_alt_name_chn IS NOT NULL"
    )
    alt_names = set()
    for (nm,) in cur.fetchall():
        if nm:
            alt_names.add(nm.strip())
    res["cbdb_altname_distinct"] = len(alt_names)

    alt_hits_only = 0
    alt_hit_poems = 0
    for a, n in author_counts.items():
        an = a.strip()
        if an not in person_names and an in alt_names:
            alt_hits_only += 1
            alt_hit_poems += n
    res["cbdb_altname_only_authors"] = alt_hits_only
    res["cbdb_altname_only_poems"] = alt_hit_poems
    res["cbdb_altname_only_author_rate"] = round(alt_hits_only / distinct_authors * 100, 2)
    log(f"  仅通过 CBDB 字/号匹配作者 {alt_hits_only} ({res['cbdb_altname_only_author_rate']}%)")

    total_matched = exact_hits + alt_hits_only
    res["any_match_authors"] = total_matched
    res["any_match_author_rate"] = round(total_matched / distinct_authors * 100, 2)
    res["any_match_poems"] = exact_hit_poems + alt_hit_poems
    res["any_match_poem_rate"] = round(
        res["any_match_poems"] / sum(author_counts.values()) * 100, 2
    )
    log(f"  合计可关联作者 {total_matched} ({res['any_match_author_rate']}%)")

    # 保存 unmatched 供报告展示（诗数最多的一批）
    unmatched = sorted(
        [(a, n) for a, n in author_counts.items()
         if a.strip() not in person_names and a.strip() not in alt_names],
        key=lambda x: -x[1],
    )
    res["unmatched_authors_cnt"] = len(unmatched)
    res["unmatched_top"] = unmatched[:40]
    res["_author_counts"] = author_counts
    res["_person_names"] = person_names
    res["_alt_names"] = alt_names
    return res


# ----------------------------------------------------------------------------
# 2. 重复检测  +  3. 可疑归属  （单次全表扫描同时完成）
# ----------------------------------------------------------------------------
def scan_poems(cur) -> dict:
    log("维度2/3：单次全表扫描 —— 重复检测 + 可疑归属 …")
    res: dict = {}

    seen_title_content: Counter = Counter()    # (title, content) 出现次数（>1 才重复）
    seen_author_title: Counter = Counter()     # (author, title) 出现次数
    n_total = 0
    n_unknown = 0
    unknown_poems = 0
    n_missing_author = 0
    non_name_authors: Counter = Counter()
    placeholder_authors: Counter = Counter()
    duplicate_groups = []          # (title, author, cnt) 样例
    content_len_zero = 0

    cur.execute("SELECT title, author, content FROM poems")
    while True:
        batch = cur.fetchmany(20000)
        if not batch:
            break
        for title, author, content in batch:
            n_total += 1
            t = title or ""
            c = content or ""
            a = author or ""
            if c == "":
                content_len_zero += 1
            seen_title_content[(t, c)] += 1
            seen_author_title[(a, t)] += 1
            if author is None or author.strip() == "":
                n_missing_author += 1
                n_unknown += 1
            elif is_unknown(a):
                n_unknown += 1
                unknown_poems += 1
            elif looks_non_name(a):
                if all(ch in PLACEHOLDER_CHARS for ch in a.strip()):
                    placeholder_authors[a] += 1
                else:
                    non_name_authors[a] += 1

    res["total_poems"] = n_total
    res["content_empty"] = content_len_zero

    # 完全重复 (title, content)
    dup_groups_tc = [(k, v) for k, v in seen_title_content.items() if v > 1]
    dup_extra_tc = sum(v - 1 for _, v in dup_groups_tc)
    res["dup_title_content_groups"] = len(dup_groups_tc)
    res["dup_title_content_extra"] = dup_extra_tc
    res["dup_title_content_rate"] = round(dup_extra_tc / n_total * 100, 3)
    top_tc = sorted(dup_groups_tc, key=lambda x: -x[1])[:30]
    res["dup_title_content_top"] = [
        {"title": k[0][:60], "cnt": v} for k, v in top_tc
    ]
    log(f"  (title,content) 完全重复组 {len(dup_groups_tc)}，冗余行 {dup_extra_tc}")

    # 同作者同名诗重复
    dup_groups_at = [(k, v) for k, v in seen_author_title.items() if v > 1]
    dup_extra_at = sum(v - 1 for _, v in dup_groups_at)
    res["dup_author_title_groups"] = len(dup_groups_at)
    res["dup_author_title_extra"] = dup_extra_at
    res["dup_author_title_rate"] = round(dup_extra_at / n_total * 100, 3)
    top_at = sorted(dup_groups_at, key=lambda x: -x[1])[:30]
    res["dup_author_title_top"] = [
        {"author": k[0], "title": k[1][:50], "cnt": v} for k, v in top_at
    ]
    log(f"  (author,title) 重复组 {len(dup_groups_at)}，冗余行 {dup_extra_at}")

    # 可疑归属
    res["unknown_poems"] = n_unknown
    res["unknown_rate"] = round(n_unknown / n_total * 100, 3)
    res["missing_author_poems"] = n_missing_author
    res["non_name_author_poems"] = sum(non_name_authors.values())
    res["non_name_authors_top"] = non_name_authors.most_common(30)
    res["placeholder_author_poems"] = sum(placeholder_authors.values())
    res["placeholder_authors_top"] = placeholder_authors.most_common(20)
    log(f"  无名氏/佚名 {n_unknown} ({res['unknown_rate']}%)；"
        f"非人名作者诗 {res['non_name_author_poems']}；缺字作者诗 {res['placeholder_author_poems']}")
    return res


# ----------------------------------------------------------------------------
# 4. 名篇抽样核验
# ----------------------------------------------------------------------------
# 权威版本（以《全唐诗》/宋刻本/通行权威本为准）。
# 静夜思用宋刻本《李太白文集》原文（明刊《唐诗三百首》改本不同，标注之）。
FAMOUS = [
    {
        "key": "静夜思",
        "title": "静夜思",
        "author": "李白",
        "signature": "床前看月光",  # 内容锚点（宋刻本特征词）
        "authoritative": "床前看月光，疑是地上霜。举头望山月，低头思故乡。",
        "note": "宋刻本《李太白文集》原文；明刊改本作「床前明月光…举头望明月」，属异文非讹。",
    },
    {
        "key": "将进酒",
        "title": "将进酒",
        "author": "李白",
        "signature": "君不见黄河之水天上来",
        "authoritative": "君不见黄河之水天上来，奔流到海不复回。"
        "君不见高堂明镜悲白发，朝如青丝暮成雪。"
        "人生得意须尽欢，莫使金樽空对月。天生我材必有用，千金散尽还复来。"
        "烹羊宰牛且为乐，会须一饮三百杯。岑夫子，丹丘生，将进酒，杯莫停。"
        "与君歌一曲，请君为我倾耳听。钟鼓馔玉不足贵，但愿长醉不复醒。"
        "古来圣贤皆寂寞，惟有饮者留其名。陈王昔时宴平乐，斗酒十千恣欢谑。"
        "主人何为言少钱，径须沽取对君酌。五花马，千金裘，呼儿将出换美酒，与尔同销万古愁。",
        "note": "《全唐诗》卷162；敦煌写本作《惜罇空》，文字略异（如「天生吾徒有俊才」）。",
    },
    {
        "key": "春望",
        "title": "春望",
        "author": "杜甫",
        "signature": "国破山河在",
        "authoritative": "国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。"
        "烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。",
        "note": "《全唐诗》卷224，权威本一致。",
    },
    {
        "key": "水调歌头",
        "title": "水调歌头",
        "author": "苏轼",
        "signature": "明月几时有",
        "authoritative": "明月几时有，把酒问青天。不知天上宫阙，今夕是何年。"
        "我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。"
        "转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆。"
        "人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。",
        "note": "词牌作《水调歌头·明月几时有》，各本文字基本一致。",
    },
    {
        "key": "满江红",
        "title": "满江红",
        "author": "岳飞",
        "signature": "怒发冲冠",
        "authoritative": "怒发冲冠，凭栏处、潇潇雨歇。抬望眼，仰天长啸，壮怀激烈。"
        "三十功名尘与土，八千里路云和月。莫等闲、白了少年头，空悲切。"
        "靖康耻，犹未雪。臣子恨，何时灭。驾长车，踏破贺兰山缺。"
        "壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。",
        "note": "属权归属有争议（或谓明人托名），文本以通行本为准。",
    },
    {
        "key": "声声慢",
        "title": "声声慢",
        "author": "李清照",
        "signature": "寻寻觅觅",
        "authoritative": "寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。"
        "三杯两盏淡酒，怎敌他、晚来风急。雁过也，正伤心，却是旧时相识。"
        "满地黄花堆积。憔悴损，如今有谁堪摘。守着窗儿，独自怎生得黑。"
        "梧桐更兼细雨，到黄昏、点点滴滴。这次第，怎一个愁字了得。",
        "note": "《漱玉词》通行本；「晚来风急」一作「晓来风急」，属异文。",
    },
    {
        "key": "天净沙·秋思",
        "title": "天净沙",
        "author": "马致远",
        "signature": "枯藤老树昏鸦",
        "authoritative": "枯藤老树昏鸦，小桥流水人家，古道西风瘦马。夕阳西下，断肠人在天涯。",
        "note": "元曲小令，题或作《天净沙·秋思》，文本一致。",
    },
    {
        "key": "登鹳雀楼",
        "title": "登鹳雀楼",
        "author": "王之涣",
        "signature": "白日依山尽",
        "authoritative": "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
        "note": "《全唐诗》卷253；作者一作朱斌，通行归王之涣。",
    },
    {
        "key": "悯农",
        "title": "悯农",
        "author": "李绅",
        "signature": "锄禾日当午",
        "authoritative": "锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。",
        "note": "《全唐诗》卷483，题作《古风二首》其二。",
    },
    {
        "key": "赋得古原草送别",
        "title": "赋得古原草送别",
        "author": "白居易",
        "signature": "离离原上草",
        "authoritative": "离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。"
        "远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。",
        "note": "《白氏长庆集》；前四句常单行作《草》。",
    },
]


def _norm_text(s: str) -> str:
    """去掉标点/空白/换行，只留汉字段，用于比对。"""
    if not s:
        return ""
    s = re.sub(r"[\s\.,!?;:'\"“”‘’（）()《》〈〉、，。！？：；·—…\-—·【】\[\]〔〕]", "", s)
    return s.strip()


def verify_famous(cur) -> list:
    log("维度4：名篇抽样核验 …")
    out = []
    for item in FAMOUS:
        cands = []
        seen = set()
        sig = item.get("signature", "")
        # 1) 内容锚点优先：名篇常被收录于异题/合集（如《古风二首》《越调·天净沙秋思》）
        if sig:
            cur.execute(
                "SELECT id,title,author,dynasty,content FROM poems "
                "WHERE content LIKE ? LIMIT 10",
                ("%" + sig + "%",),
            )
            for r in cur.fetchall():
                if r[0] not in seen:
                    seen.add(r[0]); cands.append(r)
        # 2) 作者 + 标题前缀
        cur.execute(
            "SELECT id,title,author,dynasty,content FROM poems "
            "WHERE title LIKE ? AND author = ? LIMIT 10",
            (item["title"] + "%", item["author"]),
        )
        for r in cur.fetchall():
            if r[0] not in seen:
                seen.add(r[0]); cands.append(r)
        # 3) 仅标题前缀兜底
        if not cands:
            cur.execute(
                "SELECT id,title,author,dynasty,content FROM poems "
                "WHERE title LIKE ? LIMIT 10",
                (item["title"] + "%",),
            )
            for r in cur.fetchall():
                if r[0] not in seen:
                    seen.add(r[0]); cands.append(r)
        rec = {"key": item["key"], "matches": 0, "conclusion": "", "candidates": []}
        auth_norm = _norm_text(item["authoritative"])
        for cid, title, author, dynasty, content in cands:
            cnorm = _norm_text(content or "")
            inner_exact = 0
            if cnorm and auth_norm:
                common = 0
                # 判断权威文本是否被包含（名篇常拼接多首/含序）
                if auth_norm in cnorm:
                    inner_exact = len(auth_norm)
                else:
                    # 最长公共子串近似：逐句比对
                    for seg in re.split(r"[。！？；\n]", item["authoritative"]):
                        seg_n = _norm_text(seg)
                        if seg_n and seg_n in cnorm:
                            common += len(seg_n)
                    inner_exact = common
            rec["candidates"].append(
                {
                    "id": cid,
                    "title": title,
                    "author": author,
                    "dynasty": dynasty,
                    "content_head": (content or "")[:200],
                    "auth_chars": len(auth_norm),
                    "matched_chars": inner_exact,
                    "contains_full": bool(cnorm and auth_norm and auth_norm in cnorm),
                }
            )
        rec["matches"] = len(cands)
        out.append({"item": item, "rec": rec})
    return out


def summarize_famous(famous_result: list) -> dict:
    summary = {"total": len(famous_result), "exact": 0, "partial": 0, "mismatch": 0, "notfound": 0}
    for fr in famous_result:
        rec = fr["rec"]
        if not rec["candidates"]:
            rec["conclusion"] = "未在 poems 表中找到该篇"
            summary["notfound"] += 1
            continue
        best = max(rec["candidates"], key=lambda x: x["matched_chars"])
        if best["contains_full"]:
            rec["conclusion"] = f"一致（id={best['id']}，权威全文命中）"
            summary["exact"] += 1
        elif best["matched_chars"] >= best["auth_chars"] * 0.9:
            rec["conclusion"] = (
                f"基本一致（id={best['id']}，命中 {best['matched_chars']}/{best['auth_chars']} 字，疑标点/异文差异）"
            )
            summary["partial"] += 1
        elif best["matched_chars"] > 0:
            rec["conclusion"] = (
                f"部分一致（id={best['id']}，命中 {best['matched_chars']}/{best['auth_chars']} 字，存在异文/截断）"
            )
            summary["partial"] += 1
        else:
            rec["conclusion"] = f"不一致（id={best['id']}，0 字命中）"
            summary["mismatch"] += 1
    return summary


# ----------------------------------------------------------------------------
# 5. 诗 → 人物交叉（dynasty 一致性）
# ----------------------------------------------------------------------------
# poems.dynasty / poem_dynasty 取值 → persons.dynasty_id 归并族
POEM2PERSON = {
    "tang": {"tang"},
    "song": {"song-w", "song-e"},
    "song-w": {"song-w", "song-e"},
    "song-e": {"song-w", "song-e"},
    "yuan": {"yuan"},
    "ming": {"ming"},
    "qing": {"qing"},
    "wudai": {"wudai", "nanbei"},
    "nanbei": {"nanbei", "nanbei-zhao", "nanbei-qi", "nanbei-liang", "nanbei-chen"},
    "shiji": {"zhou", "chunqiu", "zhanguo", "xizhou", "dongzhou", "shang", "xi-han", "han"},
    "shijing": {"zhou", "chunqiu", "zhanguo", "xizhou", "dongzhou", "shang", "xi-han", "han"},
    "chuci": {"zhanguo", "chunqiu"},
    "qin": {"qin"},
    "han": {"han-w", "han-e", "xi-han", "dong-han", "han"},
    "sanguo": {"sanguo"},
    "sui": {"sui"},
    "jin": {"jin", "jin-chao", "dongjin", "xijin"},
    "xia": {"xia"},
    "liao": {"liao"},
}


# 相邻/跨代朝代对（诗人跨代属合理歧义，不计为硬矛盾）
_ADJACENT_PAIRS = {
    frozenset({"tang", "wudai"}),
    frozenset({"tang", "sui"}),
    frozenset({"tang", "nanbei"}),
    frozenset({"wudai", "song"}),
    frozenset({"wudai", "song-w"}),
    frozenset({"wudai", "nanbei"}),
    frozenset({"song", "yuan"}),
    frozenset({"song-w", "yuan"}),
    frozenset({"song-e", "yuan"}),
    frozenset({"song", "jin"}),
    frozenset({"song-w", "jin"}),
    frozenset({"jin", "yuan"}),
    frozenset({"ming", "qing"}),
    frozenset({"song", "xia"}),
    frozenset({"song-w", "xia"}),
    frozenset({"tang", "han"}),
    frozenset({"han", "sanguo"}),
    frozenset({"sanguo", "jin"}),
    frozenset({"nanbei", "sui"}),
}


def _adjacent_set(dy: str) -> set:
    """返回与 dy 相邻的朝代集合（双向）。"""
    out = set()
    for pr in _ADJACENT_PAIRS:
        if dy in pr:
            out |= set(pr)
    return out


def _is_adjacent(pdy: str, pdyns: set) -> bool:
    """pdy 与 persons 的任一朝代相邻，或 persons 朝代集合跨越该对。"""
    adj = _adjacent_set(pdy)
    return bool(pdyns & adj)


def verify_cross(cur, ident: dict) -> dict:
    log("维度5：诗→人物朝代交叉核验 …")
    person_names: set = ident["_person_names"]

    # persons.name -> set(dynasty_id)
    cur.execute("SELECT name, dynasty_id FROM persons")
    name2dyn: dict = defaultdict(set)
    for nm, dy in cur.fetchall():
        if nm:
            name2dyn[nm.strip()].add(dy)

    # poems 里每个 dynasty 的实际取值分布
    cur.execute("SELECT dynasty, COUNT(*) FROM poems GROUP BY dynasty")
    poem_dyn_dist = cur.fetchall()
    cur.execute("SELECT poem_dynasty, COUNT(*) FROM poems GROUP BY poem_dynasty")
    poem_pd_dist = cur.fetchall()

    # 逐作者判定：作者能在 persons 找到 → 取 persons 的 dyn 集合与诗的 dynasty 比对
    # 这里按 (author, dynasty) 聚合诗数, 避免逐行。
    cur.execute("SELECT author, dynasty, COUNT(*) FROM poems GROUP BY author, dynasty")
    pair_rows = cur.fetchall()

    matched_pairs = 0     # 作者可映射的 (author,dynasty) 行数
    judged = 0
    consistent = 0
    soft = 0              # 相邻朝代（遗民/改朝换代跨代），非硬矛盾
    hard = 0              # 不相邻朝代，硬矛盾
    soft_list = []
    conflict_list = []
    for author, pdy, cnt in pair_rows:
        if not author:
            continue
        a = author.strip()
        if is_unknown(a):          # 无名氏/佚名 非真实人物，不参与朝代一致性判定
            continue
        if a not in name2dyn:
            continue
        pdyns = {d for d in name2dyn[a] if d}
        if not pdyns:
            # 人物无朝代信息，跳过一致性判定
            continue
        expected = POEM2PERSON.get(pdy or "", set())
        if not expected:
            continue
        matched_pairs += 1
        judged += 1
        if pdyns & expected:
            consistent += 1
            continue
        rec = {
            "author": a,
            "poem_dynasty": pdy,
            "person_dynasties": sorted(pdyns),
            "poems": cnt,
        }
        if _is_adjacent(pdy, pdyns):
            # 相邻朝代：诗人跨代（唐末入五代、宋末遗民入元、明末清初等），属合理歧义
            soft += 1
            soft_list.append(rec)
        else:
            hard += 1
            conflict_list.append(rec)

    conflict_list.sort(key=lambda x: -x["poems"])
    soft_list.sort(key=lambda x: -x["poems"])
    res = {
        "matched_author_dynasty_rows": matched_pairs,
        "judged_rows": judged,
        "consistent_rows": consistent,
        "soft_conflict_rows": soft,
        "conflict_rows": hard,
        "conflict_rate": round(hard / judged * 100, 3) if judged else 0,
        "soft_conflict_rate": round(soft / judged * 100, 3) if judged else 0,
        "any_conflict_rate": round((hard + soft) / judged * 100, 3) if judged else 0,
        "conflict_top": conflict_list[:60],
        "soft_conflict_top": soft_list[:40],
        "poem_dynasty_dist": poem_dyn_dist,
        "poem_pd_dist": poem_pd_dist,
    }
    log(f"  可判定 {judged} 行：一致 {consistent}，硬矛盾 {hard}（{res['conflict_rate']}%），"
        f"软矛盾(相邻朝代) {soft}（{res['soft_conflict_rate']}%）")
    return res


# ----------------------------------------------------------------------------
# 报告
# ----------------------------------------------------------------------------
def fmt_pct(rate) -> str:
    return f"{rate}%"


def build_report(ident, scan, famous, famsum, cross) -> str:
    L = []
    A = L.append
    A("# 长河 · 诗词数据横向核验报告\n")
    A(f"> 数据源：`data/lr-song.sqlite3` · poems 表 **{scan['total_poems']:,}** 首  ")
    A(f"> 生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}  ")
    A("> 方式：只读 SELECT 核验，未修改任何 poems 行。\n")

    # ---- 概览 ----
    A("## 一、核验结论速览\n")
    A("| 维度 | 关键指标 | 结果 |")
    A("|---|---|---|")
    A(f"| 1 作者身份 | poems 作者名可关联 persons（名/字/号） | **{ident['any_match_authors']:,} / {ident['distinct_authors_in_poems']:,} = {fmt_pct(ident['any_match_author_rate'])}**（按诗计 {fmt_pct(ident['any_match_poem_rate'])}） |")
    A(f"| 1 作者身份 | 直接姓名匹配 | {ident['exact_name_matched_authors']:,} 作者（{fmt_pct(ident['exact_name_author_rate'])}） |")
    A(f"| 1 作者身份 | 仅凭 CBDB 字/号匹配 | {ident['cbdb_altname_only_authors']:,} 作者（{fmt_pct(ident['cbdb_altname_only_author_rate'])}） |")
    A(f"| 2 重复 | (title,content) 完全重复冗余行 | **{scan['dup_title_content_extra']:,}** 行 / {scan['dup_title_content_groups']:,} 组（{fmt_pct(scan['dup_title_content_rate'])}） |")
    A(f"| 2 重复 | 同作者同名诗冗余行 | {scan['dup_author_title_extra']:,} 行 / {scan['dup_author_title_groups']:,} 组（{fmt_pct(scan['dup_author_title_rate'])}） |")
    A(f"| 3 可疑归属 | 无名氏/佚名占比 | **{scan['unknown_poems']:,} / {scan['total_poems']:,} = {fmt_pct(scan['unknown_rate'])}** |")
    A(f"| 3 可疑归属 | 疑似非人名作者（含数字/符号） | {scan['non_name_author_poems']:,} 首 |")
    A(f"| 3 可疑归属 | 缺字作者（□ 占位） | {scan['placeholder_author_poems']:,} 首 |")
    A(f"| 4 名篇 | 抽样 {famsum['total']} 首 = 全文一致 {famsum['exact']} / 部分(异文)一致 {famsum['partial']} / 不一致 {famsum['mismatch']} / 未收录 {famsum['notfound']} |")
    A(f"| 5 交叉 | 作者→persons 朝代**硬**矛盾率 | **{cross['conflict_rows']:,} / {cross['judged_rows']:,} = {fmt_pct(cross['conflict_rate'])}** |")
    A(f"| 5 交叉 | 相邻朝代软矛盾（跨代诗人） | {cross['soft_conflict_rows']:,} 行（{fmt_pct(cross['soft_conflict_rate'])}） |")
    A("")

    # ---- 1 作者身份 ----
    A("## 二、作者身份核验\n")
    A(f"- poems 表 `author` 去重后共 **{ident['distinct_authors_in_poems']:,}** 个作者名。")
    A(f"- `persons` 表去重姓名 **{ident['persons_distinct_names']:,}** 个；CBDB 字/号（type 4/5）去重 **{ident['cbdb_altname_distinct']:,}** 个。")
    A(f"- **直接姓名匹配**：{ident['exact_name_matched_authors']:,} 个作者名命中 persons.name，"
      f"覆盖诗 {ident['exact_name_matched_poems']:,} 首。")
    A(f"- **CBDB 字/号补充匹配**：另有 {ident['cbdb_altname_only_authors']:,} 个作者名仅能通过字/号关联，"
      f"覆盖诗 {ident['cbdb_altname_only_poems']:,} 首。")
    A(f"- **合计可关联** {ident['any_match_authors']:,} 作者（{fmt_pct(ident['any_match_author_rate'])}），"
      f"对应诗 {ident['any_match_poems']:,} 首（{fmt_pct(ident['any_match_poem_rate'])}）。")
    A(f"- 无法关联的作者 **{ident['unmatched_authors_cnt']:,}** 个。\n")
    A("**未匹配作者 TOP（按诗数）**：\n")
    A("| 作者 | 诗数 |")
    A("|---|---|")
    for a, n in ident["unmatched_top"][:20]:
        A(f"| {a} | {n} |")
    A("")

    # ---- 2 重复 ----
    A("## 三、重复检测\n")
    A(f"### (title, content) 完全重复\n")
    A(f"- 重复组 **{scan['dup_title_content_groups']:,}**，冗余行 **{scan['dup_title_content_extra']:,}**"
      f"（占全表 {fmt_pct(scan['dup_title_content_rate'])}）。")
    A("")
    A("| 标题 | 出现次数 |")
    A("|---|---|")
    for d in scan["dup_title_content_top"][:15]:
        A(f"| {d['title']} | {d['cnt']} |")
    A("")
    A("### 同作者同名诗重复\n")
    A(f"- 重复组 **{scan['dup_author_title_groups']:,}**，冗余行 **{scan['dup_author_title_extra']:,}**"
      f"（占全表 {fmt_pct(scan['dup_author_title_rate'])}）。")
    A("")
    A("| 作者 | 标题 | 出现次数 |")
    A("|---|---|---|")
    for d in scan["dup_author_title_top"][:15]:
        A(f"| {d['author']} | {d['title']} | {d['cnt']} |")
    A("")

    # ---- 3 可疑归属 ----
    A("## 四、可疑归属\n")
    A(f"- 无名氏/佚名类作者：**{scan['unknown_poems']:,}** 首（{fmt_pct(scan['unknown_rate'])}）。")
    A(f"- 缺失作者：{scan['missing_author_poems']:,} 首。")
    A(f"- 疑似非人名（含阿拉伯数字/符号）：**{scan['non_name_author_poems']:,}** 首。")
    A(f"- 缺字作者（□ 占位）：{scan['placeholder_author_poems']:,} 首。\n")
    A("**疑似非人名作者示例**：\n")
    if scan["non_name_authors_top"]:
        A("| 作者名 | 诗数 |")
        A("|---|---|")
        for a, n in scan["non_name_authors_top"][:20]:
            A(f"| {a} | {n} |")
    else:
        A("（无）")
    A("")
    A("**缺字作者示例**：\n")
    if scan["placeholder_authors_top"]:
        A("| 作者名 | 诗数 |")
        A("|---|---|")
        for a, n in scan["placeholder_authors_top"][:15]:
            A(f"| {a} | {n} |")
    A("")

    # ---- 4 名篇 ----
    A("## 五、名篇抽样核验\n")
    A(f"抽样 {famsum['total']} 首：全文一致 **{famsum['exact']}**，部分/异文一致 **{famsum['partial']}**，"
      f"不一致 **{famsum['mismatch']}**，未收录 **{famsum['notfound']}**。\n")
    for fr in famous:
        item, rec = fr["item"], fr["rec"]
        A(f"### {item['key']}（{item['author']}）\n")
        A(f"- **结论**：{rec['conclusion']}")
        A(f"- 权威版本：`{item['authoritative'][:60]}…`")
        A(f"- 说明：{item['note']}")
        if rec["candidates"]:
            b = max(rec["candidates"], key=lambda x: x["matched_chars"])
            A(f"- 命中记录 id={b['id']}，标题《{b['title']}》，朝代={b['dynasty']}")
            A(f"- 库中文本：`{b['content_head'][:110].replace(chr(10), ' / ')}…`")
        A("")

    # ---- 5 交叉 ----
    A("## 六、诗 → 人物朝代交叉核验\n")
    A(f"- poems.dynasty 取值分布（前 15）：\n")
    A("| dynasty | 诗数 |")
    A("|---|---|")
    for d, n in sorted(cross["poem_dynasty_dist"], key=lambda x: -x[1])[:15]:
        A(f"| {d} | {n:,} |")
    A("")
    A(f"- 作者可映射到 persons（排除无名氏）且双方均有朝代信息的判定行 **{cross['judged_rows']:,}**。")
    A(f"- 一致 **{cross['consistent_rows']:,}**；**硬矛盾 {cross['conflict_rows']:,}（{fmt_pct(cross['conflict_rate'])}）**；"
      f"相邻朝代软矛盾（唐末入五代、宋末遗民入元、明末清初等跨代诗人）{cross['soft_conflict_rows']:,}"
      f"（{fmt_pct(cross['soft_conflict_rate'])}）。\n")
    A("**朝代硬矛盾清单（不相邻朝代，按涉及诗数 TOP 40）**：\n")
    A("| 作者 | 诗朝代 | persons 朝代 | 涉及诗数 |")
    A("|---|---|---|---|")
    for c in cross["conflict_top"][:40]:
        A(f"| {c['author']} | {c['poem_dynasty']} | {', '.join(c['person_dynasties'])} | {c['poems']} |")
    A("")
    A("**相邻朝代软矛盾示例（合理跨代，TOP 15）**：\n")
    A("| 作者 | 诗朝代 | persons 朝代 | 涉及诗数 |")
    A("|---|---|---|---|")
    for c in cross.get("soft_conflict_top", [])[:15]:
        A(f"| {c['author']} | {c['poem_dynasty']} | {', '.join(c['person_dynasties'])} | {c['poems']} |")
    A("")
    A("---\n")
    A("*本报告由 `etl/verify_poems.py` 自动生成，仅读核验，未修改 poems 数据。*\n")
    return "\n".join(L)


# ----------------------------------------------------------------------------
def main() -> int:
    if not os.path.exists(DB):
        print("DB not found:", DB, file=sys.stderr)
        return 2
    log(f"打开 {DB}")
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.execute("PRAGMA query_only = ON")   # 保证只读

    ident = verify_author_identity(cur)
    scan = scan_poems(cur)
    famous = verify_famous(cur)
    famsum = summarize_famous(famous)
    cross = verify_cross(cur, ident)

    report = build_report(ident, scan, famous, famsum, cross)
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write(report)
    log(f"报告已写入 {REPORT}")

    # 结构化结果（去掉大集合）
    dump = {
        "identity": {k: v for k, v in ident.items() if not k.startswith("_")},
        "duplicates_and_suspicious": scan,
        "famous_summary": famsum,
        "famous": [
            {"key": fr["item"]["key"], "conclusion": fr["rec"]["conclusion"],
             "matches": fr["rec"]["matches"]}
            for fr in famous
        ],
        "cross": {k: v for k, v in cross.items() if k != "poem_pd_dist"},
    }
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False, indent=2)
    log(f"结构化结果已写入 {JSON_OUT}")

    # stdout 汇总（供 send_message）
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(json.dumps({
        "any_match_author_rate": ident["any_match_author_rate"],
        "any_match_authors": ident["any_match_authors"],
        "distinct_authors": ident["distinct_authors_in_poems"],
        "dup_title_content_extra": scan["dup_title_content_extra"],
        "dup_author_title_extra": scan["dup_author_title_extra"],
        "unknown_rate": scan["unknown_rate"],
        "non_name_poems": scan["non_name_author_poems"],
        "conflict_rows": cross["conflict_rows"],
        "conflict_rate": cross["conflict_rate"],
        "famous": famsum,
    }, ensure_ascii=False, indent=2))
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
