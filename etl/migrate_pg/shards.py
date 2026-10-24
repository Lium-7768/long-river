#!/usr/bin/env python3
"""
按朝代 4 分片的配置与分类规则。

设计要点
--------
1. **persons 全量复制到每个分片** —— 所有 `JOIN persons p ON p.id = X`
   因此都是本地查询，跨片人名解析问题自动消失（不需要 person_index）。
2. **poems 按 poem_dynasty 分片** —— 匹配 /api/dynasty-poems 的查询方式；
   诗词相关端点做 fan-out 合并。
3. **大体积 person 事实表按作者朝代分片** —— evid/kinships/offices/...
   这些表只按 person_id 查询（已核实无反向查询），路由即可。
4. **poems 全量复制**（135MB）—— 这样 `poem_persons ⋈ poems` 在所有分片都是
   本地 JOIN，不需要派生表，也省掉诗词端点的 fan-out。
5. **texts 只放 rest 分片** —— 古籍全文 93MB，API 从不查询，没必要复制 4 份。
6. 其余小表全部复制。
"""

# 分片 → 哪些朝代归属该分片（dynasty_id）
SHARDS = {
    'qing':     ['qing'],
    'ming':     ['ming'],
    'tangsong': ['tang', 'song-w', 'song-e', 'song'],
    'rest':     None,   # None = 其余所有（含 NULL）
}

SHARD_NAMES = list(SHARDS.keys())

# 除 tangsong 外，其余分片用「NOT IN」表达式定义
PRIMARY_DYNASTIES = [d for v in SHARDS.values() if v for d in v]


def shard_of_dynasty(dynasty_id):
    """dynasty_id → 分片名（与 import 逻辑、路由逻辑保持一致）"""
    if dynasty_id is None:
        return 'rest'
    for name, ds in SHARDS.items():
        if ds and dynasty_id in ds:
            return name
    return 'rest'


# ---------------------------------------------------------------- 分片表
# 按「人物朝代」分片：过滤条件 = person_id IN (SELECT id FROM persons WHERE dynasty_id ...)
# 注意：aliases / person_geo 虽然也按 person_id 查询，但它们的端点（别名查找、
# 籍贯地图聚合）需要全局视角，fan-out 合并易错 → 改为全量复制（各 11/15 MB）。
SHARD_BY_PERSON = {
    'evid', 'offices', 'office_addrs', 'entries', 'assocs',
    'works', 'poem_persons',
}

# 按 `a` 列（人物 id）分片：kinships 只按 a 查询（已核实无 k.b 反向查询）
SHARD_BY_COLUMN = {
    'kinships': 'a',
}

# 自带 dynasty_id 列，直接按列分片
SHARD_BY_DYNASTY_COL = {
    'person_canonical': 'dynasty_id',
}

# 按诗词朝代分片（当前为空：poems 体积 135MB，改为全量复制，
# 这样 poem_persons ⋈ poems 在所有分片都是本地 JOIN，无需派生表）
SHARD_BY_POEM_DYNASTY = set()

# 只放某一个分片的表（大而无 API 访问的表）
# texts 是古籍全文（93MB），API 端点从未查询它，只为留档 → 只放 rest
SINGLE_SHARD = {
    'texts': 'rest',
}

# 派生表：不属于源库，导入时物化（当前无）
DERIVED = set()

# 其余全部复制到每个分片


def dynasty_filter_sql(shard_name, col='dynasty_id'):
    """返回 (where_sql, params) —— 用于 SQLite 侧筛选"""
    ds = SHARDS[shard_name]
    if ds is None:
        ph = ','.join('?' * len(PRIMARY_DYNASTIES))
        return f'({col} IS NULL OR {col} NOT IN ({ph}))', list(PRIMARY_DYNASTIES)
    ph = ','.join('?' * len(ds))
    return f'({col} IN ({ph}))', list(ds)
