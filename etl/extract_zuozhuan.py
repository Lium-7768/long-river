#!/usr/bin/env python3
"""从《春秋左氏传》抽春秋人物（已知人名表匹配）。"""
import json, os, re, sys

CHUNQIU = {
    # 周王室
    "周平王":"zhou-e","周桓王":"zhou-e","周庄王":"zhou-e","周惠王":"zhou-e",
    "周襄王":"zhou-e","周顷王":"zhou-e","周匡王":"zhou-e","周定王":"zhou-e",
    "周简王":"zhou-e","周灵王":"zhou-e","周景王":"zhou-e","周敬王":"zhou-e",
    "王子朝":"zhou-e","王子颓":"zhou-e","王子带":"zhou-e",
    # 鲁
    "鲁隐公":"zhou-e","鲁桓公":"zhou-e","鲁庄公":"zhou-e","鲁闵公":"zhou-e",
    "鲁僖公":"zhou-e","鲁文公":"zhou-e","鲁宣公":"zhou-e","鲁成公":"zhou-e",
    "鲁襄公":"zhou-e","鲁昭公":"zhou-e","鲁定公":"zhou-e","鲁哀公":"zhou-e",
    "季孙行父":"zhou-e","季孙宿":"zhou-e","季孙意如":"zhou-e","季孙斯":"zhou-e",
    "叔孙得臣":"zhou-e","叔孙豹":"zhou-e","叔孙婼":"zhou-e","孟献子":"zhou-e",
    "孟僖子":"zhou-e","臧文仲":"zhou-e","臧武仲":"zhou-e","展禽":"zhou-e",
    "柳下惠":"zhou-e","曹刿":"zhou-e",
    # 晋
    "晋献公":"zhou-e","晋惠公":"zhou-e","晋怀公":"zhou-e","晋文公":"zhou-e",
    "晋襄公":"zhou-e","晋灵公":"zhou-e","晋成公":"zhou-e","晋景公":"zhou-e",
    "晋厉公":"zhou-e","晋悼公":"zhou-e","晋平公":"zhou-e","晋昭公":"zhou-e",
    "晋顷公":"zhou-e","晋定公":"zhou-e","晋出公":"zhou-e",
    "荀息":"zhou-e","荀林父":"zhou-e","士会":"zhou-e","栾书":"zhou-e",
    "郤克":"zhou-e","赵盾":"zhou-e","赵武":"zhou-e","赵鞅":"zhou-e",
    "赵襄子":"zhou-e","魏犨":"zhou-e","魏绛":"zhou-e","韩厥":"zhou-e",
    "狐偃":"zhou-e","狐突":"zhou-e","先轸":"zhou-e","介子推":"zhou-e",
    "里克":"zhou-e","丕郑":"zhou-e","荀偃":"zhou-e","栾盈":"zhou-e",
    "羊舌肸":"zhou-e","叔向":"zhou-e","祁奚":"zhou-e","解狐":"zhou-e",
    # 齐
    "齐僖公":"zhou-e","齐襄公":"zhou-e","齐桓公":"zhou-e","齐孝公":"zhou-e",
    "齐昭公":"zhou-e","齐懿公":"zhou-e","齐惠公":"zhou-e","齐顷公":"zhou-e",
    "齐灵公":"zhou-e","齐庄公":"zhou-e","齐景公":"zhou-e","齐悼公":"zhou-e",
    "齐简公":"zhou-e","齐平公":"zhou-e",
    "管仲":"zhou-e","鲍叔牙":"zhou-e","隰朋":"zhou-e","高傒":"zhou-e",
    "国佐":"zhou-e","晏婴":"zhou-e","晏弱":"zhou-e","崔杼":"zhou-e",
    "庆封":"zhou-e","庆父":"zhou-e","鲍牵":"zhou-e","司马穰苴":"zhou-e",
    "陈完":"zhou-e","田乞":"zhou-e","田常":"zhou-e",
    # 楚
    "楚武王":"zhou-e","楚文王":"zhou-e","楚成王":"zhou-e","楚穆王":"zhou-e",
    "楚庄王":"zhou-e","楚共王":"zhou-e","楚康王":"zhou-e","楚灵王":"zhou-e",
    "楚平王":"zhou-e","楚昭王":"zhou-e","楚惠王":"zhou-e",
    "斗伯比":"zhou-e","子文":"zhou-e","成得臣":"zhou-e","斗越椒":"zhou-e",
    "申叔时":"zhou-e","伍举":"zhou-e","薳启强":"zhou-e","沈诸梁":"zhou-e",
    "伍奢":"zhou-e","伍尚":"zhou-e","伯州犁":"zhou-e",
    # 秦
    "秦文公":"zhou-w","秦穆公":"zhou-e","秦康公":"zhou-e","秦共公":"zhou-e",
    "秦桓公":"zhou-e","秦景公":"zhou-e","秦哀公":"zhou-e","秦惠公":"zhou-e",
    "百里奚":"zhou-e","蹇叔":"zhou-e","由余":"zhou-e","孟明视":"zhou-e",
    "西乞术":"zhou-e","白乙丙":"zhou-e",
    # 郑 / 宋 / 卫 / 陈 / 吴 / 越 / 鲁卿
    "郑庄公":"zhou-e","郑昭公":"zhou-e","郑厉公":"zhou-e","郑文公":"zhou-e",
    "郑穆公":"zhou-e","郑襄公":"zhou-e","郑悼公":"zhou-e","郑成公":"zhou-e",
    "郑简公":"zhou-e","郑定公":"zhou-e","郑献公":"zhou-e","郑声公":"zhou-e",
    "祭仲":"zhou-e","颍考叔":"zhou-e","子产":"zhou-e","子罕":"zhou-e",
    "子大叔":"zhou-e","游吉":"zhou-e","公子吕":"zhou-e","烛之武":"zhou-e",
    "宋殇公":"zhou-e","宋庄公":"zhou-e","宋闵公":"zhou-e","宋桓公":"zhou-e",
    "宋襄公":"zhou-e","宋成公":"zhou-e","宋文公":"zhou-e","宋昭公":"zhou-e",
    "宋文公":"zhou-e","宋共公":"zhou-e","宋平公":"zhou-e","宋元公":"zhou-e",
    "宋景公":"zhou-e","华督":"zhou-e","华元":"zhou-e","向戌":"zhou-e",
    "公子目夷":"zhou-e","孔父嘉":"zhou-e",
    "卫庄公":"zhou-e","卫桓公":"zhou-e","卫宣公":"zhou-e","卫惠公":"zhou-e",
    "卫懿公":"zhou-e","卫文公":"zhou-e","卫成公":"zhou-e","卫献公":"zhou-e",
    "卫灵公":"zhou-e","石碏":"zhou-e","宁速":"zhou-e","蘧伯玉":"zhou-e",
    "吴王寿梦":"zhou-e","吴王诸樊":"zhou-e","吴王余祭":"zhou-e","吴王馀眛":"zhou-e",
    "吴王僚":"zhou-e","吴王阖闾":"zhou-e","吴王夫差":"zhou-e",
    "伍子胥":"zhou-e","孙武":"zhou-e","专诸":"zhou-e","要离":"zhou-e",
    "太宰嚭":"zhou-e","申包胥":"zhou-e",
    "越王允常":"zhou-e","越王勾践":"zhou-e","越王勾践":"zhou-e","范蠡":"zhou-e",
    "文种":"zhou-e","大夫种":"zhou-e","计然":"zhou-e",
    "孔子":"zhou-e","颜回":"zhou-e","子路":"zhou-e","子贡":"zhou-e",
    "冉有":"zhou-e","子张":"zhou-e","子夏":"zhou-e","曾子":"zhou-e",
    "老子":"zhou-e","叔孙豹":"zhou-e","苌弘":"zhou-e","师旷":"zhou-e",
    "医和":"zhou-e","医缓":"zhou-e","梓慎":"zhou-e","裨灶":"zhou-e",
}

def main():
    src, out = sys.argv[1], sys.argv[2]
    recs={}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith('.txt'): continue
        body=open(os.path.join(src,fn),encoding='utf-8').read()
        gong=fn.replace('.txt','')
        srcname=f'《春秋左氏传·{gong}》'
        for name,dy in CHUNQIU.items():
            if name in body:
                rec=recs.setdefault(name,{
                    'name':name,'dynasty':dy,'polity':None,'birth':None,'death':None,
                    'zi':[],'hao':[],'shi':[],'addr_names':[],'office':[],'kin':[],
                    'entry':[],'works':[],'desc':None,'source':srcname,'prominence':6,
                    'cbdb_id':None,'_dynasty_id':dy})
                if not rec['desc']:
                    i=body.find(name); rec['desc']=body[i:i+50].replace('\n','')[:50]
    with open(out,'w',encoding='utf-8') as f:
        for r in recs.values(): f.write(json.dumps(r,ensure_ascii=False)+'\n')
    print(f'✓ 从《左传》抽 {len(recs)} 人 → {out}')
if __name__=='__main__': main()
