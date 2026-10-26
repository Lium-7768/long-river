#!/usr/bin/env node
/**
 * Turso 迁移验证：同一批请求分别打到「SQLite 基线」与「Turso 后端」，
 * 逐字节比对响应体。用途：确认迁移未改变 API 契约（前端零改动）。
 *
 * 用法：
 *   node server/scripts/verify-turso.mjs [基线端口] [Turso端口]
 *   默认 8799（SQLite） vs 8798（Turso）
 */
const BASE_A = parseInt(process.argv[2] || '8799', 10);
const BASE_B = parseInt(process.argv[3] || '8798', 10);
const A = `http://localhost:${BASE_A}`;
const B = `http://localhost:${BASE_B}`;

/** 覆盖所有 handler 分支的端点清单 */
const ENDPOINTS = [
  '/',
  '/api/stats',
  '/api/dynasties',
  '/api/territory-coverage',
  '/api/persons?dynasty=tang&limit=5',
  '/api/persons?dynasty=qing&limit=5&sort=birth',
  '/api/persons?q=李白&limit=3',
  '/api/persons?dynasty=ming&min_prom=5&limit=5',
  '/api/dynasty-profile?dynasty=tang',
  '/api/dynasty-profile?dynasty=xia',
  '/api/dynasty-profile?dynasty=song-w',
  '/api/emperors?dynasty=tang',
  '/api/nianhao?dynasty=tang',
  '/api/person-geo?dynasty=tang&limit=20',
  '/api/region-stats',
  '/api/poem-authors?limit=20',
  '/api/dynasty-poems?dynasty=tang',
  '/api/search?q=杜甫',
];

async function getJson(base, path) {
  try {
    const r = await fetch(base + path);
    const text = await r.text();
    return { status: r.status, text };
  } catch (e) {
    return { status: 'ERR', text: String(e && e.message ? e.message : e) };
  }
}

function stable(text) {
  // 只对已知「后端标识」字段做归一，其余必须逐字节一致
  return text
    .replace(/"backend":"[^"]*"/g, '"backend":"<X>"')
    .replace(/"source":"(SQLite|Turso[^"]*|PostgreSQL[^"]*)"/g, '"source":"<X>"')
    .replace(/"db":"[^"]*"/g, '"db":"<X>"');
}

(async () => {
  let pass = 0;
  const fails = [];
  for (const ep of ENDPOINTS) {
    const a = await getJson(A, ep);
    const b = await getJson(B, ep);
    const sa = stable(a.text);
    const sb = stable(b.text);
    if (a.status === b.status && sa === sb) {
      pass++;
      console.log(`  ✓ ${ep}  (${a.status}, ${a.text.length}B)`);
    } else {
      fails.push({ ep, a, b });
      console.log(`  ✗ ${ep}  A=${a.status}/${a.text.length}B  B=${b.status}/${b.text.length}B`);
    }
  }
  console.log(`\n结果：通过 ${pass}/${ENDPOINTS.length}`);
  if (fails.length) {
    for (const f of fails.slice(0, 5)) {
      console.log(`\n--- ${f.ep} ---`);
      console.log('A:', f.a.text.slice(0, 400));
      console.log('B:', f.b.text.slice(0, 400));
    }
    process.exit(1);
  }
})();
