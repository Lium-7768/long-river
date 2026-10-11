/**
 * 名篇索引：每朝代「代表诗词」—— 人工核验过的经典篇目。
 * 用法：DOMAIN 匹配 poems 表（按 title LIKE + author），保证展示的是名篇，
 * 而非按长度/数量随机取到的冷门作品。
 * 数据真实存在于 poems 表（chinese-poetry 数据集）。
 */

export interface FamousPoem {
  title: string;
  author: string;
}

export const FAMOUS_POEMS: Record<string, FamousPoem[]> = {
  tang: [
    { title: '静夜思', author: '李白' },
    { title: '将进酒', author: '李白' },
    { title: '望庐山瀑布', author: '李白' },
    { title: '早发白帝城', author: '李白' },
    { title: '月下独酌', author: '李白' },
    { title: '春望', author: '杜甫' },
    { title: '登高', author: '杜甫' },
    { title: '春夜喜雨', author: '杜甫' },
    { title: '登鹳雀楼', author: '王之涣' },
    { title: '凉州词', author: '王之涣' },
    { title: '黄鹤楼', author: '崔颢' },
    { title: '春晓', author: '孟浩然' },
    { title: '相思', author: '王维' },
    { title: '江雪', author: '柳宗元' },
    { title: '出塞', author: '王昌龄' },
    { title: '枫桥夜泊', author: '张继' },
    { title: '滁州西涧', author: '韦应物' },
    { title: '游子吟', author: '孟郊' },
    { title: '锦瑟', author: '李商隐' },
    { title: '无题', author: '李商隐' },
    { title: '赋得古原草送别', author: '白居易' },
    { title: '钱塘湖春行', author: '白居易' },
    { title: '琵琶行', author: '白居易' },
    { title: '乌衣巷', author: '刘禹锡' },
    { title: '竹枝词', author: '刘禹锡' },
    { title: '山行', author: '杜牧' },
    { title: '泊秦淮', author: '杜牧' },
    { title: '清明', author: '杜牧' },
    { title: '送杜少府之任蜀州', author: '王勃' },
    { title: '登幽州台歌', author: '陈子昂' },
  ],
  'song-w': [
    { title: '念奴娇', author: '苏轼' },
    { title: '水调歌头', author: '苏轼' },
    { title: '江城子', author: '苏轼' },
    { title: '蝶恋花', author: '苏轼' },
    { title: '定风波', author: '苏轼' },
    { title: '雨霖铃', author: '柳永' },
    { title: '望海潮', author: '柳永' },
    { title: '蝶恋花', author: '欧阳修' },
    { title: '生查子', author: '欧阳修' },
    { title: '桂枝香', author: '王安石' },
    { title: '元日', author: '王安石' },
    { title: '泊船瓜洲', author: '王安石' },
    { title: '梅花', author: '王安石' },
  ],
  'song-e': [
    { title: '声声慢', author: '李清照' },
    { title: '如梦令', author: '李清照' },
    { title: '一剪梅', author: '李清照' },
    { title: '醉花阴', author: '李清照' },
    { title: '武陵春', author: '李清照' },
    { title: '满江红', author: '岳飞' },
    { title: '青玉案', author: '辛弃疾' },
    { title: '破阵子', author: '辛弃疾' },
    { title: '永遇乐', author: '辛弃疾' },
    { title: '西江月', author: '辛弃疾' },
    { title: '钗头凤', author: '陆游' },
    { title: '示儿', author: '陆游' },
    { title: '游山西村', author: '陆游' },
    { title: '扬州慢', author: '姜夔' },
    { title: '过零丁洋', author: '文天祥' },
  ],
  yuan: [
    { title: '天净沙', author: '马致远' },
    { title: '山坡羊', author: '张养浩' },
    { title: '天净沙', author: '白朴' },
    { title: '沉醉东风', author: '关汉卿' },
  ],
  'zhou-w': [
    { title: '关雎', author: '佚名' },
    { title: '蒹葭', author: '佚名' },
    { title: '桃夭', author: '佚名' },
    { title: '硕鼠', author: '佚名' },
    { title: '无衣', author: '佚名' },
  ],
  'zhou-e': [
    { title: '离骚', author: '屈原' },
    { title: '九歌', author: '屈原' },
    { title: '天问', author: '屈原' },
    { title: '九章', author: '屈原' },
  ],
  qing: [
    { title: '长相思', author: '纳兰性德' },
    { title: '木兰花令', author: '纳兰性德' },
    { title: '浣溪沙', author: '纳兰性德' },
  ],
};
