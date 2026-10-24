import { notFound } from 'next/navigation';
import { fetchDynastyProfile, fetchTerritoryCoverage } from '@/lib/dynasty-server';
import { TerritoryMap } from '@/components/profile/TerritoryMap';
import { PersonOriginPanel } from '@/components/profile/PersonOriginPanel';
import { RegionStatsPanel } from '@/components/profile/RegionStatsPanel';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

export default async function TerritoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await fetchDynastyProfile(id);
  if (!profile) notFound();

  const coverage = await fetchTerritoryCoverage();
  const cov: { provinces: string[]; note?: string } | undefined = coverage[id];
  const d = profile;

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: d.name, href: `/dynasty/${id}` },
            { label: '疆域' },
          ]}
        />

        <header>
          <div className="text-base tracking-[0.3em] text-sky-300/70">疆域地理</div>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">{d.name} · 疆域</h1>
        </header>

        {/* 疆域文字档案：22 朝代全有，不依赖省份高亮数据 */}
        {d.territory ? (
          <>
            <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-base sm:grid-cols-3">
              <div>
                <div className="text-base text-white/40">都城</div>
                <div className="mt-1 text-white/80">{d.territory.capital}</div>
              </div>
              <div>
                <div className="text-base text-white/40">疆域范围</div>
                <div className="mt-1 text-white/70">{d.territory.extent}</div>
              </div>
              <div>
                <div className="text-base text-white/40">覆盖省份</div>
                <div className="mt-1 text-white/70">
                  {cov ? `${cov.provinces.length} 个（示意）` : '—'}
                </div>
              </div>
              {d.territory.note && (
                <div className="sm:col-span-3">
                  <div className="text-base text-white/40">备注</div>
                  <div className="mt-1 text-white/70">{d.territory.note}</div>
                </div>
              )}
            </div>

            {d.territory.bounds && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  四至
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['东', d.territory.bounds.east],
                      ['南', d.territory.bounds.south],
                      ['西', d.territory.bounds.west],
                      ['北', d.territory.bounds.north],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                      >
                        <span className="shrink-0 font-medium text-sky-300/80">{k}至</span>
                        <span className="text-base text-white/70">{v}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {(d.territory.area || d.territory.population) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {d.territory.area && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-base text-white/40">大致面积</div>
                    <div className="mt-1 text-white/70">{d.territory.area}</div>
                  </div>
                )}
                {d.territory.population && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-base text-white/40">大致人口</div>
                    <div className="mt-1 text-white/70">{d.territory.population}</div>
                  </div>
                )}
              </div>
            )}

            {d.territory.divisions && d.territory.divisions.length > 0 && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  行政区划
                </h2>
                <p className="text-base leading-relaxed text-white/70">
                  {d.territory.divisions.join(' · ')}
                </p>
              </div>
            )}

            {d.territory.neighbors && d.territory.neighbors.length > 0 && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  邻国 / 周边关系
                </h2>
                <div className="space-y-2">
                  {d.territory.neighbors.map((n) => (
                    <div key={n.name} className="flex gap-3 text-base">
                      <span className="w-16 shrink-0 font-medium text-white/80">{n.name}</span>
                      <span className="text-white/60">{n.relation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
            该朝代的疆域档案还在整理中。
          </div>
        )}

        <PersonOriginPanel dynastyId={id} />
        <RegionStatsPanel dynastyId={id} />

        {/* 3D 省份示意：仅 5 朝代有省份数据，其余显示说明而非整页遮挡 */}
        {cov ? (
          <>
            <TerritoryMap dynastyId={id} height={520} />
            <p className="text-base leading-relaxed text-white/30">
              关于本图：以现代省份轮廓近似古代疆域范围，仅作示意，非精确历史地理边界。
              真实历史边界需 CHGIS 等专业数据源。
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-base text-white/40">该朝代的省份示意图还在整理中（疆域文字档案见上）。</p>
            <p className="mt-2 text-base text-white/25">已覆盖：宋（南/北）、辽、金、西夏；其余朝代仅文字档案可阅。</p>
          </div>
        )}

        {d.sources && d.sources.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="mb-2 text-base tracking-[0.2em] text-sky-300/70">史料来源</div>
            <ul className="space-y-1">
              {d.sources.map((s) => (
                <li key={s} className="text-base leading-relaxed text-white/60">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
