'use client';

import { SONG_W } from '@/content/profiles/song-w';
import { fmtYear } from '@/components/river/year';

const p = SONG_W;

export default function Preview() {
  return (
    <main className="min-h-screen bg-[#03060f] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        {/* 概括 + 关键词 */}
        <div className="text-[13px] tracking-[0.3em] text-sky-300/70">朝代档案 · 预览</div>
        <h1 className="mt-2 text-6xl font-semibold tracking-tight">北宋</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/70">{p.overview}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {p.keywords.map((k) => (
            <span
              key={k}
              className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200"
            >
              {k}
            </span>
          ))}
        </div>

        {/* 疆域 */}
        <Section title="疆域地理">
          <Row label="都城" value={p.territory.capital} />
          <Row label="疆域" value={p.territory.extent} />
          {p.territory.note && <Row label="备注" value={p.territory.note} />}
        </Section>

        {/* 制度 */}
        <Section title="政治制度">
          {p.institutions.map((it) => (
            <Item key={it.name} name={it.name} desc={it.desc} />
          ))}
        </Section>

        {/* 事件 */}
        <Section title="重大事件">
          <div className="space-y-3">
            {p.events.map((e) => (
              <div key={e.name} className="flex gap-4">
                <div className="w-24 shrink-0 pt-0.5 text-right text-sm tabular-nums text-sky-300/70">
                  {fmtYear(e.year)}
                </div>
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-white/55">{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 文化 */}
        <Section title="文化成就">
          {p.culture.map((c) => (
            <Item key={c.name} name={c.name} desc={c.desc} tag={c.category} />
          ))}
        </Section>

        <div className="mt-12 text-center text-xs text-white/30"></div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-5 border-b border-white/10 pb-3 text-xl font-semibold tracking-wide text-white/90">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="w-16 shrink-0 text-white/40">{label}</span>
      <span className="text-white/75">{value}</span>
    </div>
  );
}

function Item({ name, desc, tag }: { name: string; desc: string; tag?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-white/90">{name}</span>
        {tag && <span className="text-xs text-sky-300/60">{tag}</span>}
      </div>
      <div className="text-sm text-white/55">{desc}</div>
    </div>
  );
}
