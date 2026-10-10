'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, type PersonDetail } from '@/lib/api';
import { fmtRange } from '@/components/river/year';

/** 人物抽屉：点关系图姓名时滑出，显示那个人自己的详情。 */
export function PersonDrawer({
  person,
  onClose,
}: {
  person: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const open = person !== null;

  useEffect(() => {
    if (!person) return;
    setLoading(true);
    setData(null);
    api
      .person(person.id)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [person]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const life = data && (data.birth || data.death) ? fmtRange(data.birth ?? 0, data.death ?? 0) : '';

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[min(420px,92vw)] overflow-y-auto border-l border-white/10 bg-[#05080f] px-6 py-6 transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-white/15 p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        {loading && <div className="mt-20 text-center text-white/40">加载中…</div>}

        {!loading && data && (
          <>
            <div className="pr-8">
              <h3 className="text-2xl font-semibold text-white">{data.name}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-base text-white/50">
                {data.zi && <span>字{data.zi}</span>}
                {data.hao?.length ? <span>号{data.hao.join('、')}</span> : null}
                {data.shi?.length ? <span>谥{data.shi.join('、')}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-white/40">
                {life && <span className="tabular-nums">{life}</span>}
                {data.top_office && <span className="text-sky-300/70">{data.top_office}</span>}
              </div>
            </div>
            {data.summary && (
              <p className="mt-4 text-base leading-relaxed text-white/70">{data.summary}</p>
            )}
            {data.offices.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-base font-medium tracking-wider text-white/40">
                  历任官职（{data.offices.length}）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.offices.slice(0, 30).map((o, i) => (
                    <span
                      key={i}
                      className="rounded bg-white/[0.05] px-2 py-0.5 text-base text-white/65"
                    >
                      {o.office}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {!loading && !data && <div className="mt-20 text-center text-white/40">未找到</div>}
      </aside>
    </>
  );
}
