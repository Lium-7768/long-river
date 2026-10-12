#!/usr/bin/env node
/**
 * 前端链接体检 v3：稳健提取 L3 条目名 + 检测「未找到」。
 */
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'manual' });
    return { status: r.status, text: await r.text() };
  } catch {
    return { status: 'ERR', text: '' };
  }
}

/** 解析字段块 [ ... ]，逐层记录每个对象（depth==1）的 name */
function fieldItems(src, field) {
  const re = new RegExp(`\\b${field}:\\s*\\[`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length - 1;
    let depth = 0;
    let objDepth = 0;
    const names = [];
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) break;
      } else if (c === '{') {
        objDepth = depth;
      } else if (c === '}') {
        objDepth = 0;
      }
      // 只在 depth==1 的顶层对象里取 name
      if (c === 'n' && depth === 1 && src.startsWith('name:', i)) {
        const mm = /^name:\s*'([^']+)'/.exec(src.slice(i));
        if (mm) names.push(mm[1]);
      }
    }
    out.push(...names);
  }
  return out;
}

(async () => {
  const dir = 'web/content/profiles';
  const ids = [...fs.readFileSync('web/content/dynasties.ts', 'utf8').matchAll(/id:\s*'([a-z-]+)'/g)].map(
    (m) => m[1],
  );
  let pass = 0,
    fail = 0;
  const problems = [];
  for (const id of ids) {
    const f = `${dir}/${id}.ts`;
    if (!fs.existsSync(f)) {
      problems.push(`[profile缺失] ${id}`);
      fail++;
      continue;
    }
    const src = fs.readFileSync(f, 'utf8');
    const items = [];
    for (const [field, kind] of [
      ['institutions', 'system'],
      ['events', 'event'],
      ['culture', 'culture'],
    ])
      for (const nm of fieldItems(src, field)) items.push({ kind, name: nm });

    if ((await get(`${BASE}/dynasty/${id}`)).status !== 200) problems.push(`[L2] ${id}`);
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
    console.log(`  ${id}: ${items.length} 条目`);
  }
  console.log(`\n✓ 通过 ${pass} · 失败 ${fail}`);
  if (problems.length) {
    console.log('\n=== 问题 ===');
    problems.forEach((p) => console.log('  ' + p));
  }
})();
