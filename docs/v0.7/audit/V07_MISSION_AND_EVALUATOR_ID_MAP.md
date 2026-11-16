# V07-001 · 任务 / 评估器 / 知识点 ID 映射全表（只读审计）

**状态：** FACT 为主；第 7 节映射草案标 INFERENCE，**未落盘、未注册、未校验**。全部行号为 2026-11-15 实际源码行号。

## 1. `MissionDefinition` 全表（20 字段，`src/content/missions/types.ts:28-64`）

| # | 字段 | 类型 | 必填 | 行 |
|---|---|---|---|---|
| 1 | `id` | `string` | 必填 | 30 |
| 2 | `version` | `number` | 必填 | 31 |
| 3 | `title` | `string` | 必填 | 32 |
| 4 | `context` | `string` | 必填 | 34 |
| 5 | `goal` | `string` | 必填 | 36 |
| 6 | `ageScope` | `AgeBand` | 必填 | 37 |
| 7 | `expressionForms` | `ExpressionForm[]` | 必填 | 38 |
| 8 | `requiredCapabilities` | `string[]` | 必填 | 40 |
| 9 | `hintLadder` | `string[]` | 必填 | 42 |
| 10 | `successMessage` | `string` | 必填 | 43 |
| 11 | `evaluatorId` | `string` | 必填 | 45 |
| 12 | `reward` | `MissionReward` | 可选 | 46 |
| 13 | `learningGoal` | `string` | 必填 | 48 |
| 14 | `prerequisiteMissionIds` | `string[]` | 必填 | 50 |
| 15 | `schemaVersion` | `1 \| 2` | 可选（缺省 v1） | 55 |
| 16 | `knowledgePointIds` | `string[]` | 可选（v2 强制非空） | 57 |
| 17 | `reflectionPrompt` | `string` | 必填 | 58 |
| 18 | `accessibilityNote` | `string` | 必填 | 59 |
| 19 | `progressLanguage` | `string` | 必填 | 61 |
| 20 | `unavailableReason` | `string` | 必填 | 63 |

`AgeBand` = `"6-7"|"8-10"|"11-12"|"13-15"`（`src/plugins/learner/types.ts:8`）；`MissionReward` = `{kind:"title";title:string}`（`types.ts:23-26`）；`MissionSummary.status` 五态含派生 `locked`（`:71`）。

## 2. `ExpressionForm` 6 值与 `validateMissionDefinition()` 16 条规则

**6 值（FACT，`types.ts:11-21`）：** `"creation"` / `"exploration"` / `"problem-solving"` / `"experiment"` / `"life-simulation"` / `"communication"`；运行时常量 `EXPRESSION_FORMS` 同顺序。

**签名（`:87`）：** `validateMissionDefinition(value: unknown): {ok:true} | {ok:false; errors:string[]}` —— **不抛异常**，错误累积后一次返回；唯一提前 return 是 `:89`（非对象）。

| # | 规则 | 行 |
|---|---|---|
| 1 | 入参须非数组对象，否则提前返回「不是对象」 | 89 |
| 2 | 11 个必填字符串非空（`REQUIRED_STRING_FIELDS:81-84`） | 92-96 |
| 3 | `version` 正整数 | 97-99 |
| 4 | `id` 正则 `^mission\.[a-z0-9-]+\.v\d+$` | 100-102 |
| 5 | `evaluatorId` 正则 `^evaluator\.[a-z0-9-]+$` | 103-105 |
| 6 | `ageScope` ∈ 4 档 | 106 |
| 7 | `expressionForms` ≥1 且取值合法；**不查重、不限制数量、不要求覆盖 6 类** | 107-110 |
| 8 | `hintLadder` ≥1 且每项非空；**无 3 级强制、无上限** | 111-114 |
| 9 | `requiredCapabilities` 为字符串数组（空数组可通过） | 115-118 |
| 10 | `prerequisiteMissionIds` 为数组；**不查 ID 存在 / 环 / 自引用**（图解析另有 `missionGraph.ts`） | 119 |
| 11 | **`schemaVersion` 允许 `undefined|1|2`，`3` / `null` / `"2"` 全拒** | 122-125 |
| 12 | v2 `knowledgePointIds` 非空且每个 `isRegisteredKnowledgePoint()` 为真 | 126-131 |
| 13 | v1 显式携带 `knowledgePointIds` 时也须全部已注册（不允许静默忽略） | 132-139 |
| 14 | `reward` 形状 | 140-146 |
| 15 | `progressLanguage` 含 `{done}` | 147-149 |
| 16 | 汇总返回 | 150 |

`isRegisteredKnowledgePoint()` = `KNOWLEDGE_POINTS.some(kp => kp.id === id)`（`src/content/knowledge/registry.ts:320-322`），**精确匹配**。

## 3. 18 个任务全表（`src/content/missions/index.ts:13-18`）

全部 `schemaVersion: 2`、`version: 1`、`hintLadder` 3 级、有 `reflectionPrompt`、ID 形如 `mission.<slug>.v1`、引用字段统一 `evaluatorId`。

| # | 任务 ID | 定义位置 | expressionForms | ageScope | knowledgePointIds | 前置 |
|---|---|---|---|---|---|---|
| 1 | `mission.moat.v1` | castleWaterMissions.ts:15 | problem-solving, creation | 8-10 | `kp.water.flow.range`, `kp.system.continuous_path` | [] |
| 2 | `mission.well.v1` | :41 | problem-solving, creation, experiment | 8-10 | `kp.water.gravity.downhill`, `kp.engineering.design_loop` | [] |
| 3 | `mission.dungeon.v1` | :67 | exploration, problem-solving | 11-12 | `kp.water.barrier.redirect`, `kp.reasoning.cause_effect` | [] |
| 4 | `mission.water-flow.v1` | waterExtensionMissions.ts:12 | exploration, experiment | 6-7 | `kp.water.gravity.downhill`, `kp.water.surface.support` | [] |
| 5 | `mission.seven-steps.v1` | :38 | experiment, problem-solving | 6-7 | `kp.water.flow.range`, `kp.measurement.counting` | `water-flow.v1` |
| 6 | `mission.channel-dam.v1` | :64 | experiment, creation | 8-10 | `kp.water.channel.absorb`, `kp.experiment.control` | [] |
| 7 | `mission.garden-water.v1` | :90 | creation, exploration | 6-7 | `kp.water.surface.support`, `kp.engineering.planning` | [] |
| 8 | `mission.broken-pipe.v1` | :116 | problem-solving, exploration | 11-12 | `kp.system.continuous_path`, `kp.reasoning.diagnosis` | `seven-steps.v1` |
| 9 | `mission.reservoir.v1` | :142 | experiment, problem-solving | 11-12 | `kp.measurement.volume_units`, `kp.measurement.counting` | [] |
| 10 | `mission.count-bridge.v1` | crossAgeMissions.ts:12 | creation, problem-solving | 6-7 | `kp.measurement.counting` | [] |
| 11 | `mission.symmetric-gate.v1` | :38 | creation, exploration | 8-10 | `kp.geometry.axis_symmetry` | [] |
| 12 | `mission.measure-tower.v1` | :64 | problem-solving, creation | 8-10 | `kp.measurement.height`, `kp.engineering.design_loop` | [] |
| 13 | `mission.section-detective.v1` | :90 | exploration, problem-solving | 11-12 | `kp.spatial.section_view`, `kp.spatial.underground` | [] |
| 14 | `mission.material-budget.v1` | :116 | problem-solving, creation | 11-12 | `kp.arithmetic.partition`, `kp.engineering.planning` | `count-bridge.v1` |
| 15 | `mission.my-design-note.v1` | :142 | communication, creation | 13-15 | `kp.communication.explain_reason` | [] |
| 16 | `mission.electric-light-beacon.v1` | electricalMissions.ts:20 | exploration | 6-7 | `kp.system.continuous_path`, `kp.electric.circuit.closed` | [] |
| 17 | `mission.electric-switch-magic.v1` | :46 | creation, problem-solving | 8-10 | `kp.causality.switch_effect`, `kp.electric.switch.effect` | `electric-light-beacon.v1` |
| 18 | `mission.electric-power-pump.v1` | :72 | experiment | 11-12 | `kp.system.dependency`, `kp.electric.load.pump`, `kp.water.flow.range` | [] |

**形式分布（FACT）：** `creation` 10、`exploration` 7、`problem-solving` 11、`experiment` 6、**`life-simulation` 0**、**`communication` 1**；合计 35 条 = 各任务 form 条目总数，自洽。断言佐证 `extendedEvaluators.test.ts:213-216`、`v051-content-batch2.spec.ts:54-55`。

**4 条先决条件链（FACT）：**
1. `water-flow.v1 → seven-steps.v1`（waterExtensionMissions.ts:57）
2. `seven-steps.v1 → broken-pipe.v1`（:135）
3. `count-bridge.v1 → material-budget.v1`（crossAgeMissions.ts:135）
4. `electric-light-beacon.v1 → electric-switch-magic.v1`（electricalMissions.ts:65）

其余 14 个任务 `[]`。`resolveMissionGraph()`（`src/content/knowledge/missionGraph.ts:26-109`）做自引用 / 悬空 / 环检测 + Kahn 确定性拓扑排序；`locked` 为 `MissionRuntimePlugin.ts:189-198` 的纯派生视图态，不落持久化。

## 4. 24 个知识点 ID 全表（`src/content/knowledge/registry.ts:48-266`）

`#1–19` 为 V0.6 既有；`#20–24` 为 V0.6.1 只追加的 5 个（其中 `kp.electric.*` **3 个**）。

| # | ID | 行 | # | ID | 行 |
|---|---|---|---|---|---|
| 1 | `kp.water.flow.range` | 50 | 13 | `kp.measurement.volume_units` | 158 |
| 2 | `kp.system.continuous_path` | 59 | 14 | `kp.geometry.axis_symmetry` | 167 |
| 3 | `kp.water.gravity.downhill` | 68 | 15 | `kp.measurement.height` | 176 |
| 4 | `kp.engineering.design_loop` | 77 | 16 | `kp.spatial.section_view` | 185 |
| 5 | `kp.water.barrier.redirect` | 86 | 17 | `kp.spatial.underground` | 194 |
| 6 | `kp.reasoning.cause_effect` | 95 | 18 | `kp.arithmetic.partition` | 203 |
| 7 | `kp.water.surface.support` | 104 | 19 | `kp.communication.explain_reason` | 212 |
| 8 | `kp.measurement.counting` | 113 | 20 | `kp.electric.circuit.closed` | 222 |
| 9 | `kp.water.channel.absorb` | 122 | 21 | `kp.electric.switch.effect` | 231 |
| 10 | `kp.experiment.control` | 131 | 22 | `kp.electric.load.pump` | 240 |
| 11 | `kp.engineering.planning` | 140 | 23 | `kp.system.dependency` | 249 |
| 12 | `kp.reasoning.diagnosis` | 149 | 24 | `kp.causality.switch_effect` | 258 |

12 个 domain：`water` 5、`measurement` 3、`electric` 3、`system` 2、`engineering` 2、`reasoning` 2、`spatial` 2，`experiment` / `geometry` / `arithmetic` / `communication` / `causality` 各 1。全部 `status: "active"`。V0.7 **不新增、不改名、不删除**（`registry.test.ts:55` 冻结 24 个、`163-181` 冻结 19 个 V0.6 快照为超集）。

## 5. 18 个评估器 / 查询契约

**注册名（FACT）：** `evaluator.moat` / `.well` / `.dungeon` / `.water-flow` / `.seven-steps` / `.channel-dam` / `.garden-water` / `.broken-pipe` / `.reservoir` / `.count-bridge` / `.symmetric-gate` / `.measure-tower` / `.section-detective` / `.material-budget` / `.my-design-note` / `.electric-light-beacon` / `.electric-switch-magic` / `.electric-power-pump`。与 18 个任务 1:1，字段名 `evaluatorId`。

**`EvaluatorQuery` 7 通道（`src/plugins/mission/evaluators.ts:139-153`）：**

| 通道 | 类型 | 可选 |
|---|---|---|
| `water` | `WaterQuery` | 必填 |
| `everWet` | `ReadonlySet<string>` | 必填 |
| `measurementDone` | `boolean` | 必填 |
| `world` | `WorldReadQuery`（`blockAt()` / `all()`） | 可选 |
| `textEvidence` | `ReadonlyMap<string,string>` | 可选 |
| `sectionEnabled` | `boolean` | 可选 |
| `electrical` | `ElectricalQuery` | 可选 |

**`EvaluatorResult` 3 字段（`:155-163`）：** `progress: number`、`complete: boolean`、`evidence?: {observation: string}`。
`EvaluatorRegistry.register()` 重复注册抛 `Duplicate mission evaluator: ...`（`:212-217`）。纯函数禁串断言：`evaluators.test.ts:54`、`extendedEvaluators.test.ts:98`（正则 `/Math\.random|Date\.now|new Date\(|fetch\(|localStorage|window\./`）；**`electricalEvaluators.test.ts` 无源码禁串扫描**（V0.6.1 新增，仅文件头注释约束）—— 登记为 `V07-007` 需补契约测试的点。

`ElectricalQuery.getSwitchObservations()` 返回 `readonly SwitchObservation[]`（`position` / `state: "open"|"closed"` / `lampPowered` / `sequence`），上限 `MAX_SWITCH_OBSERVATIONS = 128`，超限淘汰最旧；`dispose()` 与 `refresh()` 清空（`src/plugins/electrical/ElectricalPlugin.ts:37-38,122,129-136,274-285`）。`WaterQuery` 4 个只读方法：`hasWater` / `getWaterCells` / `isPipeFlowing` / `isConverged`（`WaterPlugin.ts:41-48`）。

## 6. 6 个候选新任务 ID 碰撞检查（FACT）

`mission.story-map.v1` / `mission.find-the-pattern.v1` / `mission.why-no-water-here.v1` / `mission.switch-compare.v1` / `mission.choose-water-route.v1` / `mission.explain-my-choice.v1` —— 与现有 18 个 ID **零碰撞**，全库 0 命中，全部匹配 `id` 正则。均**尚未定案**，须由 `V07-006/008` 冻结。

## 7. 知识点映射草案（INFERENCE，不得当作已定 ID）

| 候选任务 | 建议引用的已注册 ID | registry 行 |
|---|---|---|
| `mission.story-map.v1` | `kp.system.dependency`, `kp.engineering.planning` | 249 / 140 |
| `mission.find-the-pattern.v1` | `kp.geometry.axis_symmetry`, `kp.reasoning.diagnosis` | 167 / 149 |
| `mission.why-no-water-here.v1` | `kp.reasoning.diagnosis`, `kp.system.continuous_path` | 149 / 59 |
| `mission.switch-compare.v1` | `kp.electric.switch.effect`, `kp.experiment.control` | 231 / 131 |
| `mission.choose-water-route.v1` | `kp.water.barrier.redirect`, `kp.water.channel.absorb` | 86 / 122 |
| `mission.explain-my-choice.v1` | `kp.communication.explain_reason`, `kp.reasoning.cause_effect` | 212 / 95 |

全部取自 24 个已注册 ID；若 `schemaVersion: 2` 落地，逐字取值才会通过 `types.ts:126-131`。**未注册、未落盘、未校验。**

## 8. v2 容量只读 spike 结论（摘要，详见报告 6 §3）

- **运行时校验：装得下 [FACT+INFERENCE]** —— `validateMissionDefinition()` 无 `Object.keys` 白名单、无未知字段拒绝；新增可选字段被静默忽略，不进 `errors`。6 个新任务只要满足第 2 节 16 条规则即可通过。
- **编译期：需扩展 interface 加可选字段 [INFERENCE]** —— 内容文件是 `readonly MissionDefinition[] = [{...}]` 对象字面量，多字段会触发 TS excess property check；这正是 ADR-0014 允许的「v2 可选字段」扩展，不升 `schemaVersion`、不造第三套格式。
- **知识点：不得编造** —— 新任务只能引用第 4 节 24 个 ID。
- 结论：**Q7-1「装得下」成立，G1 不因 spike 被 BLOCKED**；若实现期试图造 `schemaVersion: 3` 则立即 BLOCKED（`R-702`）。
