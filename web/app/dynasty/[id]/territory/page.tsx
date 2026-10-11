import { notFound } from 'next/navigation';
import { DYNASTIES } from '@/content/dynasties';
import { getProfile } from '@/content/profiles';
import { getCoverage } from '@/content/territory/coverage';
import { TerritoryMap } from '@/components/profile/TerritoryMap';
import { Breadcrumb } from '@/components/profile/Breadcrumb';

export default async function TerritoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dynasty = DYNASTIES.find((d) => d.id === id);
  const profile = getProfile(id);
  const cov = getCoverage(id);
  if (!dynasty) notFound();

  return (
    <main className="relative z-10 min-h-screen bg-[#05070d] px-6 py-10 text-white [background-image:linear-gradient(rgba(40,52,78,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(40,52,78,0.5)_1px,transparent_1px)] [background-size:44px_44px]">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-[#0d121e]/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <Breadcrumb
          items={[
            { label: '长河', href: '/' },
            { label: dynasty.name, href: `/dynasty/${id}` },
            { label: '疆域' },
          ]}
        />

        <header>
          <div className="text-base tracking-[0.3em] text-sky-300/70">疆域地理</div>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">{dynasty.name} · 疆域</h1>
        </header>

        {cov ? (
          <>
            {/* 描述信息放上面 */}
            {profile && (
              <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-base sm:grid-cols-3">
                <div>
                  <div className="text-base text-white/40">都城</div>
                  <div className="mt-1 text-white/80">{profile.territory.capital}</div>
                </div>
                <div>
                  <div className="text-base text-white/40">疆域范围</div>
                  <div className="mt-1 text-white/70">{profile.territory.extent}</div>
                </div>
                <div>
                  <div className="text-base text-white/40">覆盖省份</div>
                  <div className="mt-1 text-white/70">{cov.provinces.length} 个（示意）</div>
                </div>
                {profile.territory.note && (
                  <div className="sm:col-span-3">
                    <div className="text-base text-white/40">备注</div>
                    <div className="mt-1 text-white/70">{profile.territory.note}</div>
                  </div>
                )}
              </div>
            )}

            {/* 四至 */}
            {profile?.territory.bounds && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  四至
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['东', profile.territory.bounds.east],
                      ['南', profile.territory.bounds.south],
                      ['西', profile.territory.bounds.west],
                      ['北', profile.territory.bounds.north],
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

            {/* 面积 / 人口 */}
            {(profile?.territory.area || profile?.territory.population) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {profile?.territory.area && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-base text-white/40">大致面积</div>
                    <div className="mt-1 text-white/70">{profile.territory.area}</div>
                  </div>
                )}
                {profile?.territory.population && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-base text-white/40">大致人口</div>
                    <div className="mt-1 text-white/70">{profile.territory.population}</div>
                  </div>
                )}
              </div>
            )}

            {/* 行政区划 */}
            {profile?.territory.divisions && profile.territory.divisions.length > 0 && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  行政区划
                </h2>
                <p className="text-base leading-relaxed text-white/70">
                  {profile.territory.divisions.join(' · ')}
                </p>
              </div>
            )}

            {/* 邻国关系 */}
            {profile?.territory.neighbors && profile.territory.neighbors.length > 0 && (
              <div>
                <h2 className="mb-3 border-b border-white/10 pb-2 text-base font-medium tracking-wider text-white/50">
                  邻国 / 周边关系
                </h2>
                <div className="space-y-2">
                  {profile.territory.neighbors.map((n) => (
                    <div key={n.name} className="flex gap-3 text-base">
                      <span className="w-16 shrink-0 font-medium text-white/80">{n.name}</span>
                      <span className="text-white/60">{n.relation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 地图放最下面 */}
            <TerritoryMap dynastyId={id} height={520} />

            <p className="text-base leading-relaxed text-white/30">
              关于本图：以现代省份轮廓近似古代疆域范围，仅作示意，非精确历史地理边界。
              真实历史边界需 CHGIS 等专业数据源。
            </p>

            {/* 史料来源 */}
            {profile?.sources && profile.sources.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="mb-2 text-base tracking-[0.2em] text-sky-300/70">史料来源</div>
                <ul className="space-y-1">
                  {profile.sources.map((s) => (
                    <li key={s} className="text-base leading-relaxed text-white/60">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
            该朝代的疆域图还在整理中。
          </div>
        )}
      </div>
    </main>
  );
}
