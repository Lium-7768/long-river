'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, type PersonDetail } from '@/lib/api';
import { fmtRangeBP, fmtYearShort } from '@/components/river/year';

/**
 * 通用详情抽屉：右侧滑出。
 * - 人物 → 拉 /api/persons/:id 显示完整数据
 * - 其他（制度/事件/文化/疆域）→ 直接把传入的条目显示出来
 */

export type DetailPayload =
  | { kind: 'person'; id: string; name: string }
  | { kind: 'event'; year: number; name: string; desc: string }
  | { kind: 'institution'; year?: number; name: string; desc: string }
  | { kind: 'culture'; year?: number; name: string; desc: string; tag?: string };

export function DetailDrawer({
  payload,
  onClose,
}: {
  payload: DetailPayload | null;
  onClose: () => void;
}) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (payload?.kind === 'person') {
      setLoading(true);
      setPerson(null);
      api
        .person(payload.id)
        .then((r) => setPerson(r.data))
        .catch(() => setPerson(null))
        .finally(() => setLoading(false));
    } else {
      setPerson(null);
    }
  }, [payload]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = payload !== null;

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* 抽屉 */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[min(460px,92vw)] overflow-y-auto border-l border-white/10 bg-[#05080f] px-6 py-6 transition-transform duration-300 ${
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

        {payload?.kind === 'person' &&
          (loading ? (
            <div className="mt-20 text-center text-white/40">加载中…</div>
          ) : person ? (
            <PersonDetailView p={person} />
          ) : (
            <div className="mt-20 text-center text-white/40">未找到</div>
          ))}

        {payload && payload.kind !== 'person' && <SimpleDetailView payload={payload} />}
      </aside>
    </>
  );
}

function PersonDetailView({ p }: { p: PersonDetail }) {
  const life = p.birth || p.death ? fmtRangeBP(p.birth ?? 0, p.death ?? 0) : '';
  return (
    <div>
      <div className="pr-8">
        <h3 className="text-3xl font-semibold text-white">{p.name}</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/50">
          {p.zi && <span>字{p.zi}</span>}
          {p.hao && p.hao.length > 0 && <span>号{p.hao.join('、')}</span>}
          {p.shi && p.shi.length > 0 && <span>谥{p.shi.join('、')}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
          {life && <span className="tabular-nums">{life}</span>}
          {p.top_office && <span className="text-sky-300/70">{p.top_office}</span>}
          {p.addr && p.addr.length > 0 && <span>{p.addr.join(' · ')}</span>}
        </div>
      </div>

      {p.summary && <p className="mt-5 text-sm leading-relaxed text-white/70">{p.summary}</p>}

      {p.offices.length > 0 && (
        <Section title={`历任官职（${p.offices.length}）`}>
          <div className="flex flex-wrap gap-1.5">
            {p.offices.map((o, i) => (
              <span key={i} className="rounded bg-white/[0.05] px-2 py-0.5 text-xs text-white/65">
                {o.office}
              </span>
            ))}
          </div>
        </Section>
      )}

      {p.kinships.length > 0 && (
        <Section title={`亲属关系（${p.kinships.length}）`}>
          <div className="space-y-1">
            {p.kinships.slice(0, 40).map((k, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-28 shrink-0 text-xs text-white/40">{cleanRel(k.rel)}</span>
                <span className="text-white/75">{k.name}</span>
              </div>
            ))}
            {p.kinships.length > 40 && (
              <div className="text-xs text-white/30">… 其余 {p.kinships.length - 40} 条</div>
            )}
          </div>
        </Section>
      )}

      {p.entries.length > 0 && (
        <Section title="科第 / 条目">
          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            {p.entries.map((e, i) => (
              <span key={i} className="rounded bg-white/[0.05] px-2 py-0.5 tabular-nums">
                {e.year ? fmtYearShort(e.year) : '—'} {e.entry ?? ''}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 著作标题全为 null，暂不展示 */}
    </div>
  );
}

function SimpleDetailView({ payload }: { payload: Exclude<DetailPayload, { kind: 'person' }> }) {
  const KIND_LABEL = { event: '事件', institution: '制度', culture: '文化' } as const;
  return (
    <div>
      <div className="text-xs tracking-[0.3em] text-sky-300/60">{KIND_LABEL[payload.kind]}</div>
      <h3 className="mt-2 text-3xl font-semibold text-white">{payload.name}</h3>
      {'year' in payload && payload.year != null && (
        <div className="mt-1 text-lg tabular-nums text-white/45">{fmtYearShort(payload.year)}</div>
      )}
      <p className="mt-5 text-sm leading-relaxed text-white/70">{payload.desc}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="mb-2 text-xs font-medium tracking-wider text-white/40">{title}</h4>
      {children}
    </section>
  );
}

/** 亲属关系标签简化 */
function cleanRel(rel: string): string {
  return rel
    .replace('(反向)', '')
    .split(';')[0]
    .replace('直系祖先', '先祖')
    .replace('直系后代', '后裔');
}
