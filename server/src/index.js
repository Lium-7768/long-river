/**
 * 长河 · 本地后端（Node + SQLite / Turso / PostgreSQL）
 * ------------------------------------------------------------
 * 唯一后端。数据源优先级：
 *   TURSO_DATABASE_URL > DATABASE_URLS(4 分片 PG) > DATABASE_URL(单库 PG) > 本地 SQLite
 *
 * 为什么 Turso 排在 PG 之前：本项目 schema 本就是 SQLite 方言，
 * 走 Postgres 需要 pg-compat 做占位符/保留字/类型三处兼容，还需 4 分片规避
 * Neon Free 1GB/project 限制；Turso 是 SQLite 兼容引擎、Free 5GB 单库，
 * 分片与兼容层都不需要了。PG 路径保留，随时可回滚。
 *
 * 环境变量：
 *   TURSO_DATABASE_URL   libsql://xxx.turso.io（设置则用 Turso）
 *   TURSO_AUTH_TOKEN     数据库 token
 *   TURSO_REPLICA        可选，本地副本路径（如 file:../data/db/turso-replica.db）
 *                        设置后走「嵌入式副本」：读本地、启动时同步一次
 *   DATABASE_URL[ S ]    PostgreSQL（分片 / 单库），Turso 未设时生效
 *   LR_DB                SQLite 路径（默认 ../data/db/lr-song.sqlite3）
 *   PORT                 端口（默认 8787）
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { createPgCompat } from './pg-compat.js';
import { createShardRouter, maskDsn, parseShardDsns, SHARD_ORDER } from './pg-shard.js';
import { createTursoCompat, maskTursoUrl } from './turso-compat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(process.env.LR_DB || join(__dirname, '..', '..', 'data', 'db', 'lr-song.sqlite3'));
const PORT = parseInt(process.env.PORT || '8787', 10);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_URLS = process.env.DATABASE_URLS || '';
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const TURSO_REPLICA = process.env.TURSO_REPLICA || '';

// 数据源优先级：Turso > DATABASE_URLS（4 分片 PG）> DATABASE_URL（单库 PG）> SQLite
const USE_TURSO = !!TURSO_DATABASE_URL;
const USE_SHARD = !USE_TURSO && !!DATABASE_URLS;
const USE_PG = !USE_TURSO && !USE_SHARD && !!DATABASE_URL;
const shardDsn = USE_SHARD ? parseShardDsns(DATABASE_URLS) : null;
const router = USE_SHARD ? createShardRouter(shardDsn) : null;

const turso = USE_TURSO
  ? createTursoCompat({
      // 有 TURSO_REPLICA 时：url=本地文件，syncUrl=远端 → 嵌入式副本模式
      url: TURSO_REPLICA || TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN,
      syncUrl: TURSO_REPLICA ? TURSO_DATABASE_URL : undefined,
      syncInterval: 0,
    })
  : null;

const db = USE_TURSO
  ? turso
  : USE_SHARD
    ? router.primary
    : USE_PG
      ? createPgCompat(DATABASE_URL)
      : new Database(DB_PATH, { readonly: true });
const SOURCE_LABEL = USE_TURSO
  ? TURSO_REPLICA
    ? 'Turso·副本'
    : 'Turso'
  : USE_SHARD
    ? 'PostgreSQL×4'
    : USE_PG
      ? 'PostgreSQL'
      : 'SQLite';
const SOURCE_DESC = USE_TURSO
  ? `${maskTursoUrl(TURSO_DATABASE_URL)}${TURSO_REPLICA ? ` (replica ${TURSO_REPLICA})` : ''}`
  : USE_SHARD
    ? SHARD_ORDER.map((s) => `${s}=${maskDsn(shardDsn[s])}`).join(' ')
    : USE_PG
      ? maskDsn(DATABASE_URL)
      : DB_PATH;

// 嵌入式副本：服务开始接收请求前先同步一次（首次会拉全量，之后仅增量）
if (USE_TURSO && TURSO_REPLICA) {
  const t0 = Date.now();
  await turso.sync();
  console.log(`[turso] 副本已同步 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

/**
 * 分片表查询入口：按当事人朝代路由。
 * 复制表（persons/poems/aliases/...）在所有分片一致，直接用 `db`。
 * SQLite / 单库 PG 模式下 dbFor 恒返回同一个 db。
 */
const dbFor = (dynastyId) => (USE_SHARD ? router.forDynasty(dynastyId) : db);

const ok = (data, extra = {}) => ({ ok: true, data, ...extra });
const err = (message, status = 400) => ({ ok: false, error: message, _status: status });

const parseJsonArr = (v) => {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

/**
 * 批量取数：把一组查询合并成尽可能少的往返。
 * ------------------------------------------------------------
 * Turso 网关每次往返固定 ~335ms，人物详情页有 25 条串行查询 → 实测 32.7s。
 * 当所有查询落在同一个 db 且该 db 支持 batchAll（Turso）时合并为 **1 次往返**；
 * 其它后端（本地 SQLite / PG 分片）逐条执行，行为与延迟均不变。
 *
 * specs: [{ key, db, sql, args?, one? }]  one=true 表示只取首行（原 .get()）
 */
async function runQueries(specs) {
  const handles = new Set(specs.map((s) => s.db));
  const only = [...handles][0];
  const canBatch = handles.size === 1 && typeof only.batchAll === 'function';

  const out = {};
  if (canBatch) {
    const rows = await only.batchAll(specs.map((s) => ({ sql: s.sql, args: s.args || [] })));
    specs.forEach((s, i) => {
      out[s.key] = s.one ? rows[i][0] : rows[i];
    });
    return out;
  }
  for (const s of specs) {
    const st = s.db.prepare(s.sql);
    out[s.key] = s.one ? await st.get(...(s.args || [])) : await st.all(...(s.args || []));
  }
  return out;
}

/**
 * 响应缓存（仅 Turso 远端模式启用）。
 * ------------------------------------------------------------
 * 实测：Turso 网关每次往返固定 ~335ms（与 SQL 复杂度无关），
 * 一个端点常含 1–6 条查询 → 2.4s 级延迟。而本项目数据集是**静态史料**，
 * 同一 URL 的响应不随时间变化，因此按 URL 缓存是最划算的优化：
 * 首次慢，之后 0ms。
 *
 * 本地 SQLite 模式下不启用（本来就是 ms 级，缓存无收益且会拖慢迭代）。
 */
const CACHE_TTL_MS = parseInt(process.env.LR_CACHE_TTL_MS || '3600000', 10); // 默认 1h
// 容量上限：/api/persons/:id 理论上有 66 万种 URL，不封顶会让内存无限增长。
// Map 保持插入顺序 → 超限时删最早插入的键（FIFO 淘汰，够用且无额外依赖）。
const CACHE_MAX = parseInt(process.env.LR_CACHE_MAX || '5000', 10);
const cache = new Map(); // key -> { at, payload }
// 并发合并：同一 URL 的冷请求若同时到达（如热门人物被多人点开），
// 只真正查一次库，其余等待同一个 Promise。否则 N 个并发各付 2.8s。
const inflight = new Map(); // key -> Promise<payload>

function cacheKey(pathname, searchParams) {
  const sp = new URLSearchParams(searchParams);
  sp.sort();
  return `${pathname}?${sp.toString()}`;
}

async function handleCached(pathname, searchParams) {
  if (!USE_TURSO) return handle(pathname, searchParams);
  const key = cacheKey(pathname, searchParams);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.payload;
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const payload = await handle(pathname, searchParams);
    // 只缓存成功响应（error 不缓存，避免把瞬时故障固化）
    if (payload && payload.ok) {
      if (cache.size >= CACHE_MAX) {
        // 先清过期项，仍超限再淘汰最旧的键
        for (const [k, v] of cache) {
          if (Date.now() - v.at >= CACHE_TTL_MS) cache.delete(k);
        }
        while (cache.size >= CACHE_MAX) {
          cache.delete(cache.keys().next().value);
        }
      }
      cache.set(key, { at: Date.now(), payload });
    }
    return payload;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}


/**
 * 启动预热：把前端首屏/各层页面必打的端点先算好。
 * 远端每次往返固定 ~335ms，不预热的话用户第一次进朝代页要吃 2–3s。
 * 放在 listen 之后**后台并发**执行（不阻塞启动），并发 4 避免打爆免费额度。
 */
const PREWARM_BASE = ['/api/stats', '/api/dynasties', '/api/territory-coverage', '/api/region-stats'];

async function prewarm() {
  const ids = [];
  try {
    const rows = await db.prepare('SELECT id FROM dynasty_meta ORDER BY id').all();
    for (const r of rows) ids.push(r.id);
  } catch {
    /* dynasty_meta 不可用时只预热基础端点 */
  }
  const urls = [...PREWARM_BASE];
  for (const id of ids) {
    const q = `dynasty=${encodeURIComponent(id)}`;
    urls.push(
      `/api/dynasty-profile?${q}`,
      `/api/persons?${q}&limit=24`,
      `/api/dynasty-poems?${q}`,
      `/api/nianhao?${q}`,
      `/api/emperors?${q}`,
    );
  }

  const t0 = Date.now();
  let done = 0;
  let failed = 0;
  const CONCURRENCY = 6;

  async function drain(list) {
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        const url = list[cursor++];
        const [path, qs] = url.split('?');
        try {
          await handleCached(path, new URLSearchParams(qs || ''));
        } catch {
          failed++;
        }
        done++;
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  await drain(urls);
  const tList = Date.now();
  console.log(`预热完成 L2   ${done} 个端点（失败 ${failed}）· ${((tList - t0) / 1000).toFixed(1)}s`);

  // 第二轮：L2 代表人物格子点进去的 L3 人物详情（每条 25 语句，冷启约 2s，预热后 1ms）
  const personUrls = [];
  for (const id of ids) {
    const q = `dynasty=${encodeURIComponent(id)}`;
    const payload = await handleCached('/api/persons', new URLSearchParams(`${q}&limit=24`));
    for (const p of payload?.data || []) {
      if (p?.id) personUrls.push(`/api/persons/${encodeURIComponent(p.id)}`);
    }
  }
  await drain(personUrls);
  console.log(
    `预热完成 L3   ${personUrls.length} 位人物 · 累计 ${done} 个端点（失败 ${failed}）· ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
}

async function handle(pathname, searchParams) {
  const p = pathname;

  if (p === '/' || p === '') {
    return ok({ name: '长河 API (local)', source: SOURCE_LABEL, db: SOURCE_DESC });
  }

  if (p === '/api/persons') {
    const q = searchParams.get('q');
    const polity = searchParams.get('polity');
    const dynastyId = searchParams.get('dynasty');
    const minProm = parseInt(searchParams.get('min_prom') || '-1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where = [];
    const binds = [];
    if (q) { where.push('(name LIKE ? OR zi LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
    if (polity) { where.push('polity = ?'); binds.push(polity); }
    if (dynastyId) { where.push('dynasty_id = ?'); binds.push(dynastyId); }
    const female = searchParams.get('female');
    if (female === '1') { where.push('female = 1'); }
    if (minProm >= 0) { where.push('prominence >= ?'); binds.push(minProm); }
    const wsql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    // 排序（白名单，避免注入）
    // 排序（白名单，避免注入）；**必须含 id 作为平局裁决**，
    // 否则 SQLite 与 PG 对并列行返回顺序不同，前端分页会错乱。
    const ORDERS = {
      fame: 'COALESCE(fame_score,0) DESC, prominence DESC, birth ASC NULLS LAST, id ASC',
      birth: 'birth ASC NULLS LAST, COALESCE(fame_score,0) DESC, prominence DESC, id ASC',
      birth_desc: 'birth DESC NULLS FIRST, COALESCE(fame_score,0) DESC, prominence DESC, id ASC',
      name: 'name ASC, id ASC',
    };
    const orderSql = ORDERS[searchParams.get('sort') || 'fame'] || ORDERS.fame;

    const cnt = (await db.prepare(`SELECT COUNT(*) n FROM persons${wsql}`).get(...binds));
    const rows = (await db.prepare(
      `SELECT id,name,surname,birth,death,polity,dynasty_id,zi,role,prominence,fame_score,top_office,
              substr(summary,1,120) AS summary
       FROM persons${wsql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`
    ).all(...binds, limit, offset));

    return ok(rows, { total: cnt.n, limit, offset });
  }

  if (p === '/api/person-assocs') {
    // 社会关系（分页）：?person=<id>&offset=0&limit=100&rel=<关系名>
    const pid = searchParams.get('person');
    if (!pid) return err('需要 person 参数');
    // 分片：assocs 按当事人朝代切分，先查朝代再路由
    const pRow = (await db.prepare('SELECT dynasty_id FROM persons WHERE id = ?').get(pid)) || {};
    const adb = dbFor(pRow.dynasty_id);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const rel = searchParams.get('rel');
    const w = rel ? ' AND a.rel_name = ?' : '';
    const b = rel ? [pid, rel] : [pid];
    const cnt = (await adb.prepare(`SELECT COUNT(*) n FROM assocs a WHERE a.person_id = ?${w}`).get(...b)).n;
    const rows = (await adb.prepare(
      `SELECT a.rel_name, a.assoc_id AS id, p.name
       FROM assocs a JOIN persons p ON p.id = a.assoc_id
       WHERE a.person_id = ?${w}
       ORDER BY a.rel_name, p.name, a.assoc_id ASC
       LIMIT ? OFFSET ?`
    ).all(...b, limit, offset));
    // 关系类型分布
    const rels = (await adb.prepare(
      `SELECT rel_name, COUNT(*) n FROM assocs WHERE person_id = ? GROUP BY rel_name ORDER BY n DESC, rel_name ASC`
    ).all(pid));
    return ok(rows, { total: cnt, limit, offset, rels });
  }

  const mDetail = p.match(/^\/api\/persons\/(.+)$/);
  if (mDetail) {
    const id = decodeURIComponent(mDetail[1]);
    const person = (await db.prepare('SELECT * FROM persons WHERE id = ?').get(id));
    if (!person) return err('person not found', 404);
    // 分片：evid/kinships/offices/entries/works/assocs/office_addrs/poem_persons
    // 按当事人朝代切分；persons/poems/aliases 等复制表仍走 db
    const pdb = dbFor(person.dynasty_id);

    // 25 条查询合并为 1 次往返（Turso）／逐条执行（SQLite、PG 分片）
    const hasCbdb = person.cbdb_id != null;
    const specs = [
      { key: 'kinships', db: pdb, sql: `SELECT k.rel, k.b AS id, p.name FROM kinships k
         JOIN persons p ON p.id = k.b WHERE k.a = ? LIMIT 200`, args: [id] },
      { key: 'offices', db: pdb, sql: 'SELECT office, year, category FROM offices WHERE person_id = ? ORDER BY year NULLS FIRST, office ASC', args: [id] },
      { key: 'entries', db: pdb, sql: 'SELECT entry, year FROM entries WHERE person_id = ? ORDER BY year NULLS FIRST, entry ASC', args: [id] },
      { key: 'works', db: pdb, sql: 'SELECT title, category, role FROM works WHERE person_id = ?', args: [id] },
      { key: 'texts', db, sql: 'SELECT title, role, year FROM person_texts WHERE cbdb_id = ? LIMIT 100', args: [hasCbdb ? person.cbdb_id : -1] },
      { key: 'notes', db, sql: 'SELECT kind, note FROM person_notes WHERE person_id = ? LIMIT 20', args: [id] },
      { key: 'possessions', db, sql: 'SELECT desc, quantity, year FROM possessions WHERE person_id = ? LIMIT 20', args: [id] },
      { key: 'insts', db, sql: 'SELECT name, begin_year, end_year, source FROM institutions WHERE person_id = ? LIMIT 20', args: [id] },
      { key: 'assocs', db: pdb, sql: `SELECT a.rel_name, a.assoc_id AS id, p.name
         FROM assocs a JOIN persons p ON p.id = a.assoc_id
         WHERE a.person_id = ? LIMIT 200`, args: [id] },
      { key: 'assocCount', db: pdb, sql: 'SELECT COUNT(*) n FROM assocs WHERE person_id = ?', args: [id], one: true },
      { key: 'masters', db, sql: `SELECT l.rel, l.teacher AS id, p.name
         FROM lineage l JOIN persons p ON p.id = l.teacher
         WHERE l.student = ? LIMIT 100`, args: [id] },
      { key: 'disciples', db, sql: `SELECT l.rel, l.student AS id, p.name
         FROM lineage l JOIN persons p ON p.id = l.student
         WHERE l.teacher = ? LIMIT 200`, args: [id] },
      { key: 'merges', db, sql: `SELECT merged_from, substr(note,1,200) AS note, source
         FROM person_merge WHERE person_id = ? LIMIT 50`, args: [hasCbdb ? String(person.cbdb_id) : '\u0000'] },
      { key: 'officeAddrs', db: pdb, sql: 'SELECT DISTINCT addr FROM office_addrs WHERE person_id = ? ORDER BY addr ASC LIMIT 100', args: [id] },
      { key: 'evid', db: pdb, sql: 'SELECT claim_type, src_book, src_pages FROM evid WHERE person_id = ? LIMIT 400', args: [id] },
      { key: 'poems', db: pdb, sql: `SELECT p.id, p.title, p.genre, substr(p.content,1,120) AS excerpt, p.n_lines
         FROM poem_persons pp JOIN poems p ON p.id = pp.poem_id
         WHERE pp.person_id = ? ORDER BY p.n_lines DESC, p.id ASC LIMIT 200`, args: [id] },
      { key: 'nPoems', db: pdb, sql: 'SELECT COUNT(*) n FROM poem_persons WHERE person_id = ?', args: [id], one: true },
      { key: 'poemsByName', db, sql: `SELECT id, title, genre, substr(content,1,120) AS excerpt, n_lines
         FROM poems WHERE author = ? ORDER BY n_lines DESC, id ASC LIMIT 200`, args: [person.name] },
      { key: 'aliases', db, sql: 'SELECT alias, type_desc FROM aliases WHERE person_id = ? LIMIT 50', args: [id] },
      { key: 'occupations', db, sql: 'SELECT occupation FROM person_occupations WHERE person_id = ? LIMIT 20', args: [id] },
      { key: 'birthplaces', db, sql: 'SELECT place FROM person_birthplace WHERE person_id = ? LIMIT 10', args: [id] },
      { key: 'statuses', db, sql: 'SELECT status, fy, ly FROM person_status WHERE person_id = ? LIMIT 20', args: [hasCbdb ? String(person.cbdb_id) : id] },
      { key: 'network', db, sql: 'SELECT n_out, n_in, n_types FROM person_network WHERE person_id = ?', args: [id], one: true },
      { key: 'excerpts', db, sql: 'SELECT book, volume, excerpt FROM bio_excerpt WHERE person_id = ? LIMIT 5', args: [id] },
    ];
    const R = await runQueries(specs);
    const kinships = R.kinships;
    const offices = R.offices;
    const entries = R.entries;
    const works = R.works;
    const texts = R.texts;
    const notes = R.notes;
    const possessions = R.possessions;
    const insts = R.insts;
    const assocs = R.assocs;
    const assocCount = (R.assocCount && R.assocCount.n) || 0;
    const masters = R.masters;
    const disciples = R.disciples;
    const merges = hasCbdb ? R.merges : [];
    const officeAddrs = R.officeAddrs;
    const evid = R.evid;
    const poems = R.poems;
    const nPoems = (R.nPoems && R.nPoems.n) || 0;
    const poemsByName = R.poemsByName;
    const aliases = R.aliases;
    const occupations = R.occupations.map((r) => r.occupation);
    const birthplaces = R.birthplaces.map((r) => r.place);
    const statuses = R.statuses;
    const network = R.network || null;
    const excerpts = R.excerpts;

    return ok({
      ...person,
      hao: parseJsonArr(person.hao),
      shi: parseJsonArr(person.shi),
      addr: parseJsonArr(person.addr),
      sources: parseJsonArr(person.sources),
      kinships, offices, entries, works, texts, assocs, assocCount,
      masters, disciples, merges,
      officeAddrs: officeAddrs.map((r) => r.addr),
      evid,
      poems: poems.length ? poems : poemsByName,
      nPoems: poems.length ? nPoems : poemsByName.length,
      notes,
      possessions,
      institutions: insts,
      aliases,
      occupations,
      birthplaces,
      statuses,
      network,
      excerpts,
    });
  }

  if (p === '/api/person-lookup') {
    const names = (searchParams.get('names') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (!names.length) return ok({});
    const out = {};
    const byName = db.prepare('SELECT id, name FROM persons WHERE name = ? LIMIT 1');
    const byAlias = db.prepare(
      'SELECT p.id, p.name FROM aliases a JOIN persons p ON p.id = a.person_id WHERE a.alias = ? LIMIT 1'
    );
    for (const nm of names) {
      const r = (await byName.get(nm)) || (await byAlias.get(nm));
      if (r) out[nm] = { id: r.id, name: r.name };
    }
    return ok(out);
  }

  if (p === '/api/search') {
    const q = searchParams.get('q');
    if (!q) return err('需要 q 参数');
    const rows = (await db.prepare(
      `SELECT id,name,birth,death,polity,role,prominence,zi,
              substr(summary,1,80) AS zh
       FROM persons
       WHERE name LIKE ? OR zi LIKE ? OR summary LIKE ?
       ORDER BY COALESCE(fame_score,0) DESC, prominence DESC, birth ASC NULLS LAST, id ASC LIMIT 100`
    ).all(`%${q}%`, `%${q}%`, `%${q}%`));
    return ok(rows, { q });
  }

  if (p === '/api/poems') {
    const q = searchParams.get('q');
    const author = searchParams.get('author');
    const dynasty = searchParams.get('dynasty');
    const genre = searchParams.get('genre');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const w = [];
    const b = [];
    if (author) { w.push('author = ?'); b.push(author); }
    if (dynasty) { w.push('poem_dynasty = ?'); b.push(dynasty); }
    if (genre) { w.push('genre = ?'); b.push(genre); }
    if (q) { w.push('(title LIKE ? OR content LIKE ?)'); b.push(`%${q}%`, `%${q}%`); }
    const wsql = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const cnt = (await db.prepare(`SELECT COUNT(*) n FROM poems ${wsql}`).get(...b)).n;
    const rows = (await db.prepare(
      `SELECT id,title,author,dynasty,genre,n_lines,substr(content,1,200) AS excerpt
       FROM poems ${wsql} ORDER BY id LIMIT ? OFFSET ?`
    ).all(...b, limit, offset));
    return ok(rows, { total: cnt, limit, offset });
  }

  const mPoem = p.match(/^\/api\/poems\/(\d+)$/);
  if (mPoem) {
    const poem = (await db.prepare('SELECT * FROM poems WHERE id = ?').get(parseInt(mPoem[1], 10)));
    if (!poem) return err('poem not found', 404);
    // 同作者其他作品
    const siblings = (await db.prepare(
      `SELECT id,title,genre,n_lines FROM poems
       WHERE author = ? AND id <> ? ORDER BY n_lines ASC, id ASC LIMIT 20`
    ).all(poem.author, poem.id));
    // 作者在人物库的 id（用于跳转人物页）
    const person = (await db.prepare(
      `SELECT id, dynasty_id FROM persons WHERE name = ? ORDER BY prominence DESC, id ASC LIMIT 1`
    ).get(poem.author));
    return ok({ ...poem, siblings, person });
  }

  if (p === '/api/dynasty-poems') {
    const dynasty = searchParams.get('dynasty');
    if (!dynasty) return err('需要 dynasty 参数');
    const genres = (await db.prepare(
      `SELECT genre, COUNT(*) n FROM poems WHERE poem_dynasty = ? GROUP BY genre ORDER BY n DESC, genre ASC`
    ).all(dynasty));
    const authors = (await db.prepare(
      `SELECT author AS name, COUNT(*) n FROM poems
       WHERE poem_dynasty = ? AND author IS NOT NULL AND author <> ''
       GROUP BY author ORDER BY n DESC, author ASC LIMIT 12`
    ).all(dynasty));
    // 代表作：优先人工核验的名篇（famous=1），不足再补流行短篇
    let featured = (await db.prepare(
      `SELECT id, title, author, genre, n_lines, substr(content,1,120) AS excerpt
       FROM poems WHERE poem_dynasty = ? AND famous = 1 AND genre IN ('诗','词','曲')
       ORDER BY n_lines DESC, id ASC LIMIT 12`
    ).all(dynasty));
    if (featured.length < 12) {
      const more = (await db.prepare(
        `SELECT p.id, p.title, p.author, p.genre, p.n_lines, substr(p.content,1,120) AS excerpt
         FROM poems p
         WHERE p.poem_dynasty = ? AND p.famous = 0 AND p.genre IN ('诗','词','曲')
           AND p.n_lines BETWEEN 2 AND 8
           AND p.title NOT LIKE '%乐章%' AND p.title NOT LIKE '%歌辞%'
           AND p.title NOT LIKE '%郊庙%' AND p.title NOT LIKE '%鼓吹%'
         ORDER BY length(p.content) ASC, p.id ASC LIMIT ?`
      ).all(dynasty, 12 - featured.length));
      featured = featured.concat(more);
    }
    return ok({ genres, authors, featured });
  }

  if (p === '/api/poem-authors') {
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const rows = (await db.prepare(
      `SELECT name, dynasty, n_poems FROM poem_authors ORDER BY n_poems DESC, name ASC LIMIT ?`
    ).all(limit));
    return ok(rows);
  }

  if (p === '/api/polities') {
    const rows = (await db.prepare(
      `SELECT polity, COUNT(*) n, MIN(birth) min_birth, MAX(death) max_death
       FROM persons WHERE polity IS NOT NULL
       GROUP BY polity ORDER BY n DESC, polity ASC`
    ).all());
    return ok(rows);
  }

  if (p === '/api/bibliography') {
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const w = q ? 'WHERE title LIKE ?' : '';
    const b = q ? [`%${q}%`] : [];
    const cnt = (await db.prepare(`SELECT COUNT(*) n FROM bibliography ${w}`).get(...b)).n;
    const rows = (await db.prepare(
      `SELECT text_id, title, text_year FROM bibliography ${w} ORDER BY text_year NULLS FIRST, text_id ASC LIMIT ?`
    ).all(...b, limit));
    return ok(rows, { total: cnt, q });
  }

  if (p === '/api/evidence-sources') {
    const category = searchParams.get('category');
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const w = [];
    const b = [];
    if (category) { w.push('category = ?'); b.push(category); }
    if (q) { w.push('book LIKE ?'); b.push(`%${q}%`); }
    const wsql = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const cnt = (await db.prepare(`SELECT COUNT(*) n FROM evidence_sources ${wsql}`).get(...b)).n;
    const rows = (await db.prepare(
      `SELECT book, category, n_claims, n_persons, claim_types, in_texts
       FROM evidence_sources ${wsql} ORDER BY n_claims DESC, book ASC LIMIT ?`
    ).all(...b, limit));
    const cats = (await db.prepare(
      `SELECT category, COUNT(*) n, SUM(n_claims) claims FROM evidence_sources GROUP BY category ORDER BY n DESC, category ASC`
    ).all());
    return ok(rows, { total: cnt, categories: cats, category: category || 'all', q: q || '' });
  }

  if (p === '/api/book-editions') {
    const title = searchParams.get('title');
    const titles = searchParams.get('titles');
    if (titles) {
      const list = titles.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
      if (!list.length) return ok({});
      const ph = list.map(() => '?').join(',');
      const rows = (await db.prepare(
        `SELECT title, edition, pub_year, pub_loc, imprint, extant
         FROM book_editions WHERE title IN (${ph})`
      ).all(...list));
      const out = {};
      for (const r of rows) {
        (out[r.title] = out[r.title] || []).push(r);
      }
      return ok(out, { n: list.length });
    }
    if (!title) return err('需要 title 参数');
    const rows = (await db.prepare(
      `SELECT title, edition, pub_year, pub_loc, imprint, extant
       FROM book_editions WHERE title = ? LIMIT 20`
    ).all(title));
    return ok(rows, { title, n: rows.length });
  }

  if (p === '/api/person-geo') {
    const dynasty = searchParams.get('dynasty');
    const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10), 1000);
    // 按朝代聚合籍贯坐标（地名去重，计数）
    const rows = dynasty
      ? (await db.prepare(
          `SELECT g.addr AS name, g.lon, g.lat, COUNT(DISTINCT g.person_id) n
           FROM person_geo g JOIN persons p ON p.id = g.person_id
           WHERE p.dynasty_id = ? GROUP BY g.addr, g.lon, g.lat
           ORDER BY n DESC, g.addr ASC LIMIT ?`
        ).all(dynasty, limit))
      : (await db.prepare(
          `SELECT addr AS name, lon, lat, COUNT(DISTINCT person_id) n
           FROM person_geo GROUP BY addr, lon, lat
           ORDER BY n DESC, addr ASC LIMIT ?`
        ).all(limit));
    return ok(rows, { dynasty });
  }

  if (p === '/api/ref-dict') {
    const category = searchParams.get('category');
    const q = searchParams.get('q');
    const conds = [];
    const args = [];
    if (category) { conds.push('category = ?'); args.push(category); }
    if (q) { conds.push('(name LIKE ? OR name_en LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const rows = (await db.prepare(
      `SELECT category, name, name_en, note FROM ref_dict ${where} ORDER BY category, name, name_en, note, code LIMIT 500`
    ).all(...args));
    return ok(rows);
  }

  if (p === '/api/region-stats') {
    const q = searchParams.get('q');
    const rows = q
      ? (await db.prepare(
          `SELECT region, kaiyuan_hu, yuanhe_hu FROM region_stats
           WHERE region LIKE ? ORDER BY kaiyuan_hu DESC, region ASC LIMIT 200`
        ).all(`%${q}%`))
      : (await db.prepare(
          `SELECT region, kaiyuan_hu, yuanhe_hu FROM region_stats ORDER BY kaiyuan_hu DESC, region ASC LIMIT 200`
        ).all());
    return ok(rows);
  }

  if (p === '/api/stats') {
    const s = (await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM persons) AS persons,
         (SELECT COUNT(*) FROM kinships) AS kinships,
         (SELECT COUNT(*) FROM offices) AS offices,
         (SELECT COUNT(*) FROM entries) AS entries,
         (SELECT COUNT(*) FROM works) AS works,
         (SELECT COUNT(*) FROM poems) AS poems,
         (SELECT COUNT(DISTINCT author) FROM poems) AS poem_authors,
         (SELECT COUNT(*) FROM events) AS events,
         (SELECT COUNT(*) FROM aliases) AS aliases,
         (SELECT COUNT(*) FROM bibliography) AS bibliography,
         (SELECT COUNT(*) FROM lineage) AS lineage,
         (SELECT COUNT(*) FROM persons WHERE qid IS NOT NULL) AS with_qid,
         (SELECT COUNT(*) FROM persons WHERE female = 1) AS female,
         (SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL) AS with_summary,
         (SELECT COUNT(*) FROM persons WHERE prominence >= 5) AS prom5,
         (SELECT COUNT(*) FROM person_status) AS statuses,
         (SELECT COUNT(*) FROM person_texts) AS person_texts,
         (SELECT COUNT(*) FROM ref_dict) AS ref_terms,
         (SELECT COUNT(*) FROM evidence_sources) AS ev_sources,
         (SELECT COUNT(*) FROM region_stats) AS regions,
         (SELECT COUNT(*) FROM emperor) AS emperors,
         (SELECT COUNT(*) FROM book_editions) AS book_editions,
         (SELECT COUNT(*) FROM persons WHERE source='维基百科(CC BY-SA)') AS wiki_persons`
    ).get());
    // 分片：kinships/offices/entries/works 是分片表，需跨片求和。
    // 只覆盖已有键，不改变对象键顺序（否则 JSON 字节输出变化）。
    if (USE_SHARD) {
      const parts = await Promise.all(router.all.map((c) => c.prepare(
        `SELECT (SELECT COUNT(*) FROM kinships) AS kinships,
                (SELECT COUNT(*) FROM offices) AS offices,
                (SELECT COUNT(*) FROM entries) AS entries,
                (SELECT COUNT(*) FROM works) AS works`
      ).get()));
      for (const k of ['kinships', 'offices', 'entries', 'works']) {
        s[k] = parts.reduce((a, r) => a + Number(r[k] || 0), 0);
      }
    }
    return ok({ ...s, source: 'CBDB cbdb_20261003 + Wikidata + 维基百科 + CHGIS + 维基文库', backend: SOURCE_LABEL });
  }

  if (p === '/api/emperors') {
    const dynasty = searchParams.get('dynasty');
    const w = dynasty ? 'WHERE dynasty_id = ?' : '';
    const b = dynasty ? [dynasty] : [];
    const rows = (await db.prepare(
      `SELECT qid, title, native, dynasty_id, reign_start, reign_end
       FROM emperor ${w} ORDER BY COALESCE(reign_start, 9999) ASC, qid ASC`
    ).all(...b));
    return ok(rows, { dynasty: dynasty || 'all', n: rows.length });
  }

  if (p === '/api/nianhao') {
    const dynasty = searchParams.get('dynasty');
    const q = searchParams.get('q');
    const w = [];
    const b = [];
    if (dynasty) { w.push('dynasty_id = ?'); b.push(dynasty); }
    if (q) { w.push('name LIKE ?'); b.push(`%${q}%`); }
    const wsql = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const rows = (await db.prepare(
      `SELECT id, dynasty, dynasty_id, name, start, end
       FROM nianhao ${wsql} ORDER BY COALESCE(start, 9999) ASC, id ASC`
    ).all(...b));
    return ok(rows, { dynasty: dynasty || 'all', q: q || '', n: rows.length });
  }

  if (p === '/api/nianhao-lookup') {
    // 年号 + 年序 → 公元年：?dynasty=tang&name=贞观&year=1
    const name = searchParams.get('name');
    if (!name) return err('需要 name 参数');
    const year = parseInt(searchParams.get('year') || '1', 10);
    const dynasty = searchParams.get('dynasty');
    const w = dynasty ? 'AND dynasty_id = ?' : '';
    const b = dynasty ? [name, dynasty] : [name];
    const rows = (await db.prepare(
      `SELECT id, dynasty, dynasty_id, name, start, end
       FROM nianhao WHERE name = ? ${w} ORDER BY COALESCE(start, 9999) ASC, id ASC LIMIT 5`
    ).all(...b));
    if (!rows.length) return ok({ found: false, name, year });
    const r = rows[0];
    const ad = r.start != null ? r.start + (year - 1) : null;
    return ok({ found: true, ...r, year, ad_year: ad });
  }

  // ── 朝代档案（编辑层内容，原前端硬编码 .ts，现统一走 API）──
  if (p === '/api/dynasties') {
    const rows = (await db.prepare(
      `SELECT id, name, start, "end" AS end, note, color_var, ord
       FROM dynasty_meta ORDER BY ord`
    ).all());
    return ok(rows);
  }

  if (p === '/api/dynasty-profile') {
    const id = searchParams.get('dynasty');
    if (!id) return err('需要 dynasty 参数');
    const meta = (await db.prepare(
      `SELECT id, name, start, "end" AS end, note, color_var FROM dynasty_meta WHERE id = ?`
    ).get(id));
    if (!meta) return err('dynasty not found', 404);

    const prof = (await db.prepare(
      `SELECT overview, keywords, sources, completeness FROM dynasty_profile WHERE dynasty_id = ?`
    ).get(id)) || {};

    const figures = (await db.prepare(
      `SELECT kind, item_name, name, person_id FROM dynasty_figure WHERE dynasty_id = ?`
    ).all(id));
    const figOf = (kind, item) =>
      figures.filter((f) => f.kind === kind && f.item_name === item)
             .map((f) => ({ name: f.name, ...(f.person_id ? { personId: f.person_id } : {}) }));

    const institutions = (await db.prepare(
      `SELECT name, category, year, end_year AS "endYear", desc, background, impact, source
       FROM dynasty_institution WHERE dynasty_id = ? ORDER BY ord`
    ).all(id)).map((x) => ({ ...x, figures: figOf('institution', x.name) }));

    const events = (await db.prepare(
      `SELECT name, category, year, desc, background, outcome, impact, source
       FROM dynasty_event WHERE dynasty_id = ? ORDER BY ord`
    ).all(id)).map((x) => ({ ...x, figures: figOf('event', x.name) }));

    const culture = (await db.prepare(
      `SELECT name, category, year, desc, background, impact, works, source
       FROM dynasty_culture WHERE dynasty_id = ? ORDER BY ord`
    ).all(id)).map((x) => ({
      ...x,
      works: x.works ? JSON.parse(x.works) : undefined,
      figures: figOf('culture', x.name),
    }));

    const t = (await db.prepare(`SELECT * FROM dynasty_territory WHERE dynasty_id = ?`).get(id));
    const territory = t ? {
      capital: t.capital, extent: t.extent, note: t.note,
      bounds: t.bounds ? JSON.parse(t.bounds) : undefined,
      divisions: t.divisions ? JSON.parse(t.divisions) : undefined,
      neighbors: t.neighbors ? JSON.parse(t.neighbors) : undefined,
      area: t.area, population: t.population, source: t.source,
    } : undefined;

    return ok({
      id: meta.id, name: meta.name, start: meta.start, end: meta.end,
      note: meta.note, colorVar: meta.color_var,
      overview: prof.overview,
      keywords: prof.keywords ? JSON.parse(prof.keywords) : [],
      sources: prof.sources ? JSON.parse(prof.sources) : undefined,
      completeness: prof.completeness || 'draft',
      institutions, events, culture, territory,
    });
  }

  if (p === '/api/territory-coverage') {
    const rows = (await db.prepare(
      `SELECT dynasty_id AS "dynastyId", provinces, note FROM territory_coverage`
    ).all()).map((r) => ({ ...r, provinces: JSON.parse(r.provinces || '[]') }));
    const obj = {};
    for (const r of rows) obj[r.dynastyId] = { provinces: r.provinces, note: r.note };
    return ok(obj);
  }

  return err('not found', 404);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let result;
  try {
    result = await handleCached(url.pathname, url.searchParams);
  } catch (e) {
    result = err(String(e && e.message ? e.message : e), 500);
  }
  const status = result._status || 200;
  delete result._status;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(result));
});

server.listen(PORT, () => {
  console.log(`长河本地后端  http://localhost:${PORT}`);
  console.log(`数据源        ${SOURCE_LABEL} · ${SOURCE_DESC}`);
  if (USE_TURSO) {
    console.log(`缓存          ${CACHE_TTL_MS / 1000}s TTL · 后台预热中…`);
    // 不 await：先让服务可用，缓存边跑边填
    prewarm().catch((e) => console.warn('[预热失败]', e && e.message));
  }
});
