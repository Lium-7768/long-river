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
