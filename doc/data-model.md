# 长河 · 数据模型

> 配套文档：[需求文档](./requirements.md)
> 下列 TypeScript 定义为设计意图表达，实际以 zod schema 为单一真源，类型由 `z.infer` 导出。

## 设计原则

1. **实体平权** —— 每个实体有独立 slug 与页面，彼此通过 slug 引用，不嵌套。
2. **关系单独成表** —— 亲属、任职、人物关系、师承、因果均为独立的边集合，不内嵌在实体里。
3. **反向边构建期自动补全** —— 只需单向书写，`A 父子 B` 自动生成 `B 子父 A`。
4. **政权作用域** —— 官职、机构按政权划分；家族、姓氏、地点跨政权。
5. **争议数据多值并列** —— 不强制单一确定值。
6. **实体自带出处** —— 凡可溯源的字段带 `Ref`，不给出处的信息不进正式目录。
7. **别名不散落** —— 别名字段（字、号、旧地名、年号）统一进构建期检索索引，不靠各页面自行处理。

---

## 核心实体

### Polity 政权

```ts
type Polity = {
  slug: string              // 'northern-song'
  name: string              // '北宋'
  fullName?: string         // '宋'
  startYear: number         // 960
  endYear: number           // 1127
  capitals: Array<{ place: string; from: number; to: number }>
  territory: string         // 疆域概述
  periods: Array<{ name: string; from: number; to: number }>
  themeColor: string
  summary: string

  // 河道拓扑（驱动 3D 渲染，构建期算出几何）
  river: {
    stream: 'main' | 'tributary'
    parent?: string         // 上游政权 slug，决定分叉点
    lateralOffset: number   // Z 轴偏移，并立政权错开
    width: number | Array<{ year: number; value: number }>  // 可绑疆域或人口，使河有粗细变化
    confluence?: string[]   // 汇流来源，如三国归晋
    rupture?: {             // 断折：靖康之变后主流南移
      year: number
      event: string         // event slug
      displacement: [number, number, number]
    }
  }
}
```

河段渲染长度按 `sqrt(endYear - startYear)` 压缩。

### Person 人物

```ts
type Person = {
  slug: string              // 'su-shi'
  name: string              // '苏轼'
  zi?: string               // '子瞻'
  hao?: string[]            // ['东坡居士']
  altNames?: string[]       // 谥号、封号、别称（进检索别名索引，见需求 §9.1）
  gender: '男' | '女' | '不详'  // 谱系布局与姻亲边推导依赖此字段
  disambig?: string         // 同名异人区分语，如「南宋初名将」，用于检索结果与互链提示
  birth?: YearValue
  death?: YearValue
  polity: string            // 主要活动政权
  clan?: string             // 家族 slug
  surname: string
  tags: string[]            // ['文学家', '书法家', '官员']
  entryPath?: '科举' | '门荫' | '荐举' | '军功' | '其他'
  entryYear?: number        // 登科年
  summary: string           // 一句话
  refs?: Ref[]              // 史料出处，见「引用与出处」
  // 生平长文存于 MDX body
}
```

### Clan 家族

```ts
type Clan = {
  slug: string              // 'meishan-su'
  surname: string           // '苏'
  seat?: string             // 郡望 '眉山'
  activeFrom: number
  activeTo: number
  prestige?: string[]       // 门第标签。唐用「五姓七望」，宋用「科举世家」
  branches?: Array<{ name: string; summary: string }>
  summary: string
}
```

**郡望是中古门阀的身份核心，不是可选装饰字段。** 家族归属（`Person.clan`）与亲属边（`Kinship`）分开存储：谱系树从 `Kinship` 计算，门阀兴衰从 `Clan` 时间跨度计算。

### Office 官职

```ts
type Office = {
  slug: string              // 'song-tongzhi-shumenxia-pingzhangshi'
  name: string              // '同中书门下平章事'
  polity: string            // 作用域
  institution?: string      // 机构 slug
  rank?: string             // 品阶
  duty: string              // 职掌
  nature?: '官' | '职' | '差遣'   // 宋代官制三分
  successorOf?: string[]    // 前朝对应官职，构成沿革链
  summary: string
}
```

**同名官职在不同政权是不同条目。** 尚书令在汉、唐、宋语义完全不同，以 `successorOf` 相连而非共用一条记录。

`nature` 字段是宋代官制特有的官 / 职 / 差遣分离。

### Work 作品

```ts
type Work = {
  slug: string
  title: string             // '念奴娇·赤壁怀古'
  type: 'poem' | 'ci' | 'prose' | 'book' | 'painting'
      | 'calligraphy' | 'engineering' | 'invention'
  author: string | string[] // person slug
  year?: YearValue
  place?: string            // place slug
  status: '存世' | '部分存世' | '已佚' | '辑佚' | '伪托'  // 存佚状况，不标则用户误以为可见原文
  fullText?: string         // 诗词全文
  excerpt?: string          // 长著作摘录
  background: string        // 创作背景
  relatedEvents?: string[]
  summary: string
  refs?: Ref[]
}
```

**`status` 是硬性字段。** 大量作品已佚失、仅存目录或疑为伪托，用户看到条目却找不到原文必须有解释。

诗词需竖排渲染，与散文类型走不同的展示组件。

### Event 事件

```ts
type Event = {
  slug: string              // 'jingkang-incident'
  name: string              // '靖康之变'
  startYear: number
  endYear?: number
  era?: string              // 年号 slug
  places?: string[]
  polities: string[]        // 涉及政权，可多个
  category: '政治' | '军事' | '制度' | '经济' | '文化' | '对外' | '灾异'
  level: '王朝级' | '朝廷级' | '地方级'
  participants?: Array<{ person: string; role: string }>
  cause: string             // 起因
  course: string            // 经过
  impact: string            // 影响
  relatedWorks?: string[]
  summary: string
}
```

`level` 用于时间轴分层渲染 —— 默认只显示王朝级，可逐层展开。约 300 条事件若不分级即不可读。

---

## 附加实体

### Era 年号

```ts
type Era = {
  slug: string              // 'yuanfeng'
  name: string              // '元丰'
  polity: string
  emperor: string           // person slug
  startYear: number
  endYear: number
  reason?: string           // 改元缘由
}
```

**全站刚需。** 史料全用年号纪年，「元丰三年（1080）」的双轨显示必须随处可用。年号 ↔ 公元换算是公共工具函数。

### Institution 机构

```ts
type Institution = {
  slug: string              // 'song-shumiyuan'
  name: string              // '枢密院'
  polity: string
  duty: string
  parent?: string
  evolution?: string        // 沿革
  summary: string
}
```

本质是把 `Office.institution` 升格为实体。成本很低，但使官职轴立刻可按机构导航。

### School 学派

```ts
type School = {
  slug: string              // 'luo-xue'
  name: string              // '洛学'
  polity: string
  founders: string[]        // person slug
  tenet: string             // 宗旨
  keyWorks?: string[]
  divergence?: string       // 与其他学派的分野
  summary: string
}
```

师承结构与亲属谱系**同构但语义不同** —— 均为有向图，一个是学术传承，一个是血缘。宋代理学的师承谱系（濂溪 → 二程 → 朱熹）是独立的历史线索，不能混入 `Kinship`。

### Place 地点

```ts
type Place = {
  slug: string              // 'bianjing'
  name: string              // '汴京'
  altNames?: string[]       // ['开封', '东京']
  modernName: string        // 今河南开封
  coords?: [number, number] // 经纬度，供地图模块
  type: '都城' | '州府' | '关隘' | '战场' | '其他'
  summary: string
}
```

### Reform 变法

```ts
type Reform = {
  slug: string              // 'xining-reform'
  name: string              // '熙宁变法'
  polity: string
  startYear: number
  endYear?: number
  initiators: string[]      // person slug
  opponents?: string[]
  measures: Array<{         // 具体措施
    name: string            // '青苗法'
    content: string
    outcome: string
  }>
  assessment: string        // 成效与争议
  summary: string
}
```

技术上可作为 `Event` 的子类型，但熙宁变法牵动的人物与官职关系网极密，独立成实体更合适。

### Treaty 盟约

```ts
type Treaty = {
  slug: string              // 'chanyuan-treaty'
  name: string              // '澶渊之盟'
  year: number
  parties: string[]         // polity slug
  tribute?: Array<{ from: string; to: string; item: string; amount: string }>
  border?: string           // 边界划定
  durationTo?: number       // 存续至
  impact: string
  summary: string
}
```

`durationTo` 与河道并流形态绑定 —— 盟约存续期对应支流平行段。

### Surname 姓氏

```ts
type Surname = {
  slug: string              // 'su'
  name: string              // '苏'
  origin: string            // 得姓源流
  seats?: string[]          // 主要郡望
  summary: string
}
```

与 `Clan` 一对多。独立浏览轴，不属于任何政权。

---

## 关系边

全部单独成表，构建期自动补全反向边与引用校验。

### Kinship 亲属

```ts
type Kinship = {
  from: string              // person slug
  to: string
  type: '父子' | '母子' | '兄弟' | '姐妹' | '夫妻' | '叔侄'
      | '祖孙' | '翁婿' | '外祖' | '从兄弟' | '其他'
  note?: string
}
```

含婚姻边，故谱系**实为 DAG 而非树**，布局需在 `d3-hierarchy` 基础上定制。

### Appointment 任职

```ts
type Appointment = {
  person: string
  office: string
  from?: YearValue
  to?: YearValue
  note?: string             // 贬谪、起复、兼领等
}
```

人物 × 官职 × 任期。由此生成三种视图：**人物仕途迁转图**（按官品分层的桑基图，最能体现一生起落）、**官职历任者列表**、**制度演变**。

### PersonRelation 人物关系

```ts
type PersonRelation = {
  from: string
  to: string
  type: '师生' | '同僚' | '政敌' | '挚友' | '姻亲' | '荐举' | '门人'
  period?: [number, number]
  note?: string
}
```

与 `Kinship` 分开 —— 血缘与社会关系是两种语义。

### Discipleship 师承

```ts
type Discipleship = {
  teacher: string
  student: string
  school?: string           // school slug
  note?: string
}
```

学术传承专用。虽与 `Kinship` 结构同构，语义完全不同，不可合表。

### Causality 因果

```ts
type Causality = {
  cause: string             // event slug
  effect: string
  strength?: 'direct' | 'indirect'
  note?: string
}
```

构建期做**无环检测**。生成事件链视图 —— 北宋主脉见[需求文档 §3.4](./requirements.md#34-因果链)。

---

## 数据类型

### Ref 引用与出处

**全站通用字段。** 任何实体都可带 `refs`，回答「这条信息哪来的」。

```ts
type Ref = {
  source: string            // 出处标识，如 '宋史' / 'CBDB v20240101' / '续资治通鉴长编'
  locator?: string          // 卷次、页码、表名行号等定位
  note?: string             // 异说、存疑说明
}
```

`source` 指向史籍名、数据库版本或本项目的原创标注。**必须从 schema 一开始就带** —— 事后补要动全部内容文件，而历史站不给出处可信度为零。详见[需求文档 §9.2](./requirements.md#92-数据模型漏洞)。

### 检索别名索引

非存储实体，**构建期派生**。从各实体的别名字段聚合为「归一化别名 → 实体 slug」的映射，供 minisearch 使用：

| 别名来源 | 示例 |
|---|---|
| `Person.altNames` / `zi` / `hao` | 「东坡」→ su-shi |
| `Place.altNames` | 「汴梁」「东京」→ bianjing |
| `Era.name` + 公元换算 | 「元丰三年」→ 对应年份及 era slug |
| 干支纪年 | 「辛未」→ 对应年份 |
| `Surname` / `Clan` | 姓与郡望 |

需公共换算函数处理年号 ↔ 公元 ↔ 干支，全站共用（见[需求文档 §7](./requirements.md#7-视觉与排版)、[§9.1](./requirements.md#91-结构性缺口)）。

### YearValue 带不确定性的年份

```ts
type YearValue =
  | number
  | { year: number; approx: true }        // 约
  | { from: number; to: number }          // 区间，生卒年不详时
  | { year: number; source: string }      // 带出处
```

史料中大量年份不确定，不能强制为确定数值。

### Series 时间序列

```ts
type Series = {
  slug: string              // 'song-jinshi-count'
  name: string              // '历科进士人数'
  unit: string
  polity: string
  points: Array<{
    year: number
    values: Array<{         // 多估算值并列
      value: number
      source: string        // 出处
      note?: string         // 异说说明
    }>
  }>
  summary: string
}
```

**争议数据多值并列是硬性要求。** 宋代人口峰值有 1 亿、1.2 亿等不同估算，结构上必须支持并列与标注出处，不给单一确定值。详见[需求文档 §8.3](./requirements.md#83-争议数据处理规则)。

首期序列：人口户口、科举取士数、财政收入结构、疆域面积。

---

## 内容存储

```
content/
  polities/song/northern-song.mdx
  persons/song/su-shi.mdx
  clans/meishan-su.mdx
  offices/song/tongzhi-shumenxia-pingzhangshi.mdx
  works/song/nian-nu-jiao-chi-bi-huai-gu.mdx
  events/song/jingkang-incident.mdx
  eras/song/yuanfeng.mdx
  institutions/song/shumiyuan.mdx
  schools/song/luo-xue.mdx
  places/bianjing.mdx
  reforms/song/xining-reform.mdx
  treaties/chanyuan-treaty.mdx
  surnames/su.mdx
  relations/
    kinship.json
    appointments.json
    person-relations.json
    discipleships.json
    causality.json
  series/
    song-population.json
    song-jinshi-count.json
  _draft/            # LLM 产物暂存，人工抽检后移入正式目录
```

MDX frontmatter 存结构化字段，body 存散文长文。关系边与时间序列用 JSON（量大且无散文）。

---

## CBDB 映射

> **已核对真实 dump** —— 表名与字段已对照 CBDB `cbdb_20261003.sqlite3` 验证。
> 完整映射、字段名、行数、政权 code 与覆盖率见 [`doc/cbdb.md`](./cbdb.md)；
> 核对脚本 `etl/inspect_schema.py`。原文「按记忆写出，需核对」的表已作废。

| CBDB 表 | 本项目目标 | 状态 |
|---|---|---|
| `BIOG_MAIN` | `Person` 基础字段、生卒年、`gender`（`c_female`） | ✅ 已验证 |
| `ALTNAME_DATA` | `Person.zi` / `hao` / `altNames`（关联 `c_alt_name_type_code`） | ✅ 已验证 |
| `CHORONYM_CODES` | 郡望 → `Clan.seat` | ✅ 已验证 |
| `KIN_DATA` + `KINSHIP_CODES` | `Kinship` | ✅ 已验证 |
| `POSTED_TO_OFFICE_DATA` | `Appointment`（关联 `c_office_id`） | ✅ 已验证 |
| `OFFICE_CODES` | `Office` | ✅ 已验证 |
| `ENTRY_DATA` + `ENTRY_CODES` | `Person.entryPath` / `entryYear` | ✅ 已验证 |
| `BIOG_TEXT_DATA` | `Work`（著作关系表，53,355 行） | ✅ 已验证 |
| `ASSOC_DATA` | `PersonRelation` / `Discipleship` | ✅ 已验证（下阶段接入） |
| `BIOG_ADDR_DATA` + `ADDR_CODES` | `Place`（**原文漏列，实为籍贯主表**） | ✅ 已验证 |
| `DYNASTIES` | 政权 code 字典（筛选宋段） | ✅ 已验证 |

### CBDB 覆盖不到的部分

需查史料原创，是本期最大的内容成本：

- `Institution` 机构沿革
- `School` 学派谱系
- `Reform` 变法细目
- `Treaty` 盟约条款
- `Series` 经济与人口数据
- 所有生平散文与事件叙述（由 LLM 生成后人工抽检）

### 已知数据缺口

辽、金、西夏在 CBDB 中覆盖很薄。三股并流是宋段河道的视觉核心，但这三支的人物数据会明显稀疏 —— 预案是以政权与事件为主，人物只收关键几位。
