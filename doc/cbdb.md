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
