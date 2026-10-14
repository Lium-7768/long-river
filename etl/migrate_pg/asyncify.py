#!/usr/bin/env python3
"""
把 server/src/index.js 里的
    db.prepare(SQL).all(ARGS)   →  (await db.prepare(SQL).all(ARGS))
    db.prepare(SQL).get(ARGS)   →  (await db.prepare(SQL).get(ARGS))

要点：await 必须包住**整个 db.prepare(...).all(...) 链**，
      否则 `await db.prepare(...).all(x).map(f)` 会先对 Promise 调 .map() 而报错。

用括号配对扫描，正确处理 SQL 字符串里的引号与括号。
"""
import re
import sys

PATH = 'server/src/index.js'
s = open(PATH, encoding='utf-8').read()


def scan_call(text, open_idx):
    """从 text[open_idx]=='(' 找到配对的 ')'，返回右括号下标（处理 '' 转义）"""
    depth = 0
    i = open_idx
    instr = False
    L = len(text)
    while i < L:
        c = text[i]
        if instr:
            if c == "'":
                if i + 1 < L and text[i + 1] == "'":
                    i += 2
                    continue
                instr = False
        elif c == "'":
            instr = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError('括号不配对')


out = []
i = 0
L = len(s)
n_fixed = 0

while i < L:
    k = s.find('db.prepare(', i)
    if k < 0:
        out.append(s[i:])
        break
    out.append(s[i:k])

    p_open = k + len('db.prepare')  # '(' 下标
    assert s[p_open] == '('
    p_close = scan_call(s, p_open)
    stmt_end = p_close + 1  # db.prepare(...) 结束

    # 后续是否紧跟 .all( / .get(
    m = re.match(r'\s*\.(all|get)\s*\(', s[stmt_end:])
    if m:
        all_open = stmt_end + m.end() - 1
        all_close = scan_call(s, all_open)
        call_end = all_close + 1
        out.append('(await ' + s[k:call_end] + ')')
        i = call_end
        n_fixed += 1
    else:
        out.append(s[k:stmt_end])
        i = stmt_end

result = ''.join(out)
with open(PATH, 'w', encoding='utf-8') as f:
    f.write(result)
print(f'✓ 已包裹 {n_fixed} 处 db.prepare(...).all()/.get()')
