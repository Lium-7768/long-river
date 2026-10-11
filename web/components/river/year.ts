/** 统一的年份格式化：负数=公元前，正数=公元。始终带"公元前/公元"前缀。 */
export function fmtYear(y: number): string {
  return y < 0 ? `公元前${-y}` : `公元${y}`;
}

/** 短格式：只用于空间紧张处（如 3D 节点标签） */
export function fmtYearShort(y: number): string {
  return y < 0 ? `前${-y}` : `${y}`;
}

/** 时间范围：公元前221 — 公元1912 */
export function fmtRange(start: number, end: number): string {
  return `${fmtYear(start)} — ${fmtYear(end)}`;
}

/**
 * 最佳实践年份：只有公元前才标「公元前」，公元不标。
 * 中文历史写作惯例 —— 绝大多数是公元，标「公元」冗余。
 * 例：公元前2070 / 960
 */
export function fmtYearBP(y: number): string {
  return y < 0 ? `公元前${-y}` : `${y}`;
}

/** 最佳实践时间范围：公元前2070 — 公元前1600 / 960 — 1127 */
export function fmtRangeBP(start: number, end: number): string {
  return `${fmtYearBP(start)} — ${fmtYearBP(end)}`;
}

/* ------------------------------------------------------------------ *
 *  以下为“缺失值安全”变体。人物/事件常缺生卒年，直接传 0 会错误地
 *  显示成「公元0」。这些函数在缺值时返回占位符，避免误导性年份。
 * ------------------------------------------------------------------ */

/** 单年，缺值时返回占位符（默认「不详」）。 */
export function fmtYearOr(y: number | null | undefined, fallback = '不详'): string {
  return y == null ? fallback : fmtYear(y);
}

/**
 * 时间范围，缺值优雅降级：
 *  - 双缺 → 「不详」
 *  - 缺起 → 「？ — 公元x」
 *  - 缺止 → 「公元前x — ？」
 */
export function fmtRangeOr(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null && end == null) return '不详';
  if (start == null) return `？ — ${fmtYear(end as number)}`;
  if (end == null) return `${fmtYear(start)} — ？`;
  return fmtRange(start, end);
}
