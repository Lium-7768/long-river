#!/usr/bin/env node
/**
 * 前端链接体检 v4：从后端 API 取朝代档案，逐个验证 L2/L3 链接。
 * 数据源已从 web/content/*.ts 迁到 SQLite（/api/dynasty-profile）。
 *
 *  必须在**生产服务器**（next build && next start）上运行：
 *  动态路由的 notFound() 只在 prod 返回真 404；dev 下恒为 200，且 HTML 里
 *  总会 bundle not-found 边界，文本判定不可靠 —— 故仅以**状态码**为准。
 *
 * 用法: BASE=http://localhost:3001 node web/scripts/link-check.cjs
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const API = process.env.API || 'http://localhost:8787';

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'manual' });
    return { status: r.status, text: await r.text() };
  } catch {
    return { status: 'ERR', text: '' };
  }
}

async function api(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`API ${r.status} ${path}`);
  const j = await r.json();
  return j.data;
}

(async () => {
  const dynasties = await api('/api/dynasties');
  let pass = 0,
    fail = 0;
  const problems = [];
  let totalItems = 0;

  for (const d of dynasties) {
    const id = d.id;
    const p = await api(`/api/dynasty-profile?dynasty=${encodeURIComponent(id)}`);
    const items = [
      ...(p.institutions || []).map((x) => ({ kind: 'system', name: x.name })),
      ...(p.events || []).map((x) => ({ kind: 'event', name: x.name })),
      ...(p.culture || []).map((x) => ({ kind: 'culture', name: x.name })),
    ];
    totalItems += items.length;

    if ((await get(`${BASE}/dynasty/${id}`)).status !== 200) {
      problems.push(`[L2] ${id}`);
      fail++;
    } else pass++;

    const seen = new Set();
    for (const it of items) {
      const url = `/dynasty/${id}/${it.kind}/${encodeURIComponent(it.name)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const r = await get(`${BASE}${url}`);
      if (r.status === 200) pass++;
      else {
        fail++;
        problems.push(`[L3-${it.kind}] ${id} "${it.name}" → ${r.status}`);
      }
    }

    if ((await get(`${BASE}/dynasty/${id}/territory`)).status === 200) pass++;
    else {
      fail++;
      problems.push(`[territory] ${id}`);
    }

    // 全量人物列表页
    if ((await get(`${BASE}/dynasty/${id}/persons`)).status === 200) pass++;
    else {
      fail++;
      problems.push(`[persons] ${id}`);
    }
    console.log(`  ${id}: ${items.length} 条目`);
  }

  console.log(`\n✓ 通过 ${pass} · 失败 ${fail}（共 ${dynasties.length} 朝 · ${totalItems} 条目）`);
  if (problems.length) {
    console.log('\n=== 问题 ===');
    problems.forEach((p) => console.log('  ' + p));
    process.exit(1);
  }
})();
