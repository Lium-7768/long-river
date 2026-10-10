# 修复记录

## missing_summaries.json
早期 `merge_dataset.py` 的 `load_prototype()` 正则过脆（无法处理嵌套字段），
导致约 730 篇原型散文未挂到库记录。已通过两步修复：

1. **解析器改为括号配对**（`_extract_balanced`）→ 2,945 篇全部解析到
2. **同名异人挂载策略**：生卒匹配 → 若 CBDB 无生卒则首个认领

结果：散文挂载数 2,014 → **2,473**（+459）。
剩余 289 篇因「同名多人 + 生卒皆无」无法判定归属，**保留在 prototype 资产中不臆断**。

`missing_summaries.json` 保留为一次性补丁（历史），今后由 ETL 直接产出正确结果。
