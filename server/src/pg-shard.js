/**
 * PostgreSQL 按朝代分片路由
 * ------------------------------------------------------------
 * 4 个分片：qing / ming / tangsong / rest
 *
 * 分片策略（见 etl/migrate_pg/shards.py）：
 *   - 复制表：persons / poems / aliases / person_geo / texts(仅rest) / 全部小表
 *             → 任一分片都含完整数据，用 primary 查询即可
 *   - 分片表：evid / kinships / offices / office_addrs / entries / assocs
 *             / works / poem_persons / person_canonical
 *             → 按当事人朝代路由到对应分片
 *
 * 因为 persons 是复制表，`JOIN persons` 永远是本地查询，
 * 跨分片人名解析问题自然消失。
 */
import { createPgCompat } from './pg-compat.js';

export const SHARD_ORDER = ['qing', 'ming', 'tangsong', 'rest'];

const TANGSONG = new Set(['tang', 'song-w', 'song-e', 'song']);

/** 朝代 id → 分片名（必须与 etl/migrate_pg/shards.py 保持一致） */
export function shardOfDynasty(dynastyId) {
  if (!dynastyId) return 'rest';
  if (dynastyId === 'qing') return 'qing';
  if (dynastyId === 'ming') return 'ming';
  if (TANGSONG.has(dynastyId)) return 'tangsong';
  return 'rest';
}

/**
 * 解析 DATABASE_URLS：
 *   推荐 JSON：{"qing":"postgresql://...","ming":"...","tangsong":"...","rest":"..."}
 *   也支持逗号分隔 4 个 URL（顺序：qing,ming,tangsong,rest）
 */
export function parseShardDsns(spec) {
  const raw = (spec || '').trim();
  if (!raw) throw new Error('DATABASE_URLS 为空');
  if (raw.startsWith('{')) {
    const obj = JSON.parse(raw);
    for (const s of SHARD_ORDER) {
      if (!obj[s]) throw new Error(`DATABASE_URLS 缺少分片 ${s}`);
    }
    return obj;
  }
  const list = raw.split(',').map((x) => x.trim()).filter(Boolean);
  if (list.length !== SHARD_ORDER.length) {
    throw new Error(
      `DATABASE_URLS 需要 ${SHARD_ORDER.length} 个连接串（${SHARD_ORDER.join(',')}），实际 ${list.length} 个`);
  }
  const out = {};
  SHARD_ORDER.forEach((s, i) => { out[s] = list[i]; });
  return out;
}

/** 掩码连接串里的密码，便于打印 */
export function maskDsn(dsn) {
  return String(dsn).replace(/:[^:@/]+@/, ':***@');
}

export function createShardRouter(dsns) {
  const conns = {};
  for (const s of SHARD_ORDER) conns[s] = createPgCompat(dsns[s]);
  return {
    shards: conns,
    all: SHARD_ORDER.map((s) => conns[s]),
    /** 复制表统一走这里（各分片数据一致） */
    primary: conns.qing,
    /** 按朝代取分片 */
    forDynasty: (d) => conns[shardOfDynasty(d)],
    async close() {
      await Promise.all(Object.values(conns).map((c) => c.close()));
    },
  };
}
