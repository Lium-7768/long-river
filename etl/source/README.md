# 朝代档案源数据

朝代档案（编辑层内容：概述/制度/事件/文化/疆域）的**可复现输入**。
由早期前端硬编码 `web/content/*.ts` 转换而来，现作为 ETL 的独立数据源归档。

| 文件 | 内容 | 对应表 |
|---|---|---|
| `dynasties.json` | 朝代轴（22 朝：名/起止/色）| `dynasty_meta` |
| `profiles.json` | 22 朝档案（概述/制度/事件/文化/疆域）| `dynasty_profile` 等 6 表 |
| `coverage.json` | 疆域示意省份（5 朝）| `territory_coverage` |

**导入**：`python3 etl/build_archive.py`

> 来源：历史常识整理（模型初稿 + 人工审校），每条带 `source`（史料出处）。
> 前端已不再持有这些数据，只走 API（见 `web/lib/dynasty-data.ts`）。
