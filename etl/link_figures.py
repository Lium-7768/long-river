#!/usr/bin/env python3
"""补数据C44：为 profiles 的 figures 注入 personId。

603 个 figure 中仅 20 个有 personId，其余 583 个（260 个命中库）无法点击。
用 persons.name / aliases.alias 解析，把 personId 写回 profile 源文件。
"""
import sqlite3, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "data", "lr-song.sqlite3")
DIR = os.path.join(ROOT, "web", "content", "profiles")
SKIP = {'index.ts', 'types.ts', 'slug.ts', 'famous-poems.ts'}


def main():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    by_name = {}
    for pid, nm in con.execute("SELECT id, name FROM persons"):
        by_name.setdefault(nm, pid)
    by_alias = {}
    for pid, al in con.execute("SELECT person_id, alias FROM aliases"):
        by_alias.setdefault(al, pid)
    # 帝王表：庙号/称号 → 本名（CBDB 只收本名，如 宋仁宗=赵祯）
    emp_alt = {}
    for title, native in con.execute("SELECT title, native FROM emperor"):
        if native:
            emp_alt.setdefault(title, native)

    def resolve(nm):
        r = by_name.get(nm) or by_alias.get(nm)
        if r:
            return r
        # 二次：库内形如 "名(别名)" / "别名(名)"，如 李世民(唐太宗)、武曌(武则天)
        row = con.execute(
            "SELECT id FROM persons WHERE name LIKE ? OR name LIKE ? LIMIT 1",
            (f'{nm}(%', f'%({nm})%'),
        ).fetchone()
        if row:
            return row[0]
        # 三次：帝王庙号 → 本名 → 查 persons/aliases
        alt = emp_alt.get(nm)
        if alt:
            r2 = by_name.get(alt) or by_alias.get(alt)
            if r2:
                return r2
            row2 = con.execute(
                "SELECT id FROM persons WHERE name LIKE ? OR name LIKE ? LIMIT 1",
                (f'{alt}(%', f'%({alt})%'),
            ).fetchone()
            if row2:
                return row2[0]
        return None

    total_added = 0
    for f in sorted(os.listdir(DIR)):
        if not f.endswith('.ts') or f in SKIP:
            continue
        path = os.path.join(DIR, f)
        src = open(path, encoding='utf-8').read()
        added = 0

        def fix_figures(m):
            nonlocal added
            block = m.group(1)
            # 逐个 { name: 'xxx' ... } 补 personId
            def fix_one(fm):
                nonlocal added
                inner = fm.group(1)
                if 'personId' in inner:
                    return fm.group(0)
                nmm = re.search(r"name:\s*'([^']+)'", inner)
                if not nmm:
                    return fm.group(0)
                pid = resolve(nmm.group(1))
                if pid:
                    added += 1
                    return "{ name: '%s', personId: '%s' }" % (nmm.group(1), pid)
                return fm.group(0)

            block2 = re.sub(r"\{([^{}]*name:\s*'[^']+'[^{}]*)\}", fix_one, block)
            return 'figures: [' + block2 + ']'

        src2 = re.sub(r"figures:\s*\[([^\]]*)\]", fix_figures, src)
        if src2 != src:
            open(path, 'w', encoding='utf-8').write(src2)
        total_added += added
        if added:
            print(f"  {f}: +{added} personId")
    print(f"\n✓ 共注入 personId {total_added} 个")
    con.close()


if __name__ == "__main__":
    main()
