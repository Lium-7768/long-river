import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="text-base tracking-[0.3em] text-sky-300/70">未找到</div>
        <h1 className="text-6xl font-semibold tracking-tight">此页不存在</h1>
        <p className="text-base leading-relaxed text-white/60">
          该条目不在长河中。可能是链接已变更，或朝代 / 人物 / 事件未收录。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-5 py-2 text-base text-sky-200 transition hover:bg-sky-400/20"
          >
            返回时间长河
          </Link>
        </div>
      </div>
    </main>
  );
}
