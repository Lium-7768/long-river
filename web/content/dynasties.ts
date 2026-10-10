/**
 * 中国朝代轴（公元前 2070 → 1912）
 * 来源：Wikipedia《中国朝代》年表
 * 颜色不写死 hex，而是引用 CSS 变量 --lr-dynasty-*，
 * 由 lib/theme.ts 读出 → 两套主题下 3D 与 DOM 自动换色。
 */
export interface Dynasty {
  id: string;
  name: string;
  start: number; // 负数 = 公元前
  end: number;
  note: string;
  /** 对应的 CSS 变量名（朝代色） */
  colorVar: string;
}

export const DYNASTIES: Dynasty[] = [
  {
    id: 'xia',
    name: '夏',
    start: -2070,
    end: -1600,
    note: '传说时代，二里头文化',
    colorVar: '--lr-dynasty-xia',
  },
  {
    id: 'shang',
    name: '商',
    start: -1600,
    end: -1046,
    note: '甲骨文，青铜文明',
    colorVar: '--lr-dynasty-shang',
  },
  {
    id: 'zhou-w',
    name: '西周',
    start: -1046,
    end: -771,
    note: '分封制，礼乐文明',
    colorVar: '--lr-dynasty-zhou',
  },
  {
    id: 'zhou-e',
    name: '东周',
    start: -770,
    end: -256,
    note: '春秋战国，百家争鸣',
    colorVar: '--lr-dynasty-zhou',
  },
  {
    id: 'qin',
    name: '秦',
    start: -221,
    end: -207,
    note: '首个大一统帝国',
    colorVar: '--lr-dynasty-qin',
  },
  {
    id: 'han-w',
    name: '西汉',
    start: -202,
    end: 9,
    note: '丝绸之路',
    colorVar: '--lr-dynasty-han',
  },
  { id: 'xin', name: '新', start: 9, end: 23, note: '王莽改制', colorVar: '--lr-dynasty-han' },
  {
    id: 'han-e',
    name: '东汉',
    start: 25,
    end: 220,
    note: '蔡伦造纸',
    colorVar: '--lr-dynasty-han',
  },
  {
    id: 'sanguo',
    name: '三国',
    start: 220,
    end: 280,
    note: '魏蜀吴',
    colorVar: '--lr-dynasty-sanguo',
  },
  { id: 'jin', name: '晋', start: 266, end: 420, note: '西晋东晋', colorVar: '--lr-dynasty-jin' },
  {
    id: 'nanbei',
    name: '南北朝',
    start: 420,
    end: 589,
    note: '南北对峙',
    colorVar: '--lr-dynasty-nanbei',
  },
  {
    id: 'sui',
    name: '隋',
    start: 581,
    end: 619,
    note: '开科举，大运河',
    colorVar: '--lr-dynasty-sui',
  },
  { id: 'tang', name: '唐', start: 618, end: 907, note: '盛唐气象', colorVar: '--lr-dynasty-tang' },
  {
    id: 'wudai',
    name: '五代十国',
    start: 907,
    end: 960,
    note: '分裂时期',
    colorVar: '--lr-dynasty-wudai',
  },
  { id: 'liao', name: '辽', start: 916, end: 1125, note: '契丹', colorVar: '--lr-dynasty-liao' },
  {
    id: 'song-w',
    name: '北宋',
    start: 960,
    end: 1127,
    note: '文治巅峰',
    colorVar: '--lr-dynasty-song',
  },
  {
    id: 'xixia',
    name: '西夏',
    start: 1038,
    end: 1227,
    note: '党项',
    colorVar: '--lr-dynasty-xixia',
  },
  {
    id: 'jin-chao',
    name: '金',
    start: 1115,
    end: 1234,
    note: '女真',
    colorVar: '--lr-dynasty-jin2',
  },
  {
    id: 'song-e',
    name: '南宋',
    start: 1127,
    end: 1279,
    note: '偏安江南',
    colorVar: '--lr-dynasty-song',
  },
  {
    id: 'yuan',
    name: '元',
    start: 1271,
    end: 1368,
    note: '蒙古帝国',
    colorVar: '--lr-dynasty-yuan',
  },
  {
    id: 'ming',
    name: '明',
    start: 1368,
    end: 1644,
    note: '郑和下西洋',
    colorVar: '--lr-dynasty-ming',
  },
  {
    id: 'qing',
    name: '清',
    start: 1636,
    end: 1912,
    note: '末代王朝',
    colorVar: '--lr-dynasty-qing',
  },
];

/** 有数据的朝代（可进入第二层） */
export const DYNASTIES_WITH_DATA = new Set(['song-w', 'song-e', 'liao', 'xixia', 'jin-chao']);
