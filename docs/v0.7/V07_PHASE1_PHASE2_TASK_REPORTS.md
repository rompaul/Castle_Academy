# V0.7 Phase 1 / Phase 2 逐任务报告（`V07-005` ~ `V07-020`）

**记录日期：** 2026-11-15
**授权：** owner 于 `STOP GATE-1` 放行后明确选择「一直做到要你拍板才停」，因此本批任务在同一会话内按 ID 顺序连续执行；每个任务落地时都跑过对应窄测试，末尾统一跑全量回归。
**状态：** Phase 1（`V07-004~012`）与 Phase 2（`V07-013~020`）源码与单测均已完成；**Phase 2 的角色 B、截图对照、canonical、ABBA、build、E2E 仍 NOT RUN**。
**基线：** `tag v0.6.1` / `f0980b8d3174ca819a961738fe6dd14264290b09`（master `4f18102` 为 docs-only 登记提交，非基线）。

## 0. 全批共用事实（各任务报告的固定字段）

| 模板字段 | 实测值 |
|---|---|
| Approved baseline SHA | `f0980b8d3174ca819a961738fe6dd14264290b09`（`git rev-list -n1 v0.6.1`） |
| WorldSnapshot v1 diff | **0**；34 个 BlockId 零改动；atlas / 材质 / shader 零改动 |
| localStorage key | 仍为 **3** 个（世界存档、学习者档案、既有第三 key）；本批零新增 |
| schemaVersion | 仍只接受 `1 | 2`；六个新任务全部 `schemaVersion: 2`，**无 v3** |
| 知识点 / 任务 / 评估器 | 24 个知识点 ID 零改动；`ALL_MISSIONS` 仍 18 个、`createDefaultEvaluatorRegistry()` 仍 18 个（**接入留 `V07-021`**）；既有 18 任务 / 18 评估器 / `EvaluatorResult` 三字段零改动 |
| 新运行时记录 | `InteractionRecords`：三个通道各显式上限 128、`drop-oldest`、冻结快照、缓存复用、零落盘；读档 / 重置 / 档案切换 / `dispose()` 全清；反思文本单独存放，**不进 `snapshot()` / `baseQuery()` / 判定链** |
| 确定性证据链 | 评估器 → `EvaluatorResult{progress, complete, evidence.observation}` → `MasteryEvidenceRecord` 5 字段；只追加、不去重、不降级；自由文本与反思均不进链 |
| V0.5 基线 20 条 E2E | **逐字节零改动**（本批一条未碰） |
| 命令与退出码 | `npm run typecheck` exit 0；`npx vitest run --no-file-parallelism <窄集>` exit 0；`npm test -- --no-file-parallelism` **54 文件 / 404 用例** exit 0；`git diff --check` exit 0 |
| 视觉回归影响 | 新 UI 只在任务详情面板内追加 `children` 区块，既有 18 个任务不挂载；干净世界 3D / HUD 差异**未实测（NOT RUN）**，留 `V07-024`；无 `position: fixed`、无全屏模态、canvas 视口零改动 |
| 版本 / git | 零提交、零版本 / tag 变更；`package.json` 仍 `0.6.1` |
| 证据位置 | 本文、`docs/v0.7/V07-004_TASK_REPORT.md`、`docs/v0.7/audit/` 6 份 Phase 0 报告、`src/**` 对应 `.test.ts` |
| 已知风险 | `refresh()` 只重算不清空会话记录（与部分起草期文档「refresh 清空」措辞不一致，已在 `interactionRecords.test.ts` 固化，待 GATE-2 文档复核）；`V07_MISSIONS` / 新评估器尚未注册进产品入口，`V07-021` 前新任务在产品列表中仍休眠 |

## 1. Phase 1 逐任务

### V07-005 · 有界运行时记录与生命周期
- **Status:** PASS
- **Repository facts / files inspected:** `MissionRuntimePlugin.ts`、`evaluators.ts`、`WorldState`、`LearnerProfile`
- **Files changed:** `src/plugins/mission/interactionRecords.ts`（新）、`src/plugins/mission/MissionRuntimePlugin.ts`、`src/plugins/mission/interactionRecords.test.ts`（新）
- **Implementation summary:** 三个有界数组 + `reflections` Map + 冻结快照缓存；`addObservation` / `addVariablePair` / `addDecision` / `setReflection` / `getReflection` / `snapshot` / `clear`；`MissionRuntimePlugin` 唯一持有，`dispose()` / `onExternalChange` / `resetEvaluation()` 连 `textEvidence` 一起清空（修 `DEV-701`）；`refresh()` 只重算；重复 `activate()` 不重复订阅。
- **补修（本轮）:** `addDecision` 允许 `step === 0` 承载 Problem-solving 的「当前假设」，负数 / 非整数仍拒绝；测试新增 5 条断言。
- **Tests:** `interactionRecords.test.ts` 7 条；全绿。
- **Next eligible Task ID:** `V07-006`

### V07-006 · ID 与知识点映射冻结
- **Status:** PASS
- **Files changed:** `src/content/missions/v07MissionContracts.ts`（新）、`v07MissionContracts.test.ts`（新）
- **Implementation summary:** 冻结 6 个 `mission.<slug>.v1`、6 个 `evaluator.<slug>` 与知识点映射，全部取自已注册 24 ID；`find-the-pattern` 调整为水主题语义（`kp.water.flow.range` / `kp.reasoning.cause_effect`），未编造新 ID。
- **Tests:** 6 条（ID 正则、零碰撞、知识点注册、六形式、4 年龄档、冻结表 1:1）。
- **Next eligible Task ID:** `V07-007`

### V07-007 · 六个纯函数评估器
- **Status:** PASS
- **Files changed:** `src/plugins/mission/interactiveEvaluators.ts`（新）、`interactiveEvaluators.test.ts`（新）
- **Implementation summary:** `countObservations` / `countSwitchComparison` / `countDiagnosis` / `countRouteDecisions` / `countExplanation` / `countStoryMarkers`；Experiment 同时复用 V0.6.1 `getSwitchObservations()` 成对观察（Q-6 收口，零物理量）；诊断按 `sequence` 取最终假设，插入顺序置换结果一致。
- **Tests:** 9 条 + `DEV-703` 既有电力评估器禁串扫描（剥离注释后扫描，**不改 V0.6.1 源码、不放宽禁用规则**）。首次 exit 1 因注释红线词，改为只扫可执行代码后 22/22 PASS。
- **Next eligible Task ID:** `V07-008`

### V07-008 · 六个 schema v2 新任务
- **Status:** PASS
- **Files changed:** `src/content/missions/interactiveMissions.ts`（新）、`interactiveMissions.test.ts`（新）
- **Implementation summary:** 6 个 `MissionDefinition`，全部 `schemaVersion: 2` / `version: 1`，沿用既有 20 字段，3 级提示、4 年龄档、六类形式全覆盖；纯数据模块零副作用。儿童文案「扣分」改为「怎么改都没关系」。
- **Tests:** 7 条（含 `validateMissionDefinition()`、儿童禁用词、纯数据零副作用）。
- **Next eligible Task ID:** `V07-009`

### V07-009 · 有界性与溢出策略
- **Status:** PASS
- **Files changed:** `src/plugins/mission/interactionBoundaries.test.ts`（新）；`interactionRecords.ts` 常量 / 溢出实现
- **Implementation summary:** `OBSERVATION_LOG_LIMIT` / `VARIABLE_COMPARISON_LIMIT` / `DECISION_SEQUENCE_LIMIT` = 128，`INTERACTION_OVERFLOW_POLICY = "drop-oldest"`；溢出后完成态保持，插入顺序置换后六个评估器结果一致。
- **Tests:** 4 条。
- **Next eligible Task ID:** `V07-010`

### V07-010 · 3 级提示与年龄分档
- **Status:** PASS
- **Files changed:** `src/content/missions/v07LowAgeHints.ts`（新）、`v07LearningSupport.test.ts`（新）
- **Implementation summary:** `resolveV07HintLadder()` 只影响 `find-the-pattern` 与 `story-map` 的 `6-7` 档，沿用「同一任务内、非新任务 ID」的 V0.6.1 低龄子路径；不改 schema、不改原定义。
- **Tests:** 6 条（合并 `V07-011`）。
- **Next eligible Task ID:** `V07-011`

### V07-011 · 先决条件链
- **Status:** PASS
- **Files changed:** `src/content/missions/interactiveMissions.ts`（1 处）、`interactiveMissions.test.ts`、`v07LearningSupport.test.ts`
- **Implementation summary:** 只新增 1 条链 `choose-water-route ← find-the-pattern`；合并 24 任务图无环、无悬空、无自引用，5 条边、拓扑序成立；`resolveMissionGraph()` 零改动；V0.5 基线三任务始终无前置。
- **Next eligible Task ID:** `V07-012`

### V07-012 · 掌握证据写回链回归
- **Status:** PASS
- **Files changed:** `src/plugins/mission/v07MasteryEvidence.test.ts`（新）
- **Implementation summary:** `RecordingStore` 注入 `MissionRuntimePlugin`，用 `V07_MISSIONS` + `INTERACTIVE_EVALUATORS` 验证完成时按知识点追加 2 条 `MasteryEvidenceRecord`、5 字段不变、`observation = "3/3"`、自由文本不进链、六个任务与评估器 1:1。
- **Phase 1 全量回归:** `npm test -- --no-file-parallelism` **50 文件 / 386 用例** exit 0；typecheck 0；`git diff --check` 0。
- **Next eligible Task ID:** `V07-013`

## 2. Phase 2 逐任务

### V07-013 · Exploration 观察清单
- **Status:** PASS
- **Files changed:** `src/ui/mission/v07InteractionModel.ts`（新）、`src/ui/mission/V07FormInteractions.tsx`（新）、`v07InteractionModel.test.ts`（新）、`V07FormInteractions.test.ts`（新）
- **Implementation summary:** `ObservationChecklist` 受控 3 个观察点、去重、键盘可达（`type="button"` / `aria-pressed`）、空态文案；`recordedTargets()` 纯函数。
- **Next eligible Task ID:** `V07-014`

### V07-014 · Experiment 两态对照
- **Status:** PASS
- **Files changed:** 同上组件文件 + `src/rendering/GameCanvas.tsx`（`getElectricalQuery` 可选字段）、`src/ui/mission/MissionExperience.tsx`
- **Implementation summary:** `TwoStateComparison` 复用 `getSwitchObservations()` 同一位置成对观察，只用文字「合上 · 灯亮 / 断开 · 灯不亮」区分两态，不只靠颜色；零物理量。本轮补 `PairRow.position` 与「记下这组对照」按钮，把成对观察回写 `variableComparison` 通道，避免该通道在产品里悬空。
- **Tests:** `v07FormWiring.test.ts` 证明「行数据 → `submitVariablePair` → 评估器完成」链路。
- **Next eligible Task ID:** `V07-015`

### V07-015 · Problem-solving 假设切换
- **Status:** PASS（含本轮断链修复）
- **Files changed:** `interactionRecords.ts`、`V07FormInteractions.tsx`、`MissionExperience.tsx`、`v07FormWiring.test.ts`（新）、`interactionRecords.test.ts`
- **Implementation summary:** 初版只有 `onSubmitCheck`，评估器却按 `decisionSequence` 的 `step === 0` 取最终假设，且容器拒绝 `step < 1` → **该任务永远无法完成**。修复：容器放行第 0 步（负数 / 非整数仍拒绝）；`HypothesisSwitcher` 点猜想即 `onSelectHypothesis(id)` → `runtime.submitDecision(missionId, 0, id)`；「按这个猜想去查一次」仍提交 `check:<hypothesis>` 观察；改猜想覆盖不惩罚。诊断结果来自既有 `WaterQuery.isConverged()`，无自动评价。
- **Tests:** `v07FormWiring.test.ts` 4 条（改猜想 → 旧验证不完成 → 对应验证后完成）；`interactionRecords.test.ts` 新增第 0 步断言。
- **Next eligible Task ID:** `V07-016`

### V07-016 · Life simulation 情境决策
- **Status:** PASS
- **Files changed:** `V07FormInteractions.tsx`、`v07InteractionModel.ts`
- **Implementation summary:** `ScenarioDecisions` 3 步受控选择 + 回看列表；`decisionRows()` 按 `sequence` 取每步最终选择（修掉初版错误的 `__seq_` 键）；`choicesForStep()` 3 个受控选项；决策不写 `WorldState`、无真实工程结论。
- **Tests:** `v07FormWiring.test.ts` 3 步提交后完成；`v07InteractionModel.test.ts` 决策回看测试。
- **Next eligible Task ID:** `V07-017`

### V07-017 · Communication 本地解释卡
- **Status:** PASS
- **Files changed:** `V07FormInteractions.tsx`、`MissionExperience.tsx`
- **Implementation summary:** `LocalExplanationCard` 只本地展示 `getTextEvidence()`，零出站；既有 `ca-evidence-input` / `onSubmitEvidence` 一行未改，继续由 `submitTextEvidence()` 供判定；评估器只确认「有没有留下一段话」，不评长度 / 内容。
- **Next eligible Task ID:** `V07-018`

### V07-018 · 反思输入 + typing guard 复核
- **Status:** PASS
- **Files changed:** `interactionRecords.ts`、`MissionRuntimePlugin.ts`、`V07FormInteractions.tsx`、`src/app/App.tsx`
- **Implementation summary:** `ReflectionInput` 可选、可跳过、trim 后只存运行时 Map；`submitReflection()` 不调用 `evaluate()`、不进 `baseQuery()`、不产生掌握证据；明确写出「只在这次游戏里保留，读档、刷新或关掉就没了；不会保存、不会打分、不会上传」。`isTypingTarget()` 统一守卫 keydown（数字键 / `E` / `Tab` / `F`）与 wheel，`Escape` 仍先处理、输入时 `Tab` 保留浏览器默认焦点切换（修 `DEV-704`）。
- **Tests:** `v07UiTokens.test.ts` 静态断言 guard 顺序；`v07FormWiring.test.ts` 断言反思不影响判定。
- **Next eligible Task ID:** `V07-019`

### V07-019 · 证据面板本地展示
- **Status:** PASS
- **Files changed:** `V07FormInteractions.tsx`、`src/ui/mission/MissionDetailPanel.tsx`
- **Implementation summary:** `LocalEvidencePanel` 用 `<details>` 给家长 / 教师人工回看，只列计数与文本，0 处对错 / 分数 / 等级 / 百分比；`MissionDetailPanel` 只新增可选 `children?: ReactNode` 与一个 `ca-detail-section` 容器，既有 18 个任务 UI 零变化，`EvidenceRecordPanel` 只读语义未动。
- **Next eligible Task ID:** `V07-020`

### V07-020 · UI token / 无障碍 / 空态
- **Status:** PASS（单测口径；对比度与真机截图仍 NOT RUN）
- **Files changed:** `src/ui/v07Forms.css`（新）、`src/main.tsx`、`src/ui/mission/v07UiTokens.test.ts`（新）
- **Implementation summary:** 新样式只用 `var(--ca-*)`，零硬编码颜色、零 `position: fixed`、零 emoji；`focus-visible` 与 `prefers-reduced-motion` 齐备；六类空态文案齐全；`tokens.css` 色值零改动，`.topbar` / `.hotbar` / `.quest-panel` / `.ca-detail` / `.ca-btn` 存量类未删。
- **Tests:** `v07UiTokens.test.ts` 4 条；`V07FormInteractions.test.ts` 6 条；`v07InteractionModel.test.ts` 4 条；`v07FormWiring.test.ts` 4 条。本轮修掉 3 个测试自身缺陷：CSS 相对路径层级、`.test.tsx` 不被 `vitest.config.ts`（只收 `*.test.ts`）收集、两态有数据时不显示空态导致用例误判。
- **Phase 2 全量回归:** `npm test -- --no-file-parallelism` **54 文件 / 404 用例** exit 0；typecheck 0；`git diff --check` 0。
- **Known failures / risks:** 对比度 ≥4.5:1 与 M1~M8 截图对照尚未实测（`V07-022`）；build / E2E / canonical / ABBA / 安全抽查 / 角色 B 均 NOT RUN。
- **Next eligible Task ID:** `V07-021`（期望值适配与逐条留痕）

## 3. 本批文件清单

**新增（源码 / 测试）：** `interactionContracts.ts(.test)`、`interactionRecords.ts(.test)`、`interactiveEvaluators.ts(.test)`、`interactionBoundaries.test.ts`、`v07MasteryEvidence.test.ts`、`v07MissionContracts.ts(.test)`、`interactiveMissions.ts(.test)`、`v07LowAgeHints.ts`、`v07LearningSupport.test.ts`、`v07InteractionModel.ts(.test)`、`V07FormInteractions.tsx(.test)`、`v07FormWiring.test.ts`、`v07UiTokens.test.ts`、`v07Forms.css`
**改动（既有源码）：** `evaluators.ts`、`MissionRuntimePlugin.ts`、`MissionDetailPanel.tsx`、`MissionExperience.tsx`、`GameCanvas.tsx`、`App.tsx`、`main.tsx`
**未改：** `src/content/missions/index.ts`（`ALL_MISSIONS` 仍 18）、`createDefaultEvaluatorRegistry()`（仍 18）、全部 `e2e/`、全部 canonical、全部版本 / tag / package 版本。

> 上表「未改」是 **Phase 1 / Phase 2 批次结束时**的历史时点记录，保留原样不回改。之后 `V07-021` 已把 `V07_MISSIONS` 只追加到 `ALL_MISSIONS`（18→24）、`registerInteractiveEvaluators()` 只追加到 `createDefaultEvaluatorRegistry()`（18→24），并适配 3 个 `v051-*` E2E spec 的期望值；逐条留痕见 `V07-021_EXPECTATION_ADAPTATION.md`。

## 4. 追加修复（2026-11-15，`V07-022` 截图复核时发现）

### `completionSuppressed` 抑制未解除 — 真实功能缺陷
- **发现路径：** `v07-s6-decision.png` 初版仍是 locked panel、`v07-s14-mastery-evidence.png` 初版显示「还没有证据记录」；推断新建档案后 V0.7 会话证据类任务永远停在 `available`。
- **复现：** 新建 `src/plugins/mission/v07CompletionSuppression.test.ts`，初始 3 条用例全部失败：`AssertionError: expected 'completed', received 'available'`。
- **根因：** `MissionRuntimePlugin.completionSuppressed` 的设计意图是防止档案切换后「继承别人的世界状态」直接完成任务，但只在 `water.flow.updated` / `measurement.used` 事件里解除；V0.7 的观察 / 两态对照 / 决策 / 文字证据动作都不发这两个事件。
- **修复：**
  - 新增 `private readonly freshSessionEvidence = new Set<string>()`；`submitTextEvidence()` / `submitObservation()` / `submitVariablePair()` / `submitDecision()` 调用 `markFreshSessionEvidence(missionId)`。
  - `evaluate()` 改用 `const completionAllowed = !this.completionSuppressed || this.freshSessionEvidence.has(mission.id);`。
  - 新增 `noteRealWorldChange()`：方块放置 / 拆除、剖面切换、`ELECTRICAL_EVENTS.networkChanged`、水流更新、测量使用均视为真实世界变化，解除抑制并清掉上一档案的放行标记；已接入对应事件订阅。
  - `submitReflection()` 明确不调用 `evaluate()`、不进 `baseQuery()`、不解除抑制 —— 反思文本不参与完成 / 掌握 / 奖励判定。
- **回归：** `v07CompletionSuppression.test.ts` 4/4 PASS（Exploration 三条观察完成并解锁下游链、Communication 文字理由完成、真实世界变化后世界/电路类任务完成、档案切换仍隔离）；修复后全量 **55 文件 / 408 单测** PASS、typecheck 0、**E2E 47/47（`--workers=1`，4.9m）**、build 0、`git diff --check` 0。
- **边界：** `WorldSnapshot v1` 零变更；localStorage 仍 3 key；`EvaluatorResult` 三字段不变；无 v3、无新知识点 ID、无新存储 key；V0.5 基线 6 spec / 20 条 E2E 逐字节零改动。

### `V07-020` 的两项 NOT RUN 已补齐
- 对比度 ≥4.5:1 已在 `V07-022` 用离屏计算样式探针实测：`.ca-v07-label` 7.58 / `.ca-v07-empty` 7.58 / `.ca-v07-pair-state` 14.51 / `.ca-v07-chip` 5.47 / `.ca-v07-list` 14.51。
- M1~M8 截图对照已在 `V07-022` 完成，见 `V07-022_SCREEN_REFERENCE_COMPARISON.md`；15 张截图在 `docs/v0.7/screenshots/gate2/`。
- 角色 B 独立验收 / canonical / ABBA / 安全抽查 / 发布仍为 NOT RUN。
