#!/usr/bin/env python3
"""补数据C48：非 CBDB 人物补充（中文维基百科）→ persons。

profiles/L3 中引用了若干 CBDB 未收录的著名人物（谢玄/钟繇/商汤/禹/王阳明/
曹雪芹/陶渊明/张仲景…）。从中文维基 API 拉取首段，抽取生卒年/字/号/籍贯/身份，
建为 wk- 前缀 person 记录（与既有 wk- 记录同源、同前缀）。

来源：中文维基百科（CC BY-SA），仅取事实性字段（生卒/字/号/籍贯），不整段搬文。
"""
import sqlite3, os, re, json, time, urllib.request, urllib.parse
from opencc import OpenCC

_t2s = OpenCC('t2s')
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
UA = "long-river-research/1.0 (contact: dev@example.com)"

# 缺失的著名人物（通称 → 维基条目标题/可选重定向）
TARGETS = [
    '谢玄', '钟繇', '陈群', '商汤', '禹', '王阳明', '曹雪芹', '严复', '傅说', '先轸',
    '冒顿单于', '冯太后', '刘伯温', '刘勰', '北魏太武帝', '司马睿', '司马越', '周亚夫',
    '商纣王', '夏桀', '姜子牙', '孙中山', '左丘明', '巨然', '康有为', '张仲景', '张择端',
    '张角', '扶苏', '文成公主', '昙曜', '晋怀帝', '智顗', '有扈氏', '李存勖', '李悝', '枣祗',
    '桑弘羊', '梁冀', '梁太后', '武丁', '王献之', '程邈', '程长庚', '索额图', '落下闳',
    '袁世凯', '谢朓', '谭鑫培', '贾南风', '贾思勰', '达摩', '郑道昭', '野利仁荣', '钟嵘',
    '韩康子', '马可·波罗', '高纬', '鸠摩罗什', '陶渊明', '魏徵', '王献之', '谢朓',
    '曇曜', '鄭道昭', '野利仁榮',
    '姜太公', '墨子',
]


def wiki_page(title):
    url = ("https://zh.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops"
           "&exintro=1&explaintext=1&ppprop=wikibase_item&titles="
           + urllib.parse.quote(title) + "&format=json&redirects=1")
    for i in range(4):
        try:
            d = json.load(_OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30))
            for pid in d.get('query', {}).get('pages', {}):
                p = d['query']['pages'][pid]
                if 'missing' in p:
                    return None
                return {'title': p['title'], 'qid': p.get('pageprops', {}).get('wikibase_item'),
                        'ext': p.get('extract', '')}
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def parse_year(s):
    if not s:
        return None
    # 世纪形式：约前17世纪 → 约 -1650
    m = re.match(r'约?前(\d{1,2})世纪', s)
    if m:
        return -(int(m.group(1)) * 100 - 50)
    m = re.match(r'(约)?(前)?(\d{1,4})年?', s)
    if not m:
        return None
    y = int(m.group(3))
    return -y if m.group(2) else y


def parse(ext, title):
    """从首段抽取 生卒/字/号/籍贯。"""
    out = {'birth': None, 'death': None, 'zi': None, 'hao': None, 'addr': None}
    # 生卒：**（343年—388年）** 或 （约前17世纪—前16世纪）
    m = re.search(r'（([^）]{4,40})）', ext)
    if m:
        span = m.group(1)
        parts = re.split(r'[—–\-〜~]', span)
        if len(parts) >= 2:
            out['birth'] = parse_year(parts[0])
            out['death'] = parse_year(parts[1])
    m = re.search(r'字([\u4e00-\u9fa5]{1,3})', ext)
    if m:
        out['zi'] = m.group(1)
    m = re.search(r'号([\u4e00-\u9fa5]{1,6})', ext)
    if m:
        out['hao'] = m.group(1)
    # 籍贯：X县（今…） / X人
    m = re.search(r'([\u4e00-\u9fa5]{2,8}(?:县|郡|府|州|人))', ext)
    if m:
        out['addr'] = m.group(1)
    return out


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    seen = set()
    n = 0
    for nm in TARGETS:
        if nm in seen:
            continue
        seen.add(nm)
        # 已存在同名人名则跳过
        if con.execute("SELECT 1 FROM persons WHERE name=? LIMIT 1", (nm,)).fetchone():
            continue
        pg = wiki_page(nm)
        if not pg or not pg.get('qid'):
            print(f"  ✗ {nm}: 无维基条目")
            time.sleep(2)
            continue
        qid = pg['qid']
        pid = 'wk-' + qid
        if con.execute("SELECT 1 FROM persons WHERE id=? LIMIT 1", (pid,)).fetchone():
            print(f"  = {nm}: 已存在 {pid}")
            time.sleep(1)
            continue
        info = parse(pg['ext'], nm)
        summary = re.sub(r'\s+', '', pg['ext'])[:200]
        con.execute(
            """INSERT OR REPLACE INTO persons
               (id,name,zi,hao,addr,birth,death,summary,source,qid,prominence,dynasty_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, nm, info['zi'], info['hao'], info['addr'], info['birth'], info['death'],
             summary, '维基百科(CC BY-SA)', qid, 5, None))
        n += 1
        print(f"  ✓ {nm}: {pid} 生{info['birth']} 卒{info['death']} 字{info['zi']} 籍{info['addr']}")
        time.sleep(1)
    con.commit()
    print(f"\n✓ 新增 {n} 位维基人物")
    con.close()


if __name__ == "__main__":
    main()
