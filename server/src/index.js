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
    const female = searchParams.get('female');
    if (female === '1') { where.push('female = 1'); }
    if (minProm >= 0) { where.push('prominence >= ?'); binds.push(minProm); }
    const wsql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const cnt = db.prepare(`SELECT COUNT(*) n FROM persons${wsql}`).get(...binds);
    const rows = db.prepare(
      `SELECT id,name,surname,birth,death,polity,dynasty_id,zi,role,prominence,fame_score,top_office,
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
    const offices = db.prepare('SELECT office, year, category FROM offices WHERE person_id = ? ORDER BY year').all(id);
    const entries = db.prepare('SELECT entry, year FROM entries WHERE person_id = ? ORDER BY year').all(id);
    const works = db.prepare('SELECT title, category, role FROM works WHERE person_id = ?').all(id);
    const notes = db.prepare('SELECT kind, note FROM person_notes WHERE person_id = ? LIMIT 20').all(id);
    const possessions = db.prepare('SELECT desc, quantity, year FROM possessions WHERE person_id = ? LIMIT 20').all(id);
    const insts = db.prepare('SELECT name, begin_year, end_year, source FROM institutions WHERE person_id = ? LIMIT 20').all(id);
    const assocs = db.prepare(
      `SELECT a.rel_name, a.assoc_id AS id, p.name
       FROM assocs a JOIN persons p ON p.id = a.assoc_id
       WHERE a.person_id = ? LIMIT 200`
    ).all(id);
    const officeAddrs = db.prepare(
      `SELECT DISTINCT addr FROM office_addrs WHERE person_id = ? LIMIT 100`
    ).all(id);
    const evid = db.prepare(
      `SELECT claim_type, src_book, src_pages FROM evid WHERE person_id = ? LIMIT 400`
    ).all(id);
    // 优先用消歧后的 poem_persons；回退 author 名匹配
    const poems = db.prepare(
      `SELECT p.id, p.title, p.genre, substr(p.content,1,120) AS excerpt, p.n_lines
       FROM poem_persons pp JOIN poems p ON p.id = pp.poem_id
       WHERE pp.person_id = ? ORDER BY p.n_lines DESC LIMIT 200`
    ).all(id);
    const nPoems = db.prepare(
      `SELECT COUNT(*) n FROM poem_persons WHERE person_id = ?`
    ).get(id).n;
    const poemsByName = db.prepare(
      `SELECT id, title, genre, substr(content,1,120) AS excerpt, n_lines
       FROM poems WHERE author = ? ORDER BY n_lines DESC LIMIT 200`
    ).all(person.name);
    const aliases = db.prepare(
      `SELECT alias, type_desc FROM aliases WHERE person_id = ? LIMIT 50`
    ).all(id);
    const occupations = db.prepare(
      `SELECT occupation FROM person_occupations WHERE person_id = ? LIMIT 20`
    ).all(id).map((r) => r.occupation);
    const birthplaces = db.prepare(
      `SELECT place FROM person_birthplace WHERE person_id = ? LIMIT 10`
    ).all(id).map((r) => r.place);
    const statuses = db.prepare(
      `SELECT status, fy, ly FROM person_status WHERE person_id = ? LIMIT 20`
    ).all(person.cbdb_id != null ? String(person.cbdb_id) : id);
    const network = db.prepare(
      `SELECT n_out, n_in, n_types FROM person_network WHERE person_id = ?`
    ).get(id) || null;
    const excerpts = db.prepare(
      `SELECT book, volume, excerpt FROM bio_excerpt WHERE person_id = ? LIMIT 5`
    ).all(id);

    return ok({
      ...person,
      hao: parseJsonArr(person.hao),
      shi: parseJsonArr(person.shi),
      addr: parseJsonArr(person.addr),
      sources: parseJsonArr(person.sources),
      kinships, offices, entries, works, assocs,
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
    const cnt = db.prepare(`SELECT COUNT(*) n FROM poems ${wsql}`).get(...b).n;
    const rows = db.prepare(
      `SELECT id,title,author,dynasty,genre,n_lines,substr(content,1,200) AS excerpt
       FROM poems ${wsql} ORDER BY id LIMIT ? OFFSET ?`
    ).all(...b, limit, offset);
    return ok(rows, { total: cnt, limit, offset });
  }

  const mPoem = p.match(/^\/api\/poems\/(\d+)$/);
  if (mPoem) {
    const poem = db.prepare('SELECT * FROM poems WHERE id = ?').get(parseInt(mPoem[1], 10));
    if (!poem) return err('poem not found', 404);
    // 同作者其他作品
    const siblings = db.prepare(
      `SELECT id,title,genre,n_lines FROM poems
       WHERE author = ? AND id <> ? ORDER BY n_lines ASC LIMIT 20`
    ).all(poem.author, poem.id);
    // 作者在人物库的 id（用于跳转人物页）
    const person = db.prepare(
      `SELECT id, dynasty_id FROM persons WHERE name = ? ORDER BY prominence DESC LIMIT 1`
    ).get(poem.author);
    return ok({ ...poem, siblings, person });
  }

  if (p === '/api/dynasty-poems') {
    const dynasty = searchParams.get('dynasty');
    if (!dynasty) return err('需要 dynasty 参数');
    const genres = db.prepare(
      `SELECT genre, COUNT(*) n FROM poems WHERE poem_dynasty = ? GROUP BY genre ORDER BY n DESC`
    ).all(dynasty);
    const authors = db.prepare(
      `SELECT author AS name, COUNT(*) n FROM poems
       WHERE poem_dynasty = ? AND author IS NOT NULL AND author <> ''
       GROUP BY author ORDER BY n DESC LIMIT 12`
    ).all(dynasty);
    // 代表作：优先人工核验的名篇（famous=1），不足再补流行短篇
    let featured = db.prepare(
      `SELECT id, title, author, genre, n_lines, substr(content,1,120) AS excerpt
       FROM poems WHERE poem_dynasty = ? AND famous = 1 AND genre IN ('诗','词','曲')
       ORDER BY n_lines DESC LIMIT 12`
    ).all(dynasty);
    if (featured.length < 12) {
      const more = db.prepare(
        `SELECT p.id, p.title, p.author, p.genre, p.n_lines, substr(p.content,1,120) AS excerpt
         FROM poems p
         WHERE p.poem_dynasty = ? AND p.famous = 0 AND p.genre IN ('诗','词','曲')
           AND p.n_lines BETWEEN 2 AND 8
           AND p.title NOT LIKE '%乐章%' AND p.title NOT LIKE '%歌辞%'
           AND p.title NOT LIKE '%郊庙%' AND p.title NOT LIKE '%鼓吹%'
         ORDER BY length(p.content) ASC LIMIT ?`
      ).all(dynasty, 12 - featured.length);
      featured = featured.concat(more);
    }
    return ok({ genres, authors, featured });
  }

  if (p === '/api/poem-authors') {
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const rows = db.prepare(
      `SELECT name, dynasty, n_poems FROM poem_authors ORDER BY n_poems DESC LIMIT ?`
    ).all(limit);
    return ok(rows);
  }

  if (p === '/api/polities') {
    const rows = db.prepare(
      `SELECT polity, COUNT(*) n, MIN(birth) min_birth, MAX(death) max_death
       FROM persons WHERE polity IS NOT NULL
       GROUP BY polity ORDER BY n DESC`
    ).all();
    return ok(rows);
  }

  if (p === '/api/bibliography') {
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const w = q ? 'WHERE title LIKE ?' : '';
    const b = q ? [`%${q}%`] : [];
    const cnt = db.prepare(`SELECT COUNT(*) n FROM bibliography ${w}`).get(...b).n;
    const rows = db.prepare(
      `SELECT text_id, title, text_year FROM bibliography ${w} ORDER BY text_year LIMIT ?`
    ).all(...b, limit);
    return ok(rows, { total: cnt, q });
  }

  if (p === '/api/person-geo') {
    const dynasty = searchParams.get('dynasty');
    const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10), 1000);
    // 按朝代聚合籍贯坐标（地名去重，计数）
    const rows = dynasty
      ? db.prepare(
          `SELECT g.addr AS name, g.lon, g.lat, COUNT(DISTINCT g.person_id) n
           FROM person_geo g JOIN persons p ON p.id = g.person_id
           WHERE p.dynasty_id = ? GROUP BY g.addr ORDER BY n DESC LIMIT ?`
        ).all(dynasty, limit)
      : db.prepare(
          `SELECT addr AS name, lon, lat, COUNT(DISTINCT person_id) n
           FROM person_geo GROUP BY addr ORDER BY n DESC LIMIT ?`
        ).all(limit);
    return ok(rows, { dynasty });
  }

  if (p === '/api/stats') {
    const s = db.prepare(
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
         (SELECT COUNT(*) FROM persons WHERE prominence >= 5) AS prom5`
    ).get();
    return ok({ ...s, source: 'CBDB cbdb_20261003 + Wikidata + CHGIS + 维基文库', backend: 'local-sqlite' });
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
