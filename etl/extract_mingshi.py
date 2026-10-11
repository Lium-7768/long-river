#!/usr/bin/env python3
"""从《明史》公版全文抽人物（维基文库，纪传体）。
句式：「XXX，字YY，ZZ人」/「XXX，ZZ人」/「XXX者，ZZ人也」。
输出同 extract_histories.py 结构。
"""
import json, os, re, sys

def main():
    src, book, dy, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    recs={}
    for fn in sorted(os.listdir(src), key=lambda x: int(x.split('.')[0]) if x.split('.')[0].isdigit() else 0):
        if not fn.endswith('.txt'): continue
        vol=fn.split('.')[0]
        body=open(os.path.join(src,fn),encoding='utf-8').read()
        srcname=f'《{book}·卷{vol}》'
        # 模式A：XX，字YY，ZZ人
        for m in re.finditer(r'([\u4e00-\u9fff]{2,4})[，,](?:字([\u4e00-\u9fff]{1,3})[，,])?([\u4e00-\u9fff]{1,6})人[，,。]', body):
            name=m.group(1)
            if not re.fullmatch(r'[\u4e00-\u9fff]{2,4}',name): continue
            if name[-1] in '也不之者而以其於所为与则且乃乎哉焉了得着':
                continue
            # 籍贯须像地名：以 州/縣/府/郡/邑/衛/所/人 或 常见地名尾 结尾
            addr=m.group(3)
            if addr and not (addr[-1] in '州縣府郡邑衛所陽陰寧安平昌慶興武昌平' or len(addr)<=3):
                continue
            # 名字不能是「大數」类（含数字/量词）
            if any(c in name for c in '一二三四五六七八九十百千萬'): continue
            rec=recs.setdefault(name,{'name':name,'dynasty':dy,'polity':None,
                'birth':None,'death':None,'zi':[],'hao':[],'shi':[],'addr_names':[],
                'office':[],'kin':[],'entry':[],'works':[],'desc':None,'source':srcname,
                'prominence':6,'cbdb_id':None,'_dynasty_id':dy})
            if m.group(2): rec['zi']=[m.group(2)]
            if m.group(3) and not rec['addr_names']: rec['addr_names']=[m.group(3)]
            if not rec['desc']:
                rec['desc']=body[m.start():m.start()+50].replace('\n','')[:50]
    with open(out,'w',encoding='utf-8') as f:
        for r in recs.values(): f.write(json.dumps(r,ensure_ascii=False)+'\n')
    print(f'✓ 《{book}》抽 {len(recs)} 人 → {out}')

if __name__=='__main__': main()
