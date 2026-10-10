# CBDB 接入说明（真实表映射与数据来源）

> 本文档由 `etl/inspect_schema.py` 的输出整理，取代原「按记忆写出」的映射表。
> 核对版本：**CBDB `cbdb_20261003.sqlite3`**（2026-10-03 发布）
> SHA-256：`a2a87e08d3de727cd059d96cea6a95783fd17f58754cbdbfc8165fd8dd29e101`

## 1. 来源与许可

| 项 | 值 |
|---|---|
| 官方仓库 | https://github.com/cbdb-project/cbdb_sqlite |
| 下载源 | HuggingFace dataset `cbdb/cbdb-sqlite` |
| 版本元数据 | `etl/data/latest.json`（含文件名 / SHA-256 / 直链） |
| 获取方式 | `bash etl/fetch.sh`（自动校验 sqlite 本体 SHA-256） |
| 许可 | CBDB Data Licensing Terms（同 HuggingFace dataset 声明） |

**拉取与校验是可复现的**：`fetch.sh` 读 `latest.json` → 下载 zip → 解压 → 比对 `sha256`。脚本不硬编码版本号。

## 2. 版本核对结论

原先 `doc/data-model.md` 的映射表**大部分正确**，但有以下偏差：

| 文档原写 | 实际 | 说明 |
|---|---|---|
| `ALTNAME_DATA` 关联 `c_alt_name_code` | 实际列名 `c_alt_name_type_code` | 关联 `ALTNAME_CODES.c_name_type_code` |
| `KIN_DATA` → `Kinship` | ✅ 正确 | 关联 `KINSHIP_CODES.c_kincode`→`c_kinrel_chn` |
| `POSTED_TO_OFFICE_DATA` → `Appointment` | ✅ 正确 | 关联 `OFFICE_CODES.c_office_id` |
| `BIOG_TEXT_DATA` → `Work` | ✅ 正确 | **是著作关系表**（53,355 行），非普通文本 |
| `BIOG_ADDR_DATA` | **原文漏列** | 实为籍贯/游历主表（462,077 行），关键 |
| `DYNASTIES` | **原文漏列** | 政权 code 字典，筛选宋段的依据 |
| `STATUS_DATA` | 原文未提 | 身份/出身（73,619 行） |
| 表名"需核对" | **已核对** | 见 `etl/inspect_schema.py` 输出 |

## 3. 本项目实际读取的表与字段

`etl/build_from_cbdb.py` 读取以下表（字段以真实 dump 为准）：

| CBDB 表 | 行数 | 关键字段 | → 本项目 |
|---|---|---|---|
| `BIOG_MAIN` | 662,411 | `c_personid, c_name_chn, c_surname_chn, c_mingzi_chn, c_birthyear, c_deathyear, c_dy, c_choronym_code, c_female` | `Person` 基础 |
| `ALTNAME_DATA` | 208,959 | `c_personid, c_alt_name_chn, c_alt_name_type_code` | `Person.zi/hao/shi` |
| `ALTNAME_CODES` | 21 | `c_name_type_code, c_name_type_desc_chn` | 字号类型字典（字/諡號/室名別號…） |
| `KIN_DATA` | 563,217 | `c_personid, c_kin_id, c_kin_code` | `Kinship` |
| `KINSHIP_CODES` | 488 | `c_kincode, c_kinrel_chn` | 亲属称谓 |
| `POSTED_TO_OFFICE_DATA` | 591,874 | `c_personid, c_office_id, c_firstyear, c_lastyear` | `Appointment` |
| `OFFICE_CODES` | 34,271 | `c_office_id, c_office_chn` | `Office` |
| `ENTRY_DATA` | 265,155 | `c_personid, c_entry_code, c_year` | `Person.entryPath/entryYear` |
| `ENTRY_CODES` | 273 | `c_entry_code, c_entry_desc_chn` | 入仕途径字典 |
| `BIOG_ADDR_DATA` | 462,077 | `c_personid, c_addr_id, c_addr_type, c_firstyear, c_lastyear` | `Place` 关系 |
| `ADDR_CODES` | 30,160 | `c_addr_id, c_name_chn, x_coord, y_coord` | `Place` |
| `BIOG_ADDR_CODES` | 22 | `c_addr_type, c_addr_desc_chn` | 地址类型字典 |
| `CHORONYM_CODES` | 173 | `c_choronym_code, c_choronym_chn` | `Clan.seat` 郡望 |
| `BIOG_TEXT_DATA` | 53,355 | `c_textid, c_personid, c_role_id, c_year` | `Work` 关系 |
| `ASSOC_DATA` | 190,070 | `c_personid, c_assoc_id, c_assoc_code` | `PersonRelation`（下阶段） |
| `DYNASTIES` | 85 | `c_dy, c_dynasty_chn, c_start, c_end` | 政权筛选 |

## 4. 政权 code（宋段）

| c_dy | 中文 | 起 | 迄 | 本项目 polity |
|---|---|---|---|---|
| 15 | 宋 | 960 | 1279 | 宋 |
| 16 | 辽 | 947 | 1125 | 辽 |
| 17 | 金 | 1115 | 1234 | 金 |
| 7 | 五代 | 907 | 960 | 五代 |
| 8 | 後蜀 | 933 | 965 | 后蜀 |
| 10 | 南唐 | 937 | 975 | 南唐 |
| 11 | 吳越 | 907 | 978 | 吴越 |
| 12 | 閩國 | 909 | 945 | 闽 |
| 13 | 南漢 | 917 | 971 | 南汉 |

## 5. 覆盖面与分层（`etl/build/stats.json`）

**筛选政权 (7,8,10,11,12,13,15,16,17) → 86,474 人**

| 指标 | 数量 |
|---|---|
| 人物总数 | 86,474 |
| 宋 (c_dy=15) | 83,373 |
| 有生卒年 | 5,233 |
| 有官职 | 31,807 |
| 有亲属 | 37,755 |
| 有字号 | 17,577 |
| 有入仕记录 | 40,535 |
| 有著作 | 3,917 |
| 亲属边 | 92,301 |
| 官职 | 3,468 种 |
| 地名 | 2,230 个 |

### prominence 分层（用于 UI 决定"谁上时间轴"，不丢数据）

计入维度：完整生卒 / 官职 / 亲属 / 著作 / 入仕 / 字号，各 1 分（满分 6）。

| 分 | 人数 | 累计(≥) |
|---|---|---|
| 6 | 1,316 | 1,316 |
| 5 | 3,721 | 5,037 |
| 4 | 5,180 | 10,217 |
| 3 | 10,460 | 20,677 |
| 2 | 17,870 | 38,547 |
| 1 | 43,292 | 81,839 |
| 0 | 4,635 | 86,474 |

**所有 86,474 人一律入库、可检索、可统计**；`prominence` 仅供视觉层决定呈现密度（对齐"不隐藏数据、改 UI"原则）。

## 6. 与现有原型数据的校核（`etl/build/audit_report.json`）

| 项 | 数 |
|---|---|
| 原型人物 | 2,943 |
| 唯一匹配 CBDB | 2,014 |
| 同名待定 | 746 |
| 未匹配 | 183 |
| **生年真实冲突**（排除 CBDB 未知） | 73 |
| **卒年真实冲突** | 133 |
| 字号不符 | 74 |
| CBDB 有、原型缺的高威望(≥6)人物 | 652 |

### 关于生卒年冲突的重要判断

抽查发现**同一人的生卒年常有三方异说**，例：

| 人物 | 本项目 | CBDB | 维基百科 |
|---|---|---|---|
| 沈括 | 1031–1095 | 1029–1093 | 1032–1096 |
| 王安礼 | 1035–1106 | 1035–1095 | 1035–1096 |
| 周邦彦 | 1056–1121 | 1058–1123 | 1056–1121 |

**结论：生卒年不是"唯一真理"，而是史料折算（年号↔公元）产生的多值问题。** 处理策略遵循[需求文档 §8.3「争议数据多值并列」](./requirements.md)：

- **不改写**现有值；
- CBDB 值作为 `refs: [{source: 'CBDB cbdb_20261003'}]` 并列存入；
- UI 呈现时标注异说，不给单一确定值。

## 7. 命令（可复现）

```bash
bash etl/fetch.sh                      # 下载 + 校验 CBDB
python3 etl/inspect_schema.py          # 核对表结构（本文档依据）
python3 etl/build_from_cbdb.py         # 生成 etl/build/*.jsonl
python3 etl/audit_against_prototype.py # 与 prototype/data.js 校核
```

## 8. 合并阶段（硬事实 + 散文）

`etl/merge_dataset.py` 产出 `merged_persons.jsonl`——可直接入库的完整人物库。

### 合并规则
| 字段 | 来源 | 说明 |
|---|---|---|
| 生卒年 | **CBDB** | 原型值与 CBDB 差 >1 年时，原型值作为 `refs` 并列（不覆盖） |
| 字号/号/谥 | **CBDB** | CBDB 缺时回退原型值 |
| 亲属/官职/入仕数 | **CBDB** | 记录在 `n_kin/n_office/n_entry` |
| 籍贯 | **CBDB** | `addr` 数组 |
| summary（散文） | **原型** | CBDB 无散文，仅有硬事实；原型有则挂上 |
| id | 原型优先 | CBDB 同名异人时仅首个占用原型 id，其余生成 `姓拼音-cbdbid` |

### 结果（`python3 etl/validate_merged.py`）

```
记录数: 86655
✓ 全部通过（id 唯一 / 枚举合法 / 时间合理 / 繁简一致）
有 summary: 2197   有字: 17686   有号谥: 3618
有官职: 31806      有亲属: 37754   带 refs: 86655
```

### 亲属关系表
`etl/build_kinship.py` 输出 `kinship_edges.jsonl`：132,925 条边（含反向），
把 CBDB 亲属关系映射到本项目 person id。苏轼→苏洵/苏迈/苏过 均正确解析。

### 清洗规则
- **女性消歧名**：CBDB `赵氏(赵炅女1)` → 显示名 `赵氏`，原值存 `raw_name`
- **生年>卒年**（CBDB 源录入错误，2 例）：标 `approx:true` + ref 注记，不静默丢弃
- **政权误标**（如唐人标五代、元人标宋，2 例）：生卒完全落在 830–1300 外者剔除，计入 `out_of_scope`
- **CBDB 繁体** → 简体（opencc t2s），保护专名 毕昇/赵孟頫/管道昇

## 9. 已接入：写入 prototype/data.js（数据层）

CBDB 合并集已写入原型数据层（**方案 A：全量入库 + prominence 分层**）。

### 产物
| 文件 | 说明 |
|---|---|
| `prototype/data-cbdb.js` | 自动生成（`etl/write_prototype_data.py`），86,486 条精简 person，15MB |
| `prototype/data.js` | 末尾 `mergeCBDB()` 在加载时把 `CBDB_PERSONS` 并入树 |
| `prototype/index.html` | 仅加一行 `<script src="data-cbdb.js">`（加载顺序，**非 UI 改动**） |

### 合并行为
- **已存在者**（2,014）：补 CBDB 硬事实（`source/prominence/nOffice/nKin/shi/addr`），**不覆盖**原有散文
- **新人物**：按年份/政权路由到 北宋 / 南宋 / 辽 / 金 / 西夏

### ★ 年份诚实路由
CBDB 86,472 人中 **77,625（90%）无生卒年**。不用默认值臆断归入南宋，
新建「**年份不详**」容器承载 **76,084 人**（对齐「不隐藏、不臆造」原则）。
仅有年份者才判朝：

| 去向 | 人数 |
|---|---|
| 北宋 | 4,665 |
| 南宋 | 2,576 |
| 辽 | 338 |
| 金 | 795 |
| 西夏 | 14 |
| 年份不详 | 76,084 |

### 验证
- `node` 加载两模块：**88,383 节点，id 唯一 88,383，0 重复**
- 浏览器实测（headless Chrome）：北宋 7,999 / 南宋 2,648 / 辽 352 / 金 808 / 西夏 25 / 年份不详 76,084 全部可见
- 苏轼/王安石/司马光 均带 CBDB `source`；司马光 52 条官职、35 条亲属
- `bash etl/run_all.sh` 从零重跑校验通过

### 后续（UI 阶段，本次未做）
`prominence`（0–6）字段已随数据带上，供 UI 决定时间轴呈现密度：
- ≥6：1,316 人｜≥5：5,037 人｜≥4：10,217 人
- 年份不详的 76K 人需要 UI 有合适的承载方式（当前挂在独立容器，未上时间轴）

## 10. 原始规划（已作废，保留备查）

~~尚未执行：写入 prototype/data.js~~
（已于本节 9 完成）

合并集已就绪，但**尚未灌入 `prototype/data.js`**——因为 A/B/C 呈现策略待定。
候选方案：
- **A** 全部 86,655 人入库，用 `prominence` 分层控制 UI 呈现密度（推荐）
- **B** 仅导入 `prominence>=4`（约 1.0 万人）
- **C** 仅用 CBDB 校核现有 2,943 人，不扩量

`merged_persons.jsonl` 支持任一方案：`merge_dataset.py --min-prom N` 可调阈值。
