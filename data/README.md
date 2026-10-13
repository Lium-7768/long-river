# 数据目录

> **本地 SQLite 是唯一数据源。** 已弃用 D1 接入方式。

## 结构

| 路径 | 内容 | 进 git |
|---|---|---|
| `db/lr-song.sqlite3` | **主数据库**（~1.6 GB，唯一数据源）| ❌ |
| `db/lr-song.sql.gz.part-*` | 备份分卷（~90 MB/卷）| ❌ |
| `db/cbdb/cbdb_20261003.sqlite3` | CBDB 原料库（560 MB）| ❌ |
| `build/` | ETL 中间产物（JSONL/JSON）| 仅 `data_report.md` |
| `README.md` | 本文件 | ✅ |

> **二进制不进 git**（见 `.gitignore`）。备份请走对象存储，或用 `etl/backup_db.sh`。
> 文档（报告/设计）统一在 [`../docs/`](../docs/)。

## 主库内容（136 表 = 自有 58 + CBDB 原始 78）

### 加工表（8）— 前端/后端直接用
| 表 | 行数 | 说明 |
|---|---|---|
| `persons` | **66.7 万** | 人物（CBDB + Wikidata + 正史补全）|
| `kinships` | 54.4 万 | 亲属关系（438 种，**100% 中文**）|
| `offices` | 58.8 万 | 任官记录（+ `category` 官制分类，98.7%）|
| `office_addrs` | 38.2 万 | **任官地点**（21.2 万人「在哪做官」）|
| `entries` | 26.2 万 | 科举/入仕 |
| `works` | 4.9 万 | 著作 |
| `assocs` | 18.5 万 | 社会关系（师友/荐举/赠诗文…498 种）|
| `events` | 116 | 历史事件（平蜀/方腊之乱/金人入寇…）|
| `event_persons` | 427 | 人物-事件参与 |
| `evid` | **336 万** | **逐条数据证据**（每条数据 → 史料书名 + 页码/卷号）|
| `texts` | 3933 卷 | 公版史书全文（**24 部正史**）|

### 朝代档案表（8）— 编辑层内容（前端 L2/L3 由 API 直取）
| 表 | 行数 | 说明 |
|---|---|---|
| `dynasty_meta` | 22 | 朝代轴（名/起止/色）|
| `dynasty_profile` | 22 | 朝代概述 + 关键词 + 出处 |
| `dynasty_institution` | 111 | 政治制度（含背景/影响/史料）|
| `dynasty_event` | 127 | 重大事件（含起因/结果/影响）|
| `dynasty_culture` | 116 | 文化成就（含代表作 `works`）|
| `dynasty_figure` | 603 | 条目 ↔ 人物关联（personId 指向 `persons`）|
| `dynasty_territory` | 22 | 疆域地理（都城/四至/区划/邻国）|
| `territory_coverage` | 5 | 疆域示意省份 |

> 源数据归档于 `etl/source/*.json`，由 `etl/build_archive.py` 导入。

### 证据与可信度（核心）

**每条数据都指向具体史料出处，可逐条核验** —— 详见 [`可信度报告.md`](reports/可信度报告.md)。

| 字段 | 证据覆盖率 |
|---|---:|
| 史料出处 | 100% |
| 最高官职 | 99% |
| 生年 / 卒年 | 98% |
| 号 / 谥 | 96% |
| 籍贯 | 91% |
| 字 | 90% |
| 号 / 谥 | 86% |
| 亲属关系 | 87% |
| 事迹 | 81% |
| 社会关系 | 94% |

### 字段覆盖（persons 64.7 万）
字 14% · 号 2% · 谥 0% · 籍贯 61% · 事迹 4% · 身份 5% · 最高官职 45% ·
生年 8% · 卒年 10% · **史料出处 98%**。

### 规范化与分类（全部 100% 中文）
- `kinships.rel` 438 种关系名（父/子/弟/兄/祖父/岳父…）—— 英文码/数字码已全部转换
- `offices.office` 11,183 种官职名 —— 数字码已转换
- `offices.category` 官制分类树（宋朝·中枢机构类 / 唐朝·府州郡县官类 / 清朝·地方机关…）

**数据来源可溯源**：每人均带 `sources` 字段（WikiData / 縉紳錄 / 進士題名錄 /
墓誌匯編 / 通志 / 府志 / 宋人傳記資料索引 等）。

### CBDB 原始表（78）— `cbdb_` 前缀
CBDB 全库零丢失并入，可随时补新字段。
关键表：`cbdb_BIOG_MAIN`(66万)、`cbdb_KIN_DATA`(56万)、`cbdb_POSTED_TO_OFFICE_DATA`(59万)、
`cbdb_POSTED_TO_ADDR_DATA`(46万,任官地点)、`cbdb_ASSOC_DATA`(19万,社会关系)、
`cbdb_STATUS_DATA`(7.4万,身份)、`cbdb_BIOG_ADDR_DATA`(46万,籍贯)。

## 恢复本地 SQLite

```bash
cat data/db/lr-song.sql.gz.part-* | gunzip -c | sqlite3 data/db/lr-song.sqlite3
```

## 备份主库（自动分卷）

```bash
bash etl/backup_db.sh                 # → data/db/lr-song.sql.gz.part-aa / -ab
```

## 从 CBDB 源库重建（完整流水线）

```bash
# 1. CBDB 源库（560MB，需自备，不入 git）
#    → data/db/cbdb/cbdb_20261003.sqlite3

# 2. 从 CBDB 构建加工表（persons/kinships/offices/entries/works）
python3 etl/build_from_cbdb.py
python3 etl/build_sqlite_full.py

# 3. 并入 CBDB 全部 78 原始表（cbdb_ 前缀）
python3 etl/import_cbdb_tables.py data/db/cbdb/cbdb_20261003.sqlite3 data/db/lr-song.sqlite3

# 4. Wikidata 扩充
python3 etl/fetch_wikidata.py
python3 etl/merge_wikidata.py data/db/lr-song.sqlite3 data/build/wikidata_persons.jsonl

# 5. 公版史书全文入库（需先下载到 /tmp，见下表来源）
python3 etl/import_texts.py data/db/lr-song.sqlite3

# 6. 结构修复（幂等）
python3 etl/fix_structure.py
```

## 原典全文来源（公版，可重新下载）
| 书 | 卷数 | 来源 |
|---|---|---|
| 史记 | 114 | github.com/the-quizzman/shiji |
| 资治通鉴 | 293 | github.com/the-quizzman/zizhitongjian |
| 汉书 / 后汉书 | 117 / 132 | the-quizzman/hanshu, houhanshu |
| 明史 / 清史稿 | 319 / 470 | zh.wikisource.org |
| 宋史 / 元史 / 辽史 / 金史 / 新五代史 | 466 / 204 / 109 / 133 / 74 | zh.wikisource.org |
| 春秋左氏传 | 12 | zh.wikisource.org |
