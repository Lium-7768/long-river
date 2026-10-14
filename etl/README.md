# ETL 流水线

> 数据从 CBDB / Wikidata / 维基 / 正史全文 → `data/db/lr-song.sqlite3`（唯一数据源）。
> **顺序执行**：`bash etl/run_all.sh`（见该脚本注释）。

## 目录结构

| 路径 | 内容 |
|---|---|
| `etl/*.py` | **现行流水线脚本**（构建/抓取/校验）|
| `etl/archive/` | **一次性/历史脚本**（已执行完，保留供追溯）|
| `etl/migrate_pg/` | **SQLite → PostgreSQL 迁移**（schema/导入/校验/一键脚本）|
| `etl/backup_db.sh` | 备份分卷（输出到 `data/db/`，**不入 git**）|
| `data/db/` | 主库 + CBDB 原料库（`data/db/cbdb/`）|
| `data/build/` | ETL 中间产物（JSONL/JSON，不入库，可重生成）|
| `etl/fixes/` | 人工订正数据（JSON）|

## 关键脚本（按阶段）

### 建库
- `build_from_cbdb.py` — CBDB → persons/kinships/offices/entries/works
- `build_sqlite_full.py` — 组装完整 SQLite
- `import_cbdb_tables.py` — 并入 CBDB 78 原始表（`cbdb_` 前缀）

### 外部数据源
- `fetch_wikidata.py` / `merge_wikidata.py` — Wikidata 生卒/别名
- `build_wiki_persons.py` — 中文维基人物（CC BY-SA，CBDB 未收录者）
- `fetch_difangzhi.py` / `fetch_difangzhi2.py` — 宋元地方志（维基文库）
- `fetch_ctext_meta.py` / `fetch_ctext_titles.py` — ctext 古籍索引

### 帝王 / 年号 / 版本 / 别名
- `build_emperor.py` + `patch_emperor.py` — 帝王世系（Wikidata P39 + 正史补全）
- `build_nianhao.py` / `build_nianhao_map.py` — 年号表 + 朝代映射
- `build_book_editions.py` — 古籍版本（editions 标准化）
- `build_hist_alias.py` — 通称/异体 → 本名
- `link_figures.py` — 关键人物 personId 注入（可点击率 100%）

### 证据 / 可信度
- `build_evid.py` — 逐条数据证据（evid）
- `build_evidence_sources.py` — 史料来源总览
- `build_source_report.py` / `data_report.py` — 可信度报告

### 人物增强
- `build_person_status.py` / `build_person_texts.py` / `build_person_merge.py`
- `build_region_stats.py` / `build_ref_dict.py` / `build_bio_excerpt.py`

## 归档说明（`etl/archive/`）

以下脚本为**一次性/历史**使用，已完成使命，保留供追溯：
`audit_*.py`（审计）、`inspect_schema.py`、`validate_*.py`、
`fix_*.py`（早期结构修复）、`credibility_report.py`、`gap_report.py`、
`merge_shiji.py`、`integrate.py`、`fill_*.py`（早期补全）。

> 这些脚本可能依赖已变更的表结构，**不要**作为现行流水线运行。
