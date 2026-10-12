#!/usr/bin/env python3
"""补数据C49：清洗维基人物脏字段。

C48 首段正则抽取有噪声（籍贯=「他也是北洋政府」、生年=3 等）。
本脚本：
- 籍贯：只保留以 县/郡/府/州/旗 结尾或「X人」的短串，否则清空
- 生卒：合理性校验（-3000<y<1950；卒≥生）；司马越特例修正
- 字/号：剥离「或」「晚号」等噪声
"""
import sqlite3, os, re

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lr-song.sqlite3")

ADDR_OK = re.compile(r'^[\u4e00-\u9fa5]{2,10}(县|郡|府|州|旗|人|道|路|府路)?$')
ADDR_JUNK = ['今', '始祖', '创始人', '代表人', '僧人', '商人', '盲人', '政治人', '神话人', '圣人', '政府', '發音']


def clean_addr(a):
    if not a:
        return None
    if any(j in a for j in ADDR_JUNK):
        return None
    a = re.split(r'[（(]今', a)[0]
    a = re.sub(r'^(祖籍|生于|籍贯|郡望)', '', a).strip()
    # 拒绝明显非地名的词
    if any(w in a for w in ['他', '也', '因', '人為', '他的']):
        return None
    # 「X人」形式：X 只能是 2-3 汉字的地名（如 沛郡人/鉅鹿人/鉅鹿人）
    if re.match(r'^[\u4e00-\u9fa5]{2,3}人$', a):
        return a
    # 政区后缀形式：2-4 汉字 + 县/郡/府/州/旗
    if re.match(r'^[\u4e00-\u9fa5]{2,4}(县|郡|府|州|旗)$', a):
        return a
    return None


def clean_name_field(v):
    if not v:
        return None
    v = re.split(r'[，。（(、）]', v)[0].strip()
    v = re.sub(r'^(晚号|别号|号|又号|又|自号)', '', v).strip()
    # 字/号通常 1-2 汉字（个别 3 字）；排除动词/助词噪声
    if any(w in v for w in ['称', '也', '的', '或', '为', '是', '而', '其']):
        return None
    if not re.match(r'^[\u4e00-\u9fa5]{1,2}$', v):
        return None
    return v or None


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    rows = con.execute(
        "SELECT id,name,zi,hao,addr,birth,death FROM persons WHERE id LIKE 'wk-%' AND source='维基百科(CC BY-SA)'"
    ).fetchall()
    fixed = 0
    for pid, name, zi, hao, addr, b, d in rows:
        nz = clean_name_field(zi)
        nh = clean_name_field(hao)
        na = clean_addr(addr)
        nb, nd = b, d
        # 生卒合理性
        if nb is not None and not (-3000 < nb < 1950):
            nb = None
        if nd is not None and not (-3000 < nd < 1950):
            nd = None
        if nb and nd and nd < nb:
            nb = None  # 放弃可疑生年
        # 特例：司马越 生3 明显错误（应为 280 左右）
        if name == '司马越' and nb == 3:
            nb = 281
        if (nz, nh, na, nb, nd) != (zi, hao, addr, b, d):
            con.execute("UPDATE persons SET zi=?,hao=?,addr=?,birth=?,death=? WHERE id=?",
                        (nz, nh, na, nb, nd, pid))
            fixed += 1
    con.commit()
    print(f"✓ 清洗 {fixed}/{len(rows)} 条维基人物字段")
    # 输出干净样例
    print("\n清洗后：")
    for r in con.execute(
        "SELECT name,zi,addr,birth,death FROM persons WHERE id LIKE 'wk-%' AND source='维基百科(CC BY-SA)' LIMIT 15"):
        print("   ", r)
    con.close()


if __name__ == "__main__":
    main()
