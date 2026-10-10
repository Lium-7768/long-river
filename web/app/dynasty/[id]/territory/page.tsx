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
    <main className="relative z-10 min-h-screen px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-white/10 bg-[rgb(var(--lr-surface))] p-6 sm:p-8">
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

            {/* 地图放最下面 */}
            <TerritoryMap dynastyId={id} height={520} />

            <p className="text-base leading-relaxed text-white/30">
              关于本图：以现代省份轮廓近似古代疆域范围，仅作示意，非精确历史地理边界。
              真实历史边界需 CHGIS 等专业数据源。
            </p>
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
