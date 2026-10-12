'use client';

import Link from 'next/link';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="text-base tracking-[0.3em] text-rose-300/70">出错了</div>
        <h1 className="text-6xl font-semibold tracking-tight">页面渲染异常</h1>
        <p className="text-base leading-relaxed text-white/60">
          数据加载或渲染出现问题。可尝试重试，或返回时间长河。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-5 py-2 text-base text-sky-200 transition hover:bg-sky-400/20"
          >
            重试
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-5 py-2 text-base text-white/70 transition hover:bg-white/10"
          >
            返回时间长河
          </Link>
        </div>
      </div>
    </main>
  );
}
