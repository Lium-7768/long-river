/**
 * 朝代档案：第二层的「非人物」内容。
 * 数据来源：历史常识整理（模型生成初稿 + 人工审校）。
 * 与 CBDB 人物数据分离 —— 人物由 API 提供，档案是静态内容。
 */

export interface Institution {
  name: string; // 制度名，如「二府三司」
  desc: string; // 简述（一句）
  year?: number; // 创立/成型年份（可空）
  endYear?: number; // 废止/结束年份（可空）
  category?: InstitutionCategory; // 分类
  background?: string; // 设立背景 / 为什么
  impact?: string; // 影响 / 后果
  figures?: InstitutionFigure[]; // 关键人物（可关联人物页）
}

/** 制度分类 */
export type InstitutionCategory = '官制' | '军事' | '财政' | '选官' | '法律' | '其他';

/** 关键人物：name 必填；personId 若有则可跳转人物页 */
export interface InstitutionFigure {
  name: string;
  personId?: string;
}

export interface HistoricEvent {
  year: number; // 年份（负数=公元前）
  name: string; // 事件名
  desc: string; // 简述
}

export interface CultureItem {
  name: string; // 如「活字印刷」
  desc: string;
  category?: string; // 科技/文学/艺术/思想
  year?: number; // 出现/兴盛年份（可空）
}

export interface Territory {
  capital: string; // 都城
  extent: string; // 疆域范围
  note?: string;
}

export interface DynastyProfile {
  id: string; // 对应 content/dynasties.ts 的 id
  overview: string; // 一句话概括
  keywords: string[]; // 关键词标签
  institutions: Institution[]; // 政治制度
  events: HistoricEvent[]; // 重大事件
  culture: CultureItem[]; // 文化成就
  territory: Territory; // 疆域地理
  /** 数据完整性标记 */
  completeness: 'draft' | 'reviewed';
}
