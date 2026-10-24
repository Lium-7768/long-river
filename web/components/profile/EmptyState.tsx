'use client';

type Props = {
  title: string;
  desc?: string;
  icon?: string;
};

/**
 * 水墨空状态：宣纸纸纹 + 朱印 + 洒金，代替裸露的 `return null`。
 * 用于帝王/年号/疆域等“暂无数据”场景，保持版式完整、视觉克制。
 */
export function EmptyState({ title, desc, icon = '印' }: Props) {
  return (
    <div className="ink-paper group relative overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
      <span className="ink-sprinkle" aria-hidden />
      <div className="relative flex flex-col items-center">
        <span className="seal-mark rounded-[4px] text-[11px]" aria-hidden>
          {icon}
        </span>
        <div className="mt-3 text-base font-medium text-white/60">{title}</div>
        {desc && <div className="mt-1 max-w-md text-base leading-relaxed text-white/35">{desc}</div>}
      </div>
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg border border-white/5 bg-white/[0.04]"
          style={{ opacity: 0.7 - i * 0.12 }}
        />
      ))}
    </div>
  );
}
