/**
 * 主题桥接：CSS 变量 → Three.js 颜色
 * ------------------------------------------------------------
 * WebGL 无法直接使用 CSS 变量，故运行时读取：
 *   --lr-accent: "0 229 255"  →  [0, 0.898, 1]
 * 主题切换后需重新读取（见 useThemeColor hook）。
 */

export type RGB = [number, number, number];

/** 读取 CSS 变量原始字符串 */
export function cssVar(name: string, el?: HTMLElement): string {
  const target = el ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return '';
  return getComputedStyle(target).getPropertyValue(name).trim();
}

/**
 * CSS 变量 → Three.js 归一化 RGB [0..1]
 * 支持 "0 229 255" 与 "#00e5ff" 两种写法。
 */
export function cssRgb(name: string, el?: HTMLElement): RGB {
  const raw = cssVar(name, el);
  if (!raw) return [1, 1, 1];

  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  const parts = raw.split(/[\s,]+/).map(Number);
  const [r, g, b] = [parts[0] ?? 255, parts[1] ?? 255, parts[2] ?? 255];
  return [r / 255, g / 255, b / 255];
}

/** 朝代 id → CSS 变量名 */
export function dynastyVar(id: string): string {
  const map: Record<string, string> = {
    xia: 'xia',
    shang: 'shang',
    'zhou-w': 'zhou',
    'zhou-e': 'zhou',
    qin: 'qin',
    'han-w': 'han',
    xin: 'han',
    'han-e': 'han',
    sanguo: 'sanguo',
    jin: 'jin',
    nanbei: 'nanbei',
    sui: 'sui',
    tang: 'tang',
    wudai: 'wudai',
    'song-w': 'song',
    'song-e': 'song',
    liao: 'liao',
    xixia: 'xixia',
    'jin-chao': 'jin2',
    yuan: 'yuan',
    ming: 'ming',
    qing: 'qing',
  };
  return `--lr-dynasty-${map[id] ?? id}`;
}
