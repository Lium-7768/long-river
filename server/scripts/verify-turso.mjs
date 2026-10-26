#!/usr/bin/env node
/**
 * Turso 迁移完整回归：把同一批请求分别打到两个后端，逐字节比对响应体。
 *
 * 覆盖：22 个静态端点 + 2 个动态路由 + 4 个错误/边界分支。
 * 除「后端标识字段」（source / backend / db）外，响应必须完全一致。
 *
 * 用法：
 *   node server/scripts/verify-turso.mjs [基线端口] [被测端口]
 *   默认 8788（SQLite 基线） vs 8787（Turso 被测）
 */
const BASE_A = parseInt(process.argv[2] || '8788', 10);
const BASE_B = parseInt(process.argv[3] || '8787', 10);
const A = `http://localhost:${BASE_A}`;
const B = `http://localhost:${BASE_B}`;

const PERSON_ID = 'lilong-19244'; // 李隆基(唐玄宗)
const POEM_ID = '1875'; // 李白《将进酒》类名篇

/** [标签, 路径] —— 覆盖每个 handler 与主要分支 */
const CASES = [
  // ---- 元信息 ----
  ['根', '/'],
  ['统计', '/api/stats'],
  ['朝代轴', '/api/dynasties'],
  ['政权列表', '/api/polities'],
  ['疆域覆盖', '/api/territory-coverage'],
  ['参考字典', '/api/ref-dict'],
  ['书目', '/api/bibliography?limit=20'],
  ['书目-搜索', '/api/bibliography?q=唐&limit=10'],
  ['版本', '/api/book-editions?limit=20'],
  ['史料来源', '/api/evidence-sources?limit=20'],

  // ---- 人物 ----
  ['人物-按朝', '/api/persons?dynasty=tang&limit=5'],
  ['人物-按朝+生年排序', '/api/persons?dynasty=qing&limit=5&sort=birth'],
  ['人物-声望过滤', '/api/persons?dynasty=ming&min_prom=5&limit=5'],
  ['人物-姓名搜索', '/api/persons?q=李白&limit=3'],
  ['人物-政权', '/api/persons?polity=唐&limit=5'],
  ['人物-分页', '/api/persons?dynasty=song-w&limit=5&offset=10'],
  ['人物详情', `/api/persons/${PERSON_ID}`],
  ['人物社会关系', `/api/person-assocs?person=${PERSON_ID}&limit=20`],
  ['人物社会关系-按类型', `/api/person-assocs?person=${PERSON_ID}&rel=友&limit=10`],
  ['人物查找', '/api/person-lookup?name=李白'],
  ['人物籍贯', '/api/person-geo?dynasty=tang&limit=20'],
  ['全局搜索', '/api/search?q=杜甫'],

  // ---- 朝代档案 ----
  ['朝代档案-唐', '/api/dynasty-profile?dynasty=tang'],
  ['朝代档案-夏', '/api/dynasty-profile?dynasty=xia'],
  ['朝代档案-北宋', '/api/dynasty-profile?dynasty=song-w'],
  ['帝王-唐', '/api/emperors?dynasty=tang'],
  ['帝王-全量', '/api/emperors'],
  ['年号-唐', '/api/nianhao?dynasty=tang'],
  ['年号-搜索', '/api/nianhao?q=开元'],
  ['年号反查', '/api/nianhao-lookup?name=开元'],
  ['政区户数', '/api/region-stats'],
  ['政区户数-搜索', '/api/region-stats?q=河南'],

  // ---- 诗词 ----
  ['诗词-朝代聚合', '/api/dynasty-poems?dynasty=tang'],
  ['诗词作者', '/api/poem-authors?limit=20'],
  ['诗词列表', '/api/poems?dynasty=tang&limit=5'],
  ['诗词-作者筛选', '/api/poems?author=李白&limit=5'],
  ['诗词-搜索', '/api/poems?q=明月&limit=5'],
  ['单首诗词', `/api/poems/${POEM_ID}`],

  // ---- 错误 / 边界分支 ----
  ['错误-未知路径', '/api/definitely-not-exist'],
  ['错误-缺 person', '/api/person-assocs'],
  ['错误-缺 dynasty', '/api/dynasty-profile'],
  ['错误-缺 q', '/api/search'],
  ['边界-不存在的人物', '/api/persons/no-such-person-xyz'],
];

/** 归一化：只抹掉「后端标识」字段，其余必须逐字节一致 */
function stable(text) {
  return text
    .replace(/"backend":"[^"]*"/g, '"backend":"<X>"')
    .replace(/"source":"(SQLite|Turso[^"]*|PostgreSQL[^"]*)"/g, '"source":"<X>"')
    .replace(/"db":"[^"]*"/g, '"db":"<X>"');
}

async function probe(base, path) {
  const t0 = performance.now();
  try {
    const r = await fetch(base + path);
    const text = await r.text();
    return { status: r.status, text, ms: performance.now() - t0 };
  } catch (e) {
    return { status: 'ERR', text: String(e?.message || e), ms: performance.now() - t0 };
  }
}

(async () => {
  let pass = 0;
  const fails = [];
  console.log(`基线 A = ${A}   被测 B = ${B}\n`);

  for (const [label, path] of CASES) {
    const a = await probe(A, path);
    const b = await probe(B, path);
    const ok = a.status === b.status && stable(a.text) === stable(b.text);
    if (ok) pass++;
    else fails.push({ label, path, a, b });
    const mark = ok ? '✓' : '✗';
    console.log(
      `  ${mark} ${label.padEnd(18)} A=${String(a.status).padEnd(3)} ${a.ms.toFixed(0).padStart(5)}ms  ` +
        `B=${String(b.status).padEnd(3)} ${b.ms.toFixed(0).padStart(5)}ms  ${path}`,
    );
  }

  console.log(`\n结果：${pass}/${CASES.length} 通过`);
  if (fails.length) {
    console.log('\n=== 失败明细 ===');
    for (const f of fails) {
      console.log(`\n--- ${f.label}  ${f.path}`);
      console.log(`  A(${f.a.status}): ${f.a.text.slice(0, 300)}`);
      console.log(`  B(${f.b.status}): ${f.b.text.slice(0, 300)}`);
    }
    process.exit(1);
  }
  console.log('全部一致 ✓');
})();
