#!/usr/bin/env python3
"""补数据C8：加载 chinese-poetry 新增文集（花间集/南唐/四书五经/蒙学/幽梦影）。

与 load_poetry.py 对齐 poems 表结构，追加 src 与 poem_dynasty。
"""
import sqlite3, os, json, glob, re
from opencc import OpenCC
t2s = OpenCC("t2s")
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "db", "lr-song.sqlite3")
PO = "/tmp/cp/po"


def paras_to_text(paras):
    out = []
    for p in paras:
        if isinstance(p, dict):
            p = p.get('content') or p.get('paragraphs') or p.get('text') or ''
        if isinstance(p, list):
            p = "".join(str(x) for x in p)
        if p and str(p).strip():
            out.append(str(p).strip())
    return "\n".join(out)


def norm_title(t):
    # 去尾注【笺注】等
    return re.sub(r"[（(【\[].*$", "", (t or '').strip()).strip()


def add(con, rows, title, author, dynasty, genre, content, src):
    if not content or not title:
        return
    con.execute("INSERT INTO poems(title,author,dynasty,genre,content,n_lines,src,poem_dynasty,famous) "
                "VALUES (?,?,?,?,?,?,?,?,0)",
                (t2s.convert(title), t2s.convert(author or ''), dynasty, genre,
                 t2s.convert(content), content.count('\n') + 1, src, dynasty))


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    before = con.execute("SELECT COUNT(*) FROM poems").fetchone()[0]
    n = [0]

    # 1. 花间集（五代·后蜀，温庭筠等）
    for f in glob.glob(f"{PO}/五代诗词/huajianji/huajianji-*-juan.json"):
        for it in json.load(open(f, encoding='utf-8')):
            content = paras_to_text(it.get('paragraphs', []))
            add(con, n, it.get('title'), it.get('author'), 'wudai', '词', content, '花间集')
            n[0] += 1

    # 2. 南唐二主词
    for f in glob.glob(f"{PO}/五代诗词/nantang/*.json"):
        if 'poetry' not in f:
            continue
        for it in json.load(open(f, encoding='utf-8')):
            content = paras_to_text(it.get('paragraphs', []))
            add(con, n, it.get('title'), it.get('author', '李煜'), 'wudai', '词', content, '南唐二主词')
            n[0] += 1

    # 3. 四书五经
    for f in glob.glob(f"{PO}/四书五经/*.json"):
        base = os.path.basename(f).replace('.json', '')
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        items = d.get('content', d) if isinstance(d, dict) else d
        if isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict):
                    content = paras_to_text(it.get('paragraphs', []) or [it.get('content', '')])
                    add(con, n, it.get('chapter') or f"{base}·{i+1}", it.get('author', ''), 'zhou-w', '文', content, base)
                    n[0] += 1

    # 4. 蒙学（三字经/百家姓/千字文/弟子规/千家诗/唐诗三百首…）
    for f in glob.glob(f"{PO}/蒙学/*.json"):
        base = os.path.basename(f).replace('.json', '')
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        title = d.get('title', base) if isinstance(d, dict) else base
        author = d.get('author', '') if isinstance(d, dict) else ''
        paras = d.get('paragraphs', []) if isinstance(d, dict) else []
        if paras:
            add(con, n, title, author, 'qing', '蒙学', paras_to_text(paras), base)
            n[0] += 1
        # 唐诗三百首：嵌套 content
        for sec in (d.get('content', []) if isinstance(d, dict) else []):
            for poem in sec.get('content', []):
                content = paras_to_text(poem.get('paragraphs', []))
                add(con, n, poem.get('chapter'), poem.get('author'), 'tang', '诗', content, '唐诗三百首')
                n[0] += 1

    # 5. 幽梦影
    for f in glob.glob(f"{PO}/幽梦影/*.json"):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        items = d.get('content', d) if isinstance(d, dict) else d
        if isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict):
                    content = paras_to_text(it.get('paragraphs', []) or [it.get('content', '')])
                    add(con, n, it.get('chapter') or f"幽梦影·{i+1}", it.get('author', '张潮'), 'qing', '文', content, '幽梦影')
                    n[0] += 1

    con.commit()
    after = con.execute("SELECT COUNT(*) FROM poems").fetchone()[0]
    print(f"✓ 尝试添加 {n[0]}，实际 poems {before:,} → {after:,}")
    for r in con.execute("SELECT src,COUNT(*) FROM poems WHERE src IN ('花间集','南唐二主词','孟子','大学','中庸','唐诗三百首','三字经','百家姓','千字文','幽梦影') GROUP BY 1 ORDER BY 2 DESC"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
