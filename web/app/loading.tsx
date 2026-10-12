export default function Loading() {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center bg-[#05070d] text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-sky-400/80" />
        <div className="text-base tracking-[0.3em] text-white/45">载入中</div>
      </div>
    </main>
  );
}
