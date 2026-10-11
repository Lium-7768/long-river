# 数据备份与重建

> **本地 SQLite 是唯一数据源。** 已弃用 D1 接入方式。

## 主库

| 文件 | 大小 | 进 git | 说明 |
|---|---|---|---|
| `lr-song.sqlite3` | ~844 MB | ❌ | **主数据库**（本地唯一数据源）|
| `lr-song.sql.gz.part-aa` | ~90 MB | ✅ | 备份分卷 1（SQL 压缩）|
| `lr-song.sql.gz.part-ab` | ~40 MB | ✅ | 备份分卷 2 |

`.sqlite3` 不进 git（体积大）。备份 **分卷**（每卷 <100MB，绕开 GitHub 单文件上限）。

## 主库内容（85 表）

### 加工表（7）— 前端/后端直接用
| 表 | 行数 | 说明 |
|---|---|---|
| `persons` | 64.7 万 | 人物（CBDB + Wikidata + 正史补全）|
| `kinships` | 54.4 万 | 亲属关系 |
| `offices` | 58.8 万 | 任官记录 |
| `entries` | 26.2 万 | 科举/入仕 |
| `works` | 4.9 万 | 著作 |
| `assocs` | 18.5 万 | 社会关系（师友/荐举/赠诗文…498 种）|
| `texts` | 3933 卷 | 公版史书全文（24 部正史）|

### 字段覆盖（persons 64.7 万）
字 14% · 号 2% · 谥 0% · 籍贯 61% · 事迹 4% · 身份 5% · 最高官职 45% ·
生年 8% · 卒年 10% · **史料出处 98%**。

**数据来源可溯源**：每人均带 `sources` 字段（WikiData / 縉紳錄 / 進士題名錄 /
墓誌匯編 / 通志 / 府志 / 宋人傳記資料索引 等）。

### CBDB 原始表（78）— `cbdb_` 前缀
CBDB 全库零丢失并入，可随时补新字段。
关键表：`cbdb_BIOG_MAIN`(66万)、`cbdb_KIN_DATA`(56万)、`cbdb_POSTED_TO_OFFICE_DATA`(59万)、
`cbdb_ASSOC_DATA`(19万,社会关系)、`cbdb_STATUS_DATA`(7.4万,身份)、`cbdb_BIOG_ADDR_DATA`(46万,籍贯)。

## 恢复本地 SQLite

```bash
cat data/lr-song.sql.gz.part-* | gunzip -c | sqlite3 data/lr-song.sqlite3
```

## 备份主库（自动分卷）

```bash
bash etl/backup_db.sh                 # → data/lr-song.sql.gz.part-aa / -ab
```

## 从 CBDB 源库重建（完整流水线）

```bash
# 1. CBDB 源库（560MB，需自备，不入 git）
#    → etl/data/cbdb_20261003.sqlite3

# 2. 从 CBDB 构建加工表（persons/kinships/offices/entries/works）
python3 etl/build_from_cbdb.py
python3 etl/build_sqlite_full.py

# 3. 并入 CBDB 全部 78 原始表（cbdb_ 前缀）
python3 etl/import_cbdb_tables.py etl/data/cbdb_20261003.sqlite3 data/lr-song.sqlite3

# 4. Wikidata 扩充
python3 etl/fetch_wikidata.py
python3 etl/merge_wikidata.py data/lr-song.sqlite3 etl/build/wikidata_persons.jsonl

# 5. 公版史书全文入库（需先下载到 /tmp，见下表来源）
python3 etl/import_texts.py data/lr-song.sqlite3

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
