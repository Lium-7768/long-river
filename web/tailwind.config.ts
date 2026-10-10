import type { Config } from 'tailwindcss';

/**
 * 长河主题系统
 * ------------------------------------------------------------
 * 所有主题色以 CSS 变量（RGB 三元组，空格分隔）定义于 globals.css，
 * 由 <html class="theme-*"> 切换。Tailwind 把它们暴露为工具类，
 * 形如：bg-lr-bg / text-lr-accent / border-lr-line …
 *
 * 变量用 "R G B" 格式而非 hex，是为了支持 Tailwind 的透明度修饰符，
 * 同时便于 Three.js 用 lib/theme.ts 直接读成 0~1 的分量。
 */
const config: Config = {
  darkMode: ['class', '[data-theme="deep"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 语义色 → CSS 变量
        'lr-bg': 'rgb(var(--lr-bg) / <alpha-value>)',
        'lr-surface': 'rgb(var(--lr-surface) / <alpha-value>)',
        'lr-fg': 'rgb(var(--lr-fg) / <alpha-value>)',
        'lr-muted': 'rgb(var(--lr-muted) / <alpha-value>)',
        'lr-line': 'rgb(var(--lr-line) / <alpha-value>)',
        'lr-accent': 'rgb(var(--lr-accent) / <alpha-value>)',
        'lr-accent2': 'rgb(var(--lr-accent-2) / <alpha-value>)',
        // 朝代色（3D 与 DOM 共用）
        dynasty: {
          xia: 'rgb(var(--lr-dynasty-xia) / <alpha-value>)',
          shang: 'rgb(var(--lr-dynasty-shang) / <alpha-value>)',
          zhou: 'rgb(var(--lr-dynasty-zhou) / <alpha-value>)',
          qin: 'rgb(var(--lr-dynasty-qin) / <alpha-value>)',
          han: 'rgb(var(--lr-dynasty-han) / <alpha-value>)',
          sanguo: 'rgb(var(--lr-dynasty-sanguo) / <alpha-value>)',
          jin: 'rgb(var(--lr-dynasty-jin) / <alpha-value>)',
          nanbei: 'rgb(var(--lr-dynasty-nanbei) / <alpha-value>)',
          sui: 'rgb(var(--lr-dynasty-sui) / <alpha-value>)',
          tang: 'rgb(var(--lr-dynasty-tang) / <alpha-value>)',
          wudai: 'rgb(var(--lr-dynasty-wudai) / <alpha-value>)',
          song: 'rgb(var(--lr-dynasty-song) / <alpha-value>)',
          liao: 'rgb(var(--lr-dynasty-liao) / <alpha-value>)',
          xixia: 'rgb(var(--lr-dynasty-xixia) / <alpha-value>)',
          jin2: 'rgb(var(--lr-dynasty-jin2) / <alpha-value>)',
          yuan: 'rgb(var(--lr-dynasty-yuan) / <alpha-value>)',
          ming: 'rgb(var(--lr-dynasty-ming) / <alpha-value>)',
          qing: 'rgb(var(--lr-dynasty-qing) / <alpha-value>)',
        },
        border: 'rgb(var(--lr-line) / <alpha-value>)',
        background: 'rgb(var(--lr-bg) / <alpha-value>)',
        foreground: 'rgb(var(--lr-fg) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgb(var(--lr-accent) / 0.35)',
        'glow-lg': '0 0 44px rgb(var(--lr-accent) / 0.45)',
      },
      keyframes: {
        'pulse-glow': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        'scan-line': 'scan-line 6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
