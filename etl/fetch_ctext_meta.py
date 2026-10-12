#!/usr/bin/env python3
"""补数据C41：从 ctext (中国哲学书电子化计划) 补古籍元数据 → book_meta。

ctext gettextinfo 提供：成书朝代区间 / 版本 / 题名。
用我们的 texts.book + bibliography 书名去查，补充权威元数据。
"""
import sqlite3, os, json, time, urllib.request, urllib.parse
_OP = urllib.request.build_opener(urllib.request.ProxyHandler())
DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
UA = "long-river-research/1.0 (contact: dev@example.com)"

# 书名 → ctext urn 候选（人工/规则）
URN_MAP = {
    '史记': 'ctp:shiji', '汉书': 'ctp:han-shu', '后汉书': 'ctp:hou-han-shu',
    '三国志': 'ctp:sanguozhi', '晋书': 'ctp:jin-shu', '宋书': 'ctp:song-shu',
    '南齐书': 'ctp:nan-qi-shu', '梁书': 'ctp:liang-shu', '陈书': 'ctp:chen-shu',
    '魏书': 'ctp:wei-shu', '北齐书': 'ctp:bei-qi-shu', '周书': 'ctp:zhou-shu',
    '隋书': 'ctp:sui-shu', '南史': 'ctp:nan-shi', '北史': 'ctp:bei-shi',
    '旧唐书': 'ctp:jiu-tang-shu', '新唐书': 'ctp:xin-tang-shu',
    '旧五代史': 'ctp:jiu-wu-dai-shi', '新五代史': 'ctp:xin-wu-dai-shi',
    '宋史': 'ctp:song-shi', '辽史': 'ctp:liao-shi', '金史': 'ctp:jin-shi',
    '元史': 'ctp:yuan-shi', '明史': 'ctp:ming-shi',
    '论语': 'ctp:analects', '孟子': 'ctp:mengzi', '荀子': 'ctp:xunzi',
    '庄子': 'ctp:zhuangzi', '韩非子': 'ctp:hanfeizi', '墨子': 'ctp:mozi',
    '淮南子': 'ctp:huainanzi', '管子': 'ctp:guanzi', '老子': 'ctp:dao-de-jing',
    '诗经': 'ctp:book-of-poetry', '尚书': 'ctp:shang-shu', '周易': 'ctp:book-of-changes',
    '礼记': 'ctp:liji', '周礼': 'ctp:rites-of-zhou', '国语': 'ctp:guo-yu',
    '战国策': 'ctp:zhan-guo-ce', '吕氏春秋': 'ctp:lv-shi-chun-qiu',
    '说文解字': 'ctp:shuo-wen-jie-zi', '尔雅': 'ctp:er-ya', '列子': 'ctp:liezi',
    '晏子春秋': 'ctp:yanzi-chun-qiu', '孙子兵法': 'ctp:art-of-war',
    '吴子': 'ctp:wu-zi', '六韬': 'ctp:liu-tao', '司马法': 'ctp:si-ma-fa',
}


def get(url, tries=4):
    for i in range(tries):
        try:
            return json.load(_OP.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=25))
        except Exception:
            time.sleep(4 * (i + 1))
    return {}


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("DROP TABLE IF EXISTS book_meta")
    con.execute("CREATE TABLE book_meta(book TEXT PRIMARY KEY, title TEXT, dynasty_from TEXT, "
                "dynasty_to TEXT, edition TEXT, urn TEXT, source TEXT)")
    rows = []
    for book, urn in URN_MAP.items():
        d = get(f'https://api.ctext.org/gettextinfo?urn={urn}')
        if 'error' in d or not d:
            print(f"  {book}: 无", flush=True)
            time.sleep(1)
            continue
        df = d.get('dynasty', {}).get('from', {}).get('name', '')
        dt = d.get('dynasty', {}).get('to', {}).get('name', '')
        ed = d.get('edition', {}).get('title', '')
        rows.append((book, d.get('title', ''), df, dt, ed, urn, 'ctext'))
        print(f"  {book}: {d.get('title')} [{df}~{dt}] {ed}", flush=True)
        time.sleep(1.2)
    con.executemany("INSERT OR REPLACE INTO book_meta VALUES (?,?,?,?,?,?,?)", rows)
    con.commit()
    print(f"\n✓ book_meta: {len(rows)} 部古籍元数据")
    con.close()


if __name__ == "__main__":
    main()
