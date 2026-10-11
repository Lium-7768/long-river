#!/usr/bin/env python3
"""把《史记》抽取的人物并入 DB：优先「补全」已有同名人物（字号/籍贯/描述），
无同名者再新增。姓名做归一化（去「字X」「某将军」「某侯」等前缀/后缀）。

- 已有同名（任意来源）→ 只填空字段，不覆盖
- 新增 → id = sj-{pinyin}-{序号}，source = 《史记·卷X·篇名》
"""
import json, re, sqlite3, sys

try:
    from pypinyin import lazy_pinyin
except Exception:
    def lazy_pinyin(s):
        return [str(ord(c)) for c in s]


def norm_name(n):
    """把「越王尉佗」「李将军广」「阴侯韩信」「相公孙弘」「项籍」规范化。"""
    # 去掉明显官职/封号前缀
    for pre in ["越王", "李将军", "阴侯", "相国", "丞相", "将军", "侯", "王", "君", "公子", "太王"]:
        if n.startswith(pre) and len(n) > len(pre) + 1:
            n = n[len(pre):]
            break
    # 「某丞相某」→ 取最后两字？保守起见只处理「X丞相Y」
    m = re.match(r"^([\u4e00-\u9fff])丞相([\u4e00-\u9fff]+)$", n)
    if m:
        n = m.group(1) + m.group(2)
    # 「项籍」→ 项羽（史记本名 vs 通行名）
    alias = {"项籍": "项羽", "英布": "黥布", "陈胡公满": "陈胡公", "郑桓公友": "郑桓公",
             "管仲夷吾": "管仲", "晏平仲婴": "晏婴", "孙子武": "孙武", "李将军广": "李广",
             "柏人": None, "居市井屠": None, "此数事": None, "此三人": None}
    if n in alias:
        return alias[n]
    return n


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "etl/build/shiji_clean.jsonl"
    db = sys.argv[2] if len(sys.argv) > 2 else "data/lr-song.sqlite3"
    rows = [json.loads(l) for l in open(src, encoding="utf-8")]

    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    # 已有姓名索引（取该姓名的所有记录）
    existing = {}
    for r in con.execute("SELECT id,name,dynasty_id FROM persons"):
        existing.setdefault(r["name"], []).append(r)

    enriched = created = skip = 0
    for r in rows:
        nm = norm_name(r["name"])
        if not nm or not re.fullmatch(r"[\u4e00-\u9fff]{2,4}", nm):
            skip += 1
            continue
        zi = (r.get("zi") or [None])[0]
        addr = (r.get("addr_names") or [None])[0]
        desc = r.get("desc")

        if nm in existing:
            # 补全：只填空字段
            for rec in existing[nm]:
                sets, args = [], []
                if zi:
                    cur = con.execute("SELECT zi FROM persons WHERE id=?", (rec["id"],)).fetchone()[0]
                    if not cur or cur == "[]":
                        sets.append("zi=?"); args.append(json.dumps([zi], ensure_ascii=False))
                if addr:
                    cur = con.execute("SELECT addr FROM persons WHERE id=?", (rec["id"],)).fetchone()[0]
                    if not cur or cur == "[]":
                        sets.append("addr=?"); args.append(json.dumps([addr], ensure_ascii=False))
                if desc:
                    cur = con.execute("SELECT summary FROM persons WHERE id=?", (rec["id"],)).fetchone()[0]
                    if not cur:
                        sets.append("summary=?"); args.append(desc)
                if sets:
                    args.append(rec["id"])
                    con.execute(f"UPDATE persons SET {','.join(sets)} WHERE id=?", args)
                    enriched += 1
        else:
            # 新增
            py = "".join(lazy_pinyin(nm))
            pid = f"sj-{py}-{created}"
            con.execute(
                """INSERT INTO persons
                   (id,cbdb_id,name,surname,birth,death,dynasty,polity,zi,hao,shi,addr,
                    role,prominence,summary,source,dynasty_id,fame_score)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, None, nm, nm[0], None, None, r["dynasty"], None,
                 json.dumps([zi], ensure_ascii=False) if zi else "[]", "[]", "[]",
                 json.dumps([addr], ensure_ascii=False) if addr else "[]",
                 None, r.get("prominence", 6), desc, r["source"], r["dynasty"],
                 r.get("prominence", 6) * 3))
            created += 1
    con.commit()
    print(f"✓ 补全 {enriched} 条、新增 {created} 条、跳过 {skip} 条")
    con.close()


if __name__ == "__main__":
    main()
