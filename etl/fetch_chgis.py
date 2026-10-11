#!/usr/bin/env python3
"""补数据C10：CHGIS/TGAZ 地名坐标补全。

目标：为库内缺坐标的「历史地名」（州/县/府/路）从 CHGIS TGAZ API 补经纬度。
API: https://chgis.hudci.org/tgaz/placename?n=<name>&fmt=json
策略：对每个独特历史地名查一次，取第一个带「POINT」且有坐标的历代记录。
结果写入 addr_geo_more(addr_id, name, lon, lat, type, years, parent, sys_id, source)。
"""
import sqlite3, os, json, time, urllib.request, urllib.parse, re, sys

_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler())

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")
API = "https://chgis.hudci.org/tgaz/placename"
UA = "long-river-research/1.0 (contact: dev@example.com)"

HIST_TYPES = ('州', '縣', '县', '府', '路', '郡', '道', '軍', '军', '州 (zhou)', '府 (fu)')


def query(name):
    url = API + "?" + urllib.parse.urlencode({'n': name, 'fmt': 'json'})
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        d = json.load(_OPENER.open(req, timeout=30))
    except Exception:
        return None
    return d.get('placenames', d)


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    # 待补：库内历史地名（office_addrs 的 府/州/县 + CBDB 历史地名），排除现代省/市
    targets = []
    seen = set()
    modern = ('省', '自治区', '自治區', '直辖市', '直轄市', '特别行政区')
    # a) office_addrs 历史地名
    for (name,) in con.execute("SELECT DISTINCT addr FROM office_addrs WHERE addr IS NOT NULL AND addr<>''"):
        nm = re.sub(r'[（(].*$', '', name).strip()
        if not nm or len(nm) < 2 or nm in seen or any(m in nm for m in modern):
            continue
        if not (nm.endswith('州') or nm.endswith('县') or nm.endswith('府') or nm.endswith('路') or nm.endswith('郡')):
            continue
        seen.add(nm)
        targets.append((None, nm))
    # b) CBDB ADDR_CODES 历史地名（含坐标缺失的）
    for aid, name in con.execute(
            "SELECT c_addr_id,c_name_chn FROM cbdb_ADDR_CODES "
            "WHERE c_name_chn IS NOT NULL AND (x_coord=0 OR x_coord IS NULL)"):
        nm = re.sub(r'[（(].*$', '', name).strip()
        if not nm or len(nm) < 2 or nm in seen or any(m in nm for m in modern):
            continue
        seen.add(nm)
        targets.append((aid, nm))
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    targets = targets[:lim]
    print(f"待查 {len(targets)} 个地名")

    con.execute("DROP TABLE IF EXISTS addr_geo_more")
    con.execute("""CREATE TABLE addr_geo_more (
        addr_id INTEGER, name TEXT, lon REAL, lat REAL, feature TEXT,
        years TEXT, parent TEXT, sys_id TEXT, source TEXT)""")
    found = 0
    for i, (aid, nm) in enumerate(targets):
        res = query(nm)
        if not res:
            continue
        for rec in res:
            xy = rec.get('xy coordinates', '')
            if rec.get('object type') != 'POINT' or not xy or xy.startswith('0.00000, 0.00000'):
                continue
            try:
                lon, lat = [float(x) for x in xy.split(',')]
            except Exception:
                continue
            if lon == 0 or lat == 0:
                continue
            con.execute("INSERT INTO addr_geo_more VALUES (?,?,?,?,?,?,?,?,?)",
                        (aid, nm, lon, lat, rec.get('feature type'), rec.get('years'),
                         rec.get('parent name'), rec.get('sys_id'), 'CHGIS/TGAZ'))
            found += 1
            break
        if i % 50 == 0:
            con.commit()
            print(f"  {i}/{len(targets)} … 命中 {found}，当前 {nm}")
        time.sleep(0.15)
    con.commit()
    print(f"\n✓ addr_geo_more: {found} / {len(targets)}")
    for r in con.execute("SELECT name,lon,lat,feature,years FROM addr_geo_more LIMIT 8"):
        print("  ", r)
    con.close()


if __name__ == "__main__":
    main()
