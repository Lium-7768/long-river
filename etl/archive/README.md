# 归档脚本

项目早期/一次性脚本，已完成使命，保留供追溯。**不要**作为现行流水线运行
（可能依赖已变更的表结构或废弃的 D1 后端）。

## 早期数据管道 / 审计
- `audit_against_prototype.py` / `audit_dynasties.py` — 早期审计
- `inspect_schema.py` — 结构核对（doc 版映射表来源）
- `validate_merged.py` / `validate_vs_texts.py` — 早期校验
- `credibility_report.py` / `gap_report.py` — 早期报告
- `merge_shiji.py` / `integrate.py` / `merge_dataset.py` — 原型合并
- `fix_dynasty_errors.py` / `fix_person_dates.py` / `fix_structure.py` / `fix_summaries.py` — 早期修复
- `fill_missing_persons.py` / `fill_person_extra.py` — 早期补全

## 已弃用：Cloudflare D1 相关（2026-10）
项目已改用本地 SQLite 为唯一数据源，以下 D1 脚本作废：
- `load_d1.py` / `load_d1_facts.py` — 导入 D1（REST API）
- `dump_db.sh` — 从 D1 导出
