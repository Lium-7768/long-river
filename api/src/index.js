/**
 * 长河 (long-river) 数据 API — Cloudflare Workers + D1
 *
 * 前后分离：前端与三方均通过本 API 读取数据，不直接碰数据库。
 *
 * 路由：
 *   GET /                        → 服务信息
 *   GET /api/persons             → 人物列表（?q= 搜索, ?polity=, ?min_prom=, ?limit=, ?offset=）
 *   GET /api/persons/:id         → 单个人物（含亲属/官职/入仕/作品）
 *   GET /api/search?q=           → 全文搜索（姓名/字号/简介）
 *   GET /api/polities            → 政权列表 + 人数
 *   GET /api/stats               → 数据统计
 */

const JSONH = { 'content-type': 'application/json; charset=utf-8' };

function ok(data, extra) {
  return new Response(JSON.stringify({ ok: true, data, ...(extra || {}) }, null, 0), {
    headers: { ...JSONH, 'access-control-allow-origin': '*' },
  });
}
function err(msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...JSONH, 'access-control-allow-origin': '*' },
  });
}

function parseHao(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const DB = env.DB;

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }

    try {
      // ---- 服务信息 ----
      if (p === '/' || p === '') {
        return ok({
          name: 'long-river-api',
          source: 'CBDB cbdb_20261003',
          endpoints: [
            'GET /api/persons?q=&polity=&min_prom=&limit=&offset=',
            'GET /api/persons/:id',
            'GET /api/search?q=',
            'GET /api/polities',
            'GET /api/stats',
          ],
        });
      }

      // ---- 人物列表 ----
      if (p === '/api/persons') {
        const q = url.searchParams.get('q');
        const polity = url.searchParams.get('polity');
        const minProm = parseInt(url.searchParams.get('min_prom') || '-1', 10);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const where = [];
        const binds = [];
        if (q) { where.push('(name LIKE ? OR zi LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
        if (polity) { where.push('polity = ?'); binds.push(polity); }
        if (minProm >= 0) { where.push('prominence >= ?'); binds.push(minProm); }
        const wsql = where.length ? ' WHERE ' + where.join(' AND ') : '';

        const cnt = await DB.prepare(`SELECT COUNT(*) n FROM persons${wsql}`).bind(...binds).first();
        const rows = await DB.prepare(
          `SELECT id,name,surname,birth,death,polity,zi,role,prominence,
                  substr(summary,1,120) AS summary
           FROM persons${wsql}
           ORDER BY prominence DESC, birth ASC
           LIMIT ? OFFSET ?`
        ).bind(...binds, limit, offset).all();

        return ok(rows.results, { total: cnt.n, limit, offset });
      }

      // ---- 单个人物（详情） ----
      const mDetail = p.match(/^\/api\/persons\/(.+)$/);
      if (mDetail) {
        const id = decodeURIComponent(mDetail[1]);
        const person = await DB.prepare('SELECT * FROM persons WHERE id = ?').bind(id).first();
        if (!person) return err('person not found', 404);

        const [kin, off, ent, wk] = await Promise.all([
          DB.prepare(
            `SELECT k.rel, k.b AS id, p.name FROM kinships k
             JOIN persons p ON p.id = k.b WHERE k.a = ? LIMIT 200`
          ).bind(id).all(),
          DB.prepare('SELECT office, year FROM offices WHERE person_id = ? ORDER BY year').bind(id).all(),
          DB.prepare('SELECT entry, year FROM entries WHERE person_id = ? ORDER BY year').bind(id).all(),
          DB.prepare('SELECT title, category FROM works WHERE person_id = ?').bind(id).all(),
        ]);

        return ok({
          ...person,
          hao: parseHao(person.hao),
          shi: parseHao(person.shi),
          addr: parseHao(person.addr),
          kinships: kin.results,
          offices: off.results,
          entries: ent.results,
          works: wk.results,
        });
      }

      // ---- 搜索 ----
      if (p === '/api/search') {
        const q = url.searchParams.get('q');
        if (!q) return err('需要 q 参数');
        const rows = await DB.prepare(
          `SELECT id,name,birth,death,zh FROM (
             SELECT id,name,birth,death,polity,role,prominence,zi,
                    substr(summary,1,80) AS zh FROM persons
             WHERE name LIKE ?1 OR zi LIKE ?1 OR summary LIKE ?1
             ORDER BY prominence DESC, birth ASC LIMIT 100
           )`
        ).bind(`%${q}%`).all();
        return ok(rows.results, { q });
      }

      // ---- 政权列表 ----
      if (p === '/api/polities') {
        const rows = await DB.prepare(
          `SELECT polity, COUNT(*) n,
                  MIN(birth) min_birth, MAX(death) max_death
           FROM persons WHERE polity IS NOT NULL
           GROUP BY polity ORDER BY n DESC`
        ).all();
        return ok(rows.results);
      }

      // ---- 统计 ----
      if (p === '/api/stats') {
        const s = await DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM persons) AS persons,
             (SELECT COUNT(*) FROM kinships) AS kinships,
             (SELECT COUNT(*) FROM offices) AS offices,
             (SELECT COUNT(*) FROM entries) AS entries,
             (SELECT COUNT(*) FROM works) AS works,
             (SELECT COUNT(*) FROM persons WHERE summary IS NOT NULL) AS with_summary,
             (SELECT COUNT(*) FROM persons WHERE prominence >= 5) AS prom5`
        ).first();
        return ok({ ...s, source: 'CBDB cbdb_20261003' });
      }

      return err('not found', 404);
    } catch (e) {
      return err('server error: ' + (e && e.message), 500);
    }
  },
};
