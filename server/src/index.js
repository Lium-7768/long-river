/**
 * 长河 · 本地后端（Node + better-sqlite3）
 * ------------------------------------------------------------
 * 与 Cloudflare Worker (api/src/index.js) 路由/返回结构保持一致，
 * 数据源改为本地 SQLite (data/lr-song.sqlite3)。
 *
 * 目的：D1 免费层有「每日写入行数」限额，无法承载全史导入。
 *      本地 SQLite 不受限，作为开发/自用的数据源。
 *
 * 环境变量：
 *   LR_DB    SQLite 路径（默认 ../data/lr-song.sqlite3）
 *   PORT     端口（默认 8787）
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(process.env.LR_DB || join(__dirname, '..', '..', 'data', 'lr-song.sqlite3'));
const PORT = parseInt(process.env.PORT || '8787', 10);

const db = new Database(DB_PATH, { readonly: true });

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

function handle(pathname, searchParams) {
  const p = pathname;

  if (p === '/' || p === '') {
    return ok({ name: '长河 API (local)', source: 'SQLite', db: DB_PATH });
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
    if (minProm >= 0) { where.push('prominence >= ?'); binds.push(minProm); }
    const wsql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const cnt = db.prepare(`SELECT COUNT(*) n FROM persons${wsql}`).get(...binds);
    const rows = db.prepare(
      `SELECT id,name,surname,birth,death,polity,dynasty_id,zi,role,prominence,fame_score,
              substr(summary,1,120) AS summary
       FROM persons${wsql}
       ORDER BY COALESCE(fame_score,0) DESC, prominence DESC, birth ASC
       LIMIT ? OFFSET ?`
    ).all(...binds, limit, offset);

    return ok(rows, { total: cnt.n, limit, offset });
  }

  const mDetail = p.match(/^\/api\/persons\/(.+)$/);
  if (mDetail) {
    const id = decodeURIComponent(mDetail[1]);
    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(id);
    if (!person) return err('person not found', 404);

    const kinships = db.prepare(
      `SELECT k.rel, k.b AS id, p.name FROM kinships k
       JOIN persons p ON p.id = k.b WHERE k.a = ? LIMIT 200`
    ).all(id);
    const offices = db.prepare('SELECT office, year FROM offices WHERE person_id = ? ORDER BY year').all(id);
    const entries = db.prepare('SELECT entry, year FROM entries WHERE person_id = ? ORDER BY year').all(id);
    const works = db.prepare('SELECT title, category FROM works WHERE person_id = ?').all(id);

    return ok({
      ...person,
      hao: parseJsonArr(person.hao),
      shi: parseJsonArr(person.shi),
      addr: parseJsonArr(person.addr),
      kinships, offices, entries, works,
    });
  }

  if (p === '/api/search') {
    const q = searchParams.get('q');
    if (!q) return err('需要 q 参数');
    const rows = db.prepare(
      `SELECT id,name,birth,death,polity,role,prominence,zi,
              substr(summary,1,80) AS zh
       FROM persons
       WHERE name LIKE ? OR zi LIKE ? OR summary LIKE ?
       ORDER BY COALESCE(fame_score,0) DESC, prominence DESC, birth ASC LIMIT 100`
    ).all(`%${q}%`, `%${q}%`, `%${q}%`);
    return ok(rows, { q });
  }

  if (p === '/api/polities') {
    const rows = db.prepare(
      `SELECT polity, COUNT(*) n, MIN(birth) min_birth, MAX(death) max_death
       FROM persons WHERE polity IS NOT NULL
       GROUP BY polity ORDER BY n DESC`
    ).all();
    return ok(rows);
  }

  if (p === '/api/stats') {
    const s = db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM persons) AS persons,
         (SELECT COUNT(*) FROM kinships) AS kinships,
         (SELECT COUNT(*) FROM offices) AS offices,
         (SELECT COUNT(*) FROM entries) AS entries,
         (SELECT COUNT(*) FROM works) AS works,
         (SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL) AS with_summary,
         (SELECT COUNT(*) FROM persons WHERE prominence >= 5) AS prom5`
    ).get();
    return ok({ ...s, source: 'CBDB cbdb_20261003', backend: 'local-sqlite' });
  }

  return err('not found', 404);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let result;
  try {
    result = handle(url.pathname, url.searchParams);
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
  console.log(`数据源        ${DB_PATH}`);
});
