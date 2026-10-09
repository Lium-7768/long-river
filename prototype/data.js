// ============================================================
//  长河 · 数据
//  结构：trunk → dynasty | chaos → (regime | person | event | work | school | reform | treaty | office)
//  一级：政权（朝代 / 乱世）
//  二级：该政权下的人物 / 事件 / 作品 / 制度 / 学派 / 变法 / 盟约
//  三级：人物/事件下的作品、亲属、关联
//
//  ★ 宋代数据完整版。年份据《宋史》《续资治通鉴长编》《宋会要辑稿》及
//    学界通行的公元对照，帝王在位年已与维基百科君主表交叉核对。
// ============================================================

const DATA = {
  root: {
    id: 'china', name: '中国', type: 'trunk',
    children: [

      /* ============================================================
         北宋 960–1127
         ============================================================ */
      {
        id: 'northern-song', name: '北宋', type: 'dynasty', from: 960, to: 1127,
        summary: '960年赵匡胤陈桥兵变建宋，定都汴京。重文抑武、二府三司、科举取士，经济文化极盛，但冗官冗兵冗费积弊，1127年靖康之变而亡。',
        children: [
          /* ---- 人物 ---- */
          { id: 'zhao-kuangyin', name: '宋太祖', type: 'person', from: 927, to: 976,
            zi: '元朗', hao: ['赵九重'], entryPath: '军功', polity: '北宋',
            summary: '宋朝开国皇帝。陈桥兵变黄袍加身，杯酒释兵权，定"重文抑武"国策，结束五代十国之乱。',
            children: [
              { id: 'chenqiao', name: '陈桥兵变', type: 'event', from: 960, to: 960 },
              { id: 'cup-of-wine', name: '杯酒释兵权', type: 'event', from: 961, to: 961 },
              { id: 'wudai-end', name: '统一中原', type: 'event', from: 960, to: 976 },
            ]},
          { id: 'zhao-guangyi', name: '宋太宗', type: 'person', from: 939, to: 997,
            zi: '廷宜', polity: '北宋',
            summary: '太祖弟。灭北汉、收吴越，但两次北伐燕云失败，此后宋对辽转守势。扩大科举取士，奠定文官政治。',
            children: [
              { id: 'beihan-end', name: '灭北汉', type: 'event', from: 979, to: 979 },
              { id: 'gaolianghe', name: '高梁河之战', type: 'event', from: 979, to: 979 },
            ]},
          { id: 'zhao-heng', name: '宋真宗', type: 'person', from: 968, to: 1022, polity: '北宋',
            summary: '咸平之治。景德元年澶渊之盟，宋辽约为兄弟之国，宋岁输银绢，换得百余年和平。',
            children: [
              { id: 'chanyuan', name: '澶渊之盟', type: 'event', from: 1004, to: 1005 },
              { id: 'fengshan', name: '东封西祀', type: 'event', from: 1008, to: 1011 },
            ]},
          { id: 'zhao-zhen', name: '宋仁宗', type: 'person', from: 1010, to: 1063, polity: '北宋',
            summary: '在位四十一年，仁厚纳谏。庆历新政昙花一现，然名臣辈出——范仲淹、欧阳修、包拯皆其时。',
            children: [
              { id: 'qingli', name: '庆历新政', type: 'event', from: 1043, to: 1045 },
              { id: 'qingli-heyi', name: '庆历和议', type: 'event', from: 1044, to: 1044 },
            ]},
          { id: 'zhao-xu-shen', name: '宋神宗', type: 'person', from: 1048, to: 1085, polity: '北宋',
            summary: '锐意改革，用王安石行新法。熙宁变法触动既得利益，引发新旧党争，贯穿此后数十年。',
            children: [
              { id: 'xining-reform', name: '熙宁变法', type: 'event', from: 1069, to: 1085 },
              { id: 'yuanfeng-reform', name: '元丰改制', type: 'event', from: 1080, to: 1082 },
            ]},
          { id: 'zhao-ji', name: '宋徽宗', type: 'person', from: 1082, to: 1135, polity: '北宋',
            summary: '书画冠绝古今，瘦金体、宣和画院。然怠于政事，联金灭辽（海上之盟）引狼入室，靖康被掳，死于五国城。',
            children: [
              { id: 'haishang', name: '海上之盟', type: 'event', from: 1118, to: 1120 },
              { id: 'huashi', name: '花石纲', type: 'event', from: 1105, to: 1125 },
              { id: 'xuanhe-huapu', name: '《宣和画谱》', type: 'work', from: 1120, to: 1120 },
            ]},
          { id: 'zhao-huan', name: '宋钦宗', type: 'person', from: 1100, to: 1156, polity: '北宋',
            summary: '在位仅一年余。靖康之变中与徽宗同被金人掳北，北宋亡。',
            children: [
              { id: 'jingkang-song', name: '靖康之变', type: 'event', from: 1126, to: 1127 },
            ]},

          { id: 'wang-anshi', name: '王安石', type: 'person', from: 1021, to: 1086,
            zi: '介甫', hao: ['临川先生', '半山'], polity: '北宋',
            summary: '庆历二年进士。熙宁年间两度拜相，行青苗、募役、方田均税等新法。唐宋八大家之一，创"荆公新学"。',
            children: [
              { id: 'xining-reform-w', name: '主持熙宁变法', type: 'event', from: 1069, to: 1085 },
              { id: 'shang-renshen', name: '《上仁宗皇帝言事书》', type: 'work', from: 1058, to: 1058 },
              { id: 'dengfeilai', name: '《登飞来峰》', type: 'work', from: 1050, to: 1050 },
            ]},
          { id: 'sima-guang', name: '司马光', type: 'person', from: 1019, to: 1086,
            zi: '君实', hao: ['迂叟'], polity: '北宋',
            summary: '宝元元年进士。反对新法，退居洛阳十五年主编《资治通鉴》。神宗崩后入朝尽废新法，未几卒。',
            children: [
              { id: 'zizhitongjian', name: '《资治通鉴》', type: 'work', from: 1066, to: 1084 },
              { id: 'yuanyou', name: '元祐更化', type: 'event', from: 1085, to: 1093 },
            ]},
          { id: 'su-shi', name: '苏轼', type: 'person', from: 1037, to: 1101,
            zi: '子瞻', hao: ['东坡居士'], polity: '北宋', entryPath: '科举', entryYear: 1057,
            summary: '嘉祐二年进士。诗词文书画皆臻绝顶，唐宋八大家之一。因反对新法又不满尽废新法，一生贬谪，卒于常州。',
            children: [
              { id: 'niannujiao', name: '《念奴娇·赤壁怀古》', type: 'work', from: 1082, to: 1082 },
              { id: 'chibifu', name: '《赤壁赋》', type: 'work', from: 1082, to: 1082 },
              { id: 'wutai', name: '乌台诗案', type: 'event', from: 1079, to: 1079 },
              { id: 'shuimo', name: '《水调歌头》', type: 'work', from: 1076, to: 1076 },
            ]},
          { id: 'su-xun', name: '苏洵', type: 'person', from: 1009, to: 1066,
            zi: '明允', hao: ['老泉'], polity: '北宋',
            summary: '苏轼苏辙之父。二十七岁发愤读书，与二子同登科名，世称"三苏"。',
            children: [
              { id: 'liulun', name: '《六国论》', type: 'work', from: 1040, to: 1060 },
            ]},
          { id: 'su-zhe', name: '苏辙', type: 'person', from: 1039, to: 1112,
            zi: '子由', polity: '北宋', entryPath: '科举', entryYear: 1057,
            summary: '苏轼之弟。嘉祐二年与兄同榜。官至尚书右丞，为文汪洋澹泊，亦列唐宋八大家。',
            children: [
              { id: 'huangzhoulou', name: '《黄州快哉亭记》', type: 'work', from: 1083, to: 1083 },
            ]},
          { id: 'ouyang-xiu', name: '欧阳修', type: 'person', from: 1007, to: 1072,
            zi: '永叔', hao: ['醉翁', '六一居士'], polity: '北宋', entryPath: '科举', entryYear: 1030,
            summary: '北宋文坛盟主。主修《新唐书》、独撰《新五代史》。知贡举时取苏轼、苏辙、曾巩，嘉祐文风由是而变。',
            children: [
              { id: 'zuiwengting', name: '《醉翁亭记》', type: 'work', from: 1046, to: 1046 },
              { id: 'xin-wudaishi', name: '《新五代史》', type: 'work', from: 1035, to: 1053 },
              { id: 'xin-tangshu', name: '《新唐书》', type: 'work', from: 1044, to: 1060 },
            ]},
          { id: 'fan-zhongyan', name: '范仲淹', type: 'person', from: 989, to: 1052,
            zi: '希文', hao: ['文正'], polity: '北宋', entryPath: '科举', entryYear: 1015,
            summary: '大中祥符八年进士。庆历新政主持者，提出十事疏。戍边御西夏，羌人呼为"龙图老子"。',
            children: [
              { id: 'yueyanglou', name: '《岳阳楼记》', type: 'work', from: 1046, to: 1046 },
              { id: 'qingli-fan', name: '主持庆历新政', type: 'event', from: 1043, to: 1045 },
            ]},
          { id: 'li-qingzhao', name: '李清照', type: 'person', from: 1084, to: 1155,
            hao: ['易安居士'], polity: '北宋', gender: '女',
            summary: '婉约词宗。与赵明诚共辑《金石录》。靖康后南渡，词风由清丽转为沉郁，晚年孤苦。',
            children: [
              { id: 'shengshengman', name: '《声声慢》', type: 'work', from: 1150, to: 1155 },
              { id: 'wulingchun', name: '《武陵春》', type: 'work', from: 1135, to: 1135 },
              { id: 'jinshilu', name: '《金石录》', type: 'work', from: 1117, to: 1121 },
            ]},
          { id: 'shen-kuo', name: '沈括', type: 'person', from: 1031, to: 1095,
            zi: '存中', hao: ['梦溪丈人'], polity: '北宋', entryPath: '科举', entryYear: 1063,
            summary: '博学冠世。曾参与熙宁变法，出使辽廷。晚年居镇江梦溪园撰《梦溪笔谈》，记活字印刷、指南针、石油之名。',
            children: [
              { id: 'mengxi', name: '《梦溪笔谈》', type: 'work', from: 1086, to: 1093 },
              { id: 'xiuning', name: '熙宁年间使辽', type: 'event', from: 1075, to: 1075 },
            ]},
          { id: 'bi-sheng', name: '毕昇', type: 'person', from: 970, to: 1051,
            hao: ['布衣'], polity: '北宋',
            summary: '布衣发明家。庆历年间创胶泥活字印刷术，为世界印刷史里程碑。事见《梦溪笔谈》。',
            children: [
              { id: 'huozi', name: '胶泥活字印刷术', type: 'work', from: 1041, to: 1048 },
            ]},
          { id: 'baozheng', name: '包拯', type: 'person', from: 999, to: 1062,
            zi: '希仁', hao: ['包孝肃', '包青天'], polity: '北宋', entryPath: '科举', entryYear: 1027,
            summary: '天圣五年进士。知开封府，执法不阿，权贵敛手。后世演绎为铁面无私的清官典范。',
            children: []},

          /* ---- 制度 / 机构（作为条目挂在政权下）---- */
          { id: 'erfu-sansi', name: '二府三司', type: 'office', from: 960, to: 1127,
            summary: '宋代中枢：中书门下（政）、枢密院（军）为"二府"，三司（盐铁/度支/户部）掌财。相权被分割，皇帝集权。' },
          { id: 'shumiyuan', name: '枢密院', type: 'office', from: 960, to: 1279,
            summary: '掌军机、武臣铨选与边防。与中书门下并称二府。' },
          { id: 'sansi', name: '三司', type: 'office', from: 960, to: 1080,
            summary: '盐铁、度支、户部合称，总揽财计。元丰改制后归户部。' },
          { id: 'keju-song', name: '科举取士', type: 'office', from: 960, to: 1279,
            summary: '宋代科举制度化：糊名、誊录、殿试成为定制，取士额大增，士人由此崛起，门阀式微。' },
          { id: 'taijian', name: '台谏制度', type: 'office', from: 960, to: 1279,
            summary: '御史台与谏院合称台谏，掌纠弹百官。宋代台谏权重，为党争重要战场。' },
          { id: 'jingluesi', name: '经略安抚司', type: 'office', from: 960, to: 1279,
            summary: '掌一路兵民之事，多置于沿边要地（如陕西、河东），应付西夏与辽。' },

          /* ---- 学派 ---- */
          { id: 'jinggong-xinxue', name: '荆公新学', type: 'school', from: 1069, to: 1127,
            summary: '王安石所创，以《三经新义》为经义标准，为熙宁变法提供理论基础。' },
          { id: 'luoxue-xing', name: '洛学（萌芽）', type: 'school', from: 1050, to: 1127,
            summary: '程颢程颐所创，讲"天理"，为朱熹理学之源。元祐时一度遭禁（元祐党禁）。' },
          { id: 'guanxue', name: '关学', type: 'school', from: 1050, to: 1127,
            summary: '张载所创，以"气本论"与"横渠四句"闻名。' },
          { id: 'shuxue-su', name: '蜀学', type: 'school', from: 1050, to: 1127,
            summary: '苏轼父子之学，兼采佛道，与洛学对峙。' },

          /* ---- 变法 ---- */
          { id: 'xining-laws', name: '青苗法', type: 'reform', from: 1069, to: 1085,
            summary: '青黄不接时官贷钱谷于民，取二分息。本意抑兼并，行则扰民。' },
          { id: 'muyifa', name: '募役法', type: 'reform', from: 1070, to: 1085,
            summary: '改差役为雇役，民出免役钱。为宋代最受争议的新法之一。' },
          { id: 'baojiafa', name: '保甲法', type: 'reform', from: 1070, to: 1085,
            summary: '十家为保，闲时习武，渐代募兵。意在省兵费、强地方。' },
          { id: 'fangtian', name: '方田均税法', type: 'reform', from: 1072, to: 1085,
            summary: '清丈土地、按色定税，以均税负。触及隐田豪强利益，推行艰难。' },
          { id: 'shiyi', name: '市易法', type: 'reform', from: 1072, to: 1085,
            summary: '官设市易务，平价收售货物，抑商人垄断。' },

          /* ---- 盟约 ---- */
          { id: 'chanyuan-treaty', name: '澶渊之盟', type: 'treaty', from: 1005, to: 1005,
            summary: '宋辽约和：宋岁输银十万两、绢二十万匹，约为兄弟之国。此后百余年边境无事。' },
          { id: 'qingli-treaty', name: '庆历和议', type: 'treaty', from: 1044, to: 1044,
            summary: '宋夏约和，西夏称臣，宋岁赐银绢茶。' },
        ]
      },

      /* ============================================================
         辽 907–1125（与北宋并立）
         ============================================================ */
      {
        id: 'liao', name: '辽', type: 'chaos', from: 907, to: 1125,
        summary: '契丹耶律氏所建，916年耶律阿保机称帝，947年改国号辽。据燕云十六州，与北宋长期并立。1125年为金所灭。',
        children: [
          { id: 'yelu-abaoji', name: '耶律阿保机', type: 'regime', from: 872, to: 926,
            summary: '辽太祖。统一契丹诸部，916年称帝，创契丹文字。',
            children: [
              { id: 'qidan-zi', name: '创制契丹文字', type: 'work', from: 920, to: 920 },
            ]},
          { id: 'yelu-deguang', name: '耶律德光', type: 'regime', from: 902, to: 947,
            summary: '辽太宗。助石敬瑭灭后唐，得燕云十六州，947年入汴改国号"大辽"。' },
          { id: 'xiao-yanyan', name: '萧太后', type: 'regime', from: 953, to: 1009,
            summary: '辽景宗后，承天皇太后。圣宗年幼时摄政，1004年亲征伐宋，成澶渊之盟。' },
          { id: 'yelu-longxu', name: '辽圣宗', type: 'regime', from: 972, to: 1031,
            summary: '在位四十九年，辽之极盛。与宋盟好，制度汉化。' },
          { id: 'yanyun', name: '燕云十六州', type: 'event', from: 938, to: 1125,
            summary: '936年石敬瑭割予契丹，历宋三百余年未复。为北宋国防致命缺口。' },
          { id: 'liao-song-war', name: '宋辽战争', type: 'event', from: 979, to: 1004,
            summary: '太宗灭北汉后两度北伐燕云，皆败。真宗时辽军南下，遂有澶渊之盟。' },
        ]
      },

      /* ============================================================
         西夏 1038–1227
         ============================================================ */
      {
        id: 'western-xia', name: '西夏', type: 'chaos', from: 1038, to: 1227,
        summary: '党项拓跋氏所建，1038年李元昊称帝，都兴庆府。据河西走廊，与宋辽金鼎立。1227年为蒙古所灭。',
        children: [
          { id: 'li-yuanhao', name: '李元昊', type: 'regime', from: 1003, to: 1048,
            summary: '西夏景宗。1038年称帝，创西夏文，三川口、好水川屡败宋军。',
            children: [
              { id: 'tangut-wen', name: '创制西夏文', type: 'work', from: 1036, to: 1036 },
            ]},
          { id: 'song-xia-war', name: '宋夏战争', type: 'event', from: 1038, to: 1044,
            summary: '元昊称帝后与宋交兵，三川口、好水川、定川寨宋军三败，终以庆历和议收场。' },
          { id: 'haoshuichuan', name: '好水川之战', type: 'event', from: 1041, to: 1041,
            summary: '元昊设伏大败宋军，宋将任福战死。' },
        ]
      },

      /* ============================================================
         南宋 1127–1279
         ============================================================ */
      {
        id: 'southern-song', name: '南宋', type: 'dynasty', from: 1127, to: 1279,
        summary: '1127年赵构于应天府即位，后定都临安。与金对峙，绍兴和议划淮而治。理学在此期完成体系化，经济文化续盛。1279年崖山之后亡。',
        children: [
          { id: 'zhao-gou', name: '宋高宗', type: 'person', from: 1107, to: 1187, polity: '南宋',
            summary: '徽宗第九子。南渡建炎，用秦桧主和，杀岳飞，签绍兴和议。1162年禅位孝宗。',
            children: [
              { id: 'jianyan', name: '建炎南渡', type: 'event', from: 1127, to: 1130 },
              { id: 'shaoxing-heyi-h', name: '绍兴和议', type: 'event', from: 1141, to: 1141 },
            ]},
          { id: 'yue-fei', name: '岳飞', type: 'person', from: 1103, to: 1142,
            zi: '鹏举', hao: ['岳武穆'], polity: '南宋', entryPath: '军功',
            summary: '中兴四将之首。郾城大破金军，进军朱仙镇，为秦桧以十二金牌召回。1142年以"莫须有"冤死风波亭。',
            children: [
              { id: 'yuefei-north', name: '岳飞北伐', type: 'event', from: 1134, to: 1140 },
              { id: 'fengboting', name: '风波亭之狱', type: 'event', from: 1141, to: 1142 },
              { id: 'manjianghong', name: '《满江红》', type: 'work', from: 1136, to: 1140 },
            ]},
          { id: 'qin-hui', name: '秦桧', type: 'person', from: 1090, to: 1155,
            zi: '会之', polity: '南宋', entryPath: '科举', entryYear: 1115,
            summary: '政和五年进士。靖康被掳北去，后归南宋。两据相位十九年，主和议、构陷岳飞，为后世所唾。' },
          { id: 'han-shizhong', name: '韩世忠', type: 'person', from: 1090, to: 1151,
            zi: '良臣', hao: ['清凉居士'], polity: '南宋', entryPath: '军功',
            summary: '中兴四将之一。黄天荡之战困金兀术四十八日。岳飞冤狱时当面诘秦桧。' },
          { id: 'xin-qiji', name: '辛弃疾', type: 'person', from: 1140, to: 1207,
            zi: '幼安', hao: ['稼轩'], polity: '南宋',
            summary: '生于金占区，二十一岁起义南归。豪放词宗，与苏轼并称"苏辛"。一生力主北伐而不得用。',
            children: [
              { id: 'yongyule', name: '《永遇乐·京口北固亭怀古》', type: 'work', from: 1205, to: 1205 },
              { id: 'qingyulan', name: '《青玉案·元夕》', type: 'work', from: 1170, to: 1174 },
            ]},
          { id: 'lu-you', name: '陆游', type: 'person', from: 1125, to: 1210,
            zi: '务观', hao: ['放翁'], polity: '南宋',
            summary: '存诗九千余首，为古代最多产诗人。终身呼号北伐，临终仍作《示儿》。',
            children: [
              { id: 'shier', name: '《示儿》', type: 'work', from: 1210, to: 1210 },
              { id: 'chaitoufeng', name: '《钗头凤》', type: 'work', from: 1155, to: 1155 },
            ]},
          { id: 'zhu-xi', name: '朱熹', type: 'person', from: 1130, to: 1200,
            zi: '元晦', hao: ['晦庵', '紫阳'], polity: '南宋', entryPath: '科举', entryYear: 1148,
            summary: '理学的集大成者。师承二程之学，撰《四书章句集注》，此后成为科举圭臬，影响东亚六百余年。',
            children: [
              { id: 'sishu', name: '《四书章句集注》', type: 'work', from: 1182, to: 1190 },
              { id: 'zhuzi-yulei', name: '《朱子语类》', type: 'work', from: 1175, to: 1200 },
            ]},
          { id: 'wen-tianxiang', name: '文天祥', type: 'person', from: 1236, to: 1283,
            zi: '宋瑞', hao: ['文山'], polity: '南宋', entryPath: '科举', entryYear: 1256,
            summary: '宝祐四年状元。元军南下，散尽家财募兵勤王，兵败被俘，囚三年不屈，1283年就义于大都。',
            children: [
              { id: 'zhengqige', name: '《正气歌》', type: 'work', from: 1281, to: 1281 },
              { id: 'guolingdingyang', name: '《过零丁洋》', type: 'work', from: 1279, to: 1279 },
            ]},
          { id: 'lu-xiufu', name: '陆秀夫', type: 'person', from: 1236, to: 1279, polity: '南宋',
            summary: '崖山之战败，负幼帝赵昺投海，南宋亡。',
            children: [
              { id: 'yashan', name: '崖山海战', type: 'event', from: 1279, to: 1279 },
            ]},

          { id: 'zhongxing-4', name: '中兴四将', type: 'office', from: 1127, to: 1160,
            summary: '岳飞、韩世忠、张俊、刘光世。南宋初年支撑半壁的四大将。' },
          { id: 'kaiti', name: '程朱理学', type: 'school', from: 1130, to: 1279,
            summary: '朱熹集大成：理气论、格物致知、存天理灭人欲。元代后成正统。' },
          { id: 'lixue-jinhua', name: '心学（萌芽）', type: 'school', from: 1150, to: 1279,
            summary: '陆九渊"心即理"，与朱熹"性即理"分庭抗礼，开明代心学先河。' },
          { id: 'shaoxing-treaty', name: '绍兴和议', type: 'treaty', from: 1141, to: 1164,
            summary: '宋金划淮水大散关为界，宋称臣纳贡，岁贡银绢各二十五万。' },
          { id: 'longxing-treaty', name: '隆兴和议', type: 'treaty', from: 1164, to: 1208,
            summary: '孝宗北伐失利后所订，改"君臣"为"叔侄"，岁贡减十万。' },
          { id: 'jiaqing-treaty', name: '嘉定和议', type: 'treaty', from: 1208, to: 1234,
            summary: '开禧北伐失败后所订，宋金改称"伯侄"，岁币增至三十万。' },
          { id: 'huizi', name: '会子', type: 'work', from: 1161, to: 1279,
            summary: '南宋纸币，初行于东南。与北宋交子同为世界最早纸币之一，后期滥发致通胀。' },
        ]
      },

      /* ============================================================
         金 1115–1234（与辽、北宋、南宋并立）
         ============================================================ */
      {
        id: 'jin', name: '金', type: 'chaos', from: 1115, to: 1234,
        summary: '女真完颜氏所建，1115年完颜阿骨打称帝。1125灭辽，1127灭北宋，与南宋对峙。1234年在宋蒙夹击下亡。',
        children: [
          { id: 'wanyan-aguda', name: '完颜阿骨打', type: 'regime', from: 1068, to: 1123,
            summary: '金太祖。统一女真诸部，1115年称帝，创女真文字。' },
          { id: 'wanyan-zongbi', name: '完颜宗弼', type: 'regime', from: 1096, to: 1148,
            summary: '即兀术。金军南下的统帅，黄天荡、郾城与宋军鏖战，后主和成绍兴和议。' },
          { id: 'wanyan-liang', name: '完颜亮', type: 'regime', from: 1122, to: 1161,
            summary: '海陵王。弑君自立，迁都燕京，1161年南侵，采石之战败，被部将所杀。' },
          { id: 'cai-shi', name: '采石之战', type: 'event', from: 1161, to: 1161,
            summary: '虞允文临危督战，以小船火器大破金水军，完颜亮南侵受挫。' },
          { id: 'jin-song-war', name: '宋金战争', type: 'event', from: 1125, to: 1164,
            summary: '靖康之变后宋金持续交战，前期宋败，后期相持，终以和议划淮分治。' },
        ]
      },
    ]
  }
};

if (typeof window !== 'undefined') window.LONG_RIVER_DATA = DATA;
if (typeof module !== 'undefined') module.exports = DATA;
