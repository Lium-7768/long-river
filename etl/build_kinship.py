#!/usr/bin/env python3
"""把 CBDB 亲属边映射到本项目的 person id，输出可入库的关系表。

输出 etl/build/kinship_edges.jsonl：{a, b, rel}
  a/b 为本项目 id；仅保留两端都在合并集内的边。
  CBDB 亲属关系是单向记录，但语义对称，这里同时补一条反向边
  （对齐 doc/requirements.md「构建期自动补全反向边」）。

用法: python3 etl/build_kinship.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "etl", "build")

# 反向称谓（简表；补不完的保留原称谓）
REVERSE = {
    "父": "子", "母": "子", "祖父": "孙", "祖母": "孙", "曾祖父": "曾孙",
    "子": "父", "女": "父", "长子; 第一子": "父", "次子": "父", "三子": "父",
    "孫": "祖父", "孙": "祖父", "曾孫; 重孫": "曾祖父", "曾孙; 重孙": "曾祖父",
    "兄": "弟", "弟": "兄", "姊": "妹", "妹": "姊", "兄弟": "兄弟",
    "妻": "夫", "夫": "妻", "第一任妻": "夫", "第二任妻": "夫", "第三任妻": "夫",
    "妾": "夫", "從子;姪子": "從父;伯叔父", "從父;伯叔父": "從子;姪子",
    "兄長": "弟", "弟媳": "夫兄", "姪": "伯叔父", "叔父;季父": "姪",
    "伯父;世父": "姪", "族兄": "族弟", "族弟": "族兄", "妻兄": "妹夫",
    "妻弟": "姐夫", "外祖父": "外孫", "外孫": "外祖父", "女婿": "岳父",
    "岳父": "女婿", "妻父": "女婿", "姊夫": "妻弟", "妹夫": "妻兄",
    "表兄": "表弟", "表弟": "表兄", "堂兄": "堂弟", "堂弟": "堂兄",
    "母之兄弟": "甥", "甥": "母之兄弟", "孫女": "祖父", "女": "父",
}


def rev(rel):
    if rel in REVERSE:
        return REVERSE[rel]
    return rel + "(反向)"


def main():
    idmap = {}
    with open(os.path.join(BUILD, "merged_persons.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("cbdb_id"):
                idmap[r["cbdb_id"]] = r["id"]

    out = []
    seen = set()
    n_in, n_both, n_drop = 0, 0, 0
    with open(os.path.join(BUILD, "kinships.jsonl"), encoding="utf-8") as f:
        for line in f:
            p, k, rel, name = json.loads(line)
            n_in += 1
            a, b = idmap.get(p), idmap.get(k)
            if not a or not b or a == b:
                n_drop += 1
                continue
            n_both += 1
            key = (a, b, rel)
            if key not in seen:
                seen.add(key)
                out.append({"a": a, "b": b, "rel": rel, "source": "CBDB cbdb_20261003"})
            rkey = (b, a, rev(rel))
            if rkey not in seen:
                seen.add(rkey)
                out.append({"a": b, "b": a, "rel": rev(rel), "source": "CBDB cbdb_20261003"})

    with open(os.path.join(BUILD, "kinship_edges.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"输入边 {n_in} | 两端可解析 {n_both} | 丢弃 {n_drop}")
    print(f"输出（含反向）{len(out)} → {BUILD}/kinship_edges.jsonl")


if __name__ == "__main__":
    main()
