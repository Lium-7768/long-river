import type { DynastyProfile } from './types';

/**
 * 夏朝 约公元前2070 – 前1600
 * 资料来源：《史记·夏本纪》《尚书》《竹书纪年》、二里头考古
 */
export const XIA: DynastyProfile = {
  id: 'xia',
  overview:
    '中国史载第一个世袭王朝，由部落联盟走向「家天下」；禹治水、启继位，历四百余年，考古上与二里头文化相应。',
  keywords: ['家天下', '大禹治水', '世袭制', '二里头', '夏历'],
  institutions: [
    {
      name: '世袭王权',
      category: '官制',
      year: -2070,
      endYear: -1600,
      desc: '废禅让而行父子兄弟世袭，王位在夏后氏一族内传承。',
      background: '禹死后其子启继位，击败有扈氏，确立「家天下」。',
      impact: '中国王朝制度之始，王权世袭成为此后三千年之常态。',
      figures: [{ name: '禹' }, { name: '启' }],
    },
    {
      name: '九州与贡赋',
      category: '财政',
      year: -2070,
      endYear: -1600,
      desc: '传说禹划天下为九州，依土定贡赋，为早期国家赋税之雏形。',
      background: '禹治水遍行天下，据山川地理划定九州、定贡赋等差。',
      impact: '「九州」成为中国的代称，贡赋之制为后世赋税制度之滥觞。',
      figures: [{ name: '禹' }],
    },
    {
      name: '夏历与天文',
      category: '其他',
      year: -2070,
      endYear: -1600,
      desc: '行「夏历」（农历前身），以观象授时指导农事。',
      background: '农业社会需掌握农时，夏人观天象、定历法。',
      impact: '夏历为后世农历之源，反映早期中国天文学的成就。',
      figures: [],
    },
  ],
  events: [
    {
      year: -2070,
      name: '禹传启·家天下',
      category: '政变',
      desc: '禹死，其子启继位，废禅让、立世袭，夏朝建立。',
      background: '禹治水有功、部落联盟推其为领袖；禹卒后启夺位自立。',
      outcome: '启击败不服的有扈氏，确立世袭王权，夏朝立国。',
      impact: '中国从部落联盟迈入王朝国家，「家天下」制度由此开端。',
      figures: [{ name: '禹' }, { name: '启' }, { name: '有扈氏' }],
    },
    {
      year: -1600,
      name: '商汤灭夏',
      category: '战争',
      desc: '夏桀暴虐，商汤兴兵，鸣条之战灭夏。',
      background: '夏末桀荒淫暴虐、诸侯叛离，商族汤修德任贤（伊尹）。',
      outcome: '鸣条之战夏军溃败，桀逃亡而死，夏亡。',
      impact: '「汤武革命」成为后世改朝换代的典范叙事。',
      figures: [{ name: '夏桀' }, { name: '商汤' }, { name: '伊尹' }],
    },
  ],
  culture: [
    {
      name: '二里头文化',
      category: '其他',
      desc: '二里头遗址（今河南偃师）有宫城、青铜器，学界多认为与夏文化相关。',
      background: '二里头展现早期国家都城形态与青铜文明。',
      impact: '为探索夏文化提供关键考古证据，是中华文明形成的重要标志。',
      figures: [],
      works: ['二里头宫殿遗址', '青铜爵'],
    },
    {
      name: '夏历与《夏小正》',
      category: '科技',
      desc: '夏历以正月为岁首，《夏小正》记物候农事，为最早历书之一。',
      background: '农业需知农时，夏人积累天象物候知识。',
      impact: '夏历为中国农历之源，影响数千年农业生产。',
      figures: [],
      works: ['《夏小正》'],
    },
    {
      name: '青铜初兴',
      category: '艺术',
      desc: '夏代青铜器初兴，有爵、斝等礼器，冶铸技术起步。',
      background: '二里头已见青铜铸造作坊与礼器。',
      impact: '中国青铜时代之肇端，为商周青铜文明的辉煌奠基。',
      figures: [],
      works: ['二里头青铜器'],
    },
  ],
  territory: {
    capital: '阳城、斟鄩等（今河南西部、山西南部）',
    extent: '核心区在今河南中西部、山西南部（伊洛、汾涑流域），势力影响及黄河中下游。',
    note: '夏为早期国家，疆域以核心区与影响范围计，尚无明确国界。',
    bounds: {
      east: '东至今河南东部、山东西部',
      west: '西至今陕西东部、山西南部',
      south: '南至淮河、汉水以北',
      north: '北至今山西、河北南部',
    },
    divisions: ['九州（传说区划：冀、兖、青、徐、扬、荆、豫、梁、雍）'],
    neighbors: [
      { name: '东夷', relation: '东方诸族，与夏时战时和' },
      { name: '有扈氏等部落', relation: '夏初不服启之世袭，被启所灭' },
      { name: '商族', relation: '夏之属国，后起兵灭夏' },
    ],
    area: '约 30 万–50 万平方公里（核心影响区，史家估数）',
    population: '约 200 万–300 万（史家估数）',
  },
  completeness: 'draft',
};
