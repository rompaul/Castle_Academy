# V07-003 · 开放问题、v2 只读 spike 与 G0 判定

**日期：** 2026-11-15；**性质：** Phase 0 收口报告，`V07-001~003` 全部为只读取证（docs-only 报告除外）
**前置：** owner 2026-11-15 已「照批，都按建议」签核 ADR-0014/0015/0016 与 Q7-1~Q7-7 口径，并授权开跑 Phase 0；**口径批准 ≠ G1 PASS**

## 1. Q7-1~Q7-7 逐项结论（含 Phase 0 复核）

| # | 结论（owner 已批准） | Phase 0 复核 | 状态 |
|---|---|---|---|
| Q7-1 | schema v2 装得下六类形式与反思；只加可选字段与只读查询通道，**严禁 `schemaVersion: 3`** | 只读 spike **结论「装得下」**，见 §3；`validateMissionDefinition()` 无未知字段拒绝（16 条规则全为具名字段检查），但编译期须给 `MissionDefinition` 加可选字段（属 ADR-0014 允许范围） | ✅ 口径已批准 + spike 通过 |
| Q7-2 | 新增 6 个任务（18→24），六类全覆盖，`life-simulation` 从 0 变可用 | 6 个候选 ID 与现有 18 个零碰撞、全部匹配 `id` 正则；24 个已注册知识点映射草案见 `V07_MISSION_AND_EVALUATOR_ID_MAP.md` §7 | ✅ 已批准；ID 冻结待 `V07-006/008` |
| Q7-3 | 解释 / 反思文本**零落盘**，运行时内存，读档 / 重置清空，localStorage 恒 3 key | 现状 `textEvidence` **仅档案切换时清空**，`resetEvaluation()` / `refresh()` 不清（报告 4 §3）→ 契约需在 `V07-005/018` 显式实现并测试 | ✅ 已批准；⚠️ 实现期风险 `R-710` |
| Q7-4 | 本版**不自动评价**，本地展示供人类复核，不引入 AI 判分、不赋予掌握状态 | 判定链全库检索 AI/LLM/fetch 0 处实现调用（报告 4 §4）；`EvidenceRecordPanel` 只读、无评分 UI | ✅ 已批准 |
| Q7-5 | 不做水压 / 流速 / 泵曲线；Experiment 复用既有二值规则做变量对照；Q-6 本版收口 | `ElectricalQuery.getSwitchObservations()` 已提供同一位置 `open`/`closed` 成对观察、上限 128、不落盘，可直接复用 | ✅ **owner 已裁定**（不重开） |
| Q7-6 | 新 UI 不触发 DDR；改 HUD 布局则停下另提 DDR-0003 | 35 个 `--ca-*` token 已够用，5 个组件可挂在 `MissionDetailPanel` 正常分支内（INFERENCE，挂载实测 NOT RUN） | ✅ 已批准；DDR-0003 仍不预批准 |
| Q7-7 | 按 `DEV-613` 先例做期望值适配，**V0.5 基线 20 条 E2E 逐字节零改动** | ⚠️ **Phase 0 发现起草期清单不完整**：实查受影响的硬断言 ≥18 处，起草期 §9 只列 3 处，见 §4 | ⚠️ 口径已批准，**适配清单需 owner 补充确认** |

## 2. 目标领域 ↔ 现有模块差异表

| V0.7 需要 | 现有可复用 | 需扩展 | 必须新建 |
|---|---|---|---|
| 6 类任务内容 | `MissionDefinition` v2、`expressionForms` 6 值、`validateMissionDefinition()`、`ALL_MISSIONS` | interface 加**可选**交互配置字段 | 6 个任务常量、6 个评估器（纯函数） |
| 完成证据 | `EvaluatorQuery` 7 通道、`EvaluatorResult` 3 字段、`EvaluatorRegistry.register()` | `EvaluatorQuery` 加 3 个**只读、可选、有界**通道；`MissionRuntimeOptions` 注入源；`baseQuery()` 赋值 | 3 个运行时派生记录类型 + 上限 / 溢出 / 清空逻辑 |
| 任务运行时 | `MissionRuntimePlugin.evaluate()`、`resolveMissionGraph()`、掌握证据写回链 | 生命周期清空点（`resetEvaluation` / `refresh` / `dispose`） | 无（**严禁第二套 Runtime / Registry / EventBus**，`R-703`） |
| 形式专属 UI | `MissionDetailPanel` 条件渲染、35 个 token、`EvidenceRecordPanel` 只读语义 | `ca-evidence-*` 同族样式、typing guard 覆盖面 | 观察清单 / 两态对照 / 假设切换 / 情境决策 / 本地解释卡 5 个受控组件 |
| 反思输入 | `textEvidence`、`submitTextEvidence()` 的 trim + 长度语义 | 可选 / 可跳过 / 中性确认 / 「只在这次游戏里保留」文案 | 反思输入组件（不参与判定） |
| 视觉 / 性能 | V0.6 3D 锚点、V0.6.1 HUD 白名单、D-2 ABBA 方法 | 新脚本只写 `docs/v0.7/` | `v07-visual-regression.mjs` / `v07-perf.mjs` |

**不新建：** 知识点 ID、BlockId、事件总线、内容格式、Mission Runtime、localStorage key、掌握等级字段、AI 调用。

## 3. v2 只读 spike（Q7-1；不落盘、不写功能代码、未改任何文件）

### 3.1 推演依据（FACT）

- `validateMissionDefinition(value: unknown)` 的 16 条规则全部针对具名字段；`REQUIRED_STRING_FIELDS` 是正向必填白名单；**全库 0 处 `Object.keys` 白名单 / 未知字段拒绝 / 严格 shape 检查**（`types.ts:87-150`）。
- `schemaVersion` 允许 `undefined|1|2`；`3` 被 `:122-125` 明确拒绝。
- v2 的 `knowledgePointIds` 每个 ID 必须 `isRegisteredKnowledgePoint()`（`registry.ts:320-322` 精确匹配）。
- `EvaluatorQuery` 是 interface，已有 4 个可选通道；`MissionEvaluator.evaluate/describe` 形参类型名为 `EvaluatorQuery`；`MissionRuntimePlugin.baseQuery()` 是产品代码唯一构造点（`:365-375`）。

### 3.2 结论

| 层面 | 结论 | 标注 |
|---|---|---|
| 新增可选交互配置字段（运行时校验） | **装得下** —— 不触发任何 `errors.push` | FACT + INFERENCE |
| 6 个新 v2 任务 | **装得下** —— 满足 16 条规则 + 引用 24 个已注册 ID 即可 | INFERENCE |
| 编译期 | **需给 `MissionDefinition` 加可选字段**（对象字面量 excess property check）；这正是 ADR-0014 允许的扩展，**不是升 v3、不是第三套格式** | INFERENCE（未运行 `tsc` 验证） |
| `EvaluatorQuery` 加 3 个可选只读通道 | **不破坏** —— 18 个评估器签名逐字不变、`EvaluatorResult` 3 字段不变、写回链只消费 `evidence.observation`；`baseQuery()` 需赋值，若为必填则所有测试 query 构造点须同步，故**必须声明为可选** | INFERENCE |
| **Q7-1 总判定** | **装得下 → G1 不因 spike BLOCKED**；若实现期出现 `schemaVersion: 3` 立即 BLOCKED（`R-702`） | INFERENCE |

### 3.3 3 个只读通道类型草案（仅文字推演，未落盘）

```
readonly ObservationEntry[]  // { missionId, position/keyword, sequence } —— 观察清单
readonly VariablePair[]      // { missionId, position, stateA, stateB, sequence } —— 两态对照（复用 getSwitchObservations()）
readonly DecisionEntry[]     // { missionId, step, choiceId, sequence } —— 情境决策序列
```

**上限策略（冻结建议，`V07-009` 定案并测试）：** 三通道各设显式上限常量（建议沿用 `MAX_SWITCH_OBSERVATIONS = 128` 量级），溢出**丢弃最旧**（与 `ElectricalPlugin.ts:274-285` 一致）；「拒绝新增」为备选。读档 / 重置 / `refresh()` / `dispose()` 清空；不得每帧扫描；派生记录只进 `EvaluatorQuery`，不进任何持久化存储。

## 4. 期望值适配清单 —— Phase 0 重要发现（需 owner 补充确认）

`01_SCOPE` §9 起草期只列 **3 处**（`extendedEvaluators.test.ts:211-216` + 2 个 v051 spec 标题）。实查 `18→24` / `5→6` 会撞到的硬断言至少 **18 处**，逐条见 `V07_TEST_AND_PERFORMANCE_BASELINE.md` §3.2，归纳为 4 组：

| 组 | 位置 | 现值 → 适配方向 |
|---|---|---|
| A 任务 / 评估器全量数字 | `evaluators.test.ts:36,47`、`extendedEvaluators.test.ts:203`、`MissionRuntimePlugin.test.ts:67,123`、`LearnerProfileProgressStore.test.ts:147,160`、`glossary.test.ts:126,137`、`missionGraph.test.ts:90`、`v051-content-batch1.spec.ts:38`、`v051-content-batch2.spec.ts:44`、`v051-mission-foundation.spec.ts:21,95` | `18 → 24`（仍断言全量，语义不变） |
| B 形式种类 | `extendedEvaluators.test.ts:213`、`v051-content-batch2.spec.ts:54` | `5 → 6` /「六类全覆盖」 |
| C communication 数量 | `extendedEvaluators.test.ts:214-216`、`v051-content-batch2.spec.ts:55` | 「恰好 1 个」→「≥1 且含 `my-design-note`」 |
| D 描述性标题 / 链数量 | 上述 spec 的 `test(` 标题、`MissionRuntimePlugin.test.ts:59-77` 的 locked 数、`missionGraph.test.ts:87-98` 的边数（若 `V07-011` 新增第 5 条链） | 同步措辞 / 计数 |

**不变式：** V0.5 基线 6 个 spec / 20 条 E2E 逐字节零改动；24 个知识点 ID 零改动；既有 18 个任务 ID / 18 个 evaluator ID、`glossary.test.ts:118-120` 字面值、`blocks.test.ts:6`、`registry.test.ts:55,163-181`、`tokens.test.ts:10-49` 一律不动。

**判定（重要）：** owner 2026-11-15 批准的是起草期 §9 的 3 处。Phase 0 新识别的 A/B/D 组数字断言**不在已批准清单内**，按 `DEV-613` 先例「逐条登记 + owner 批准」的要求，**不得静默改测试**。故本报告把「补充批准」列为 **G1 新增阻断项**，而不是自行扩大批准范围。

## 5. Phase 0 新发现风险（登记，不改写 ADR）

| 临时编号 | 发现 | 影响 | 归属 |
|---|---|---|---|
| `DEV-701` | `resetEvaluation()` / `refresh()` 不清 `textEvidence` 与 `structuralDirty`（仅 `onExternalChange` 清） | Q7-3 / ADR-0015 决策 2 的「读档 / 重置清空」未自动成立；新记录若照抄会残留 | `V07-005/018` 显式清空 + 生命周期测试 |
| `DEV-702` | 期望值适配清单起草期不完整（3 处 vs ≥18 处） | 未补批就改测试会违反 `DEV-613` 逐条留痕口径 | **G1 前 owner 补充批准** |
| `DEV-703` | `electricalEvaluators.test.ts` 无源码禁串扫描（V0.6.1 新增，仅文件头注释） | 6 个新评估器的纯函数红线缺统一测试护栏 | `V07-007` 补契约测试 |
| `DEV-704` | typing guard 仅护 `E`；`1–9` 在 guard 之前，`Tab` / `F` 无 guard，滚轮独立 | 输入时误切格 / 误切开关 / 阻止焦点切换 | `V07-018` 复核 + E2E（`R-711`） |
| `DEV-705` | 起草期事实表若干数字 / 路径不准（20 字段非 22、`mission.css` 路径、行号归属等） | 文档口径 | 已在 `V07_REPOSITORY_BASELINE_REPORT.md` §4 登记，不改写历史文档 |

## 6. 门禁判定与结束条件

| 门 | 判定 | 依据 |
|---|---|---|
| **G0** | ✅ **PASS**（只读审计与批准基线复核完成、6 份报告齐备、基线测试实跑并记录命令/退出码、canonical / 性能基线可追溯、v2 spike「装得下」、Q7-1~Q7-7 有逐项结论） | `V07_Repository_Baseline_Audit.md` §5 的 7 项条件全部满足；远端 refs 因代理未启记 UNKNOWN，按指引不判失败 |
| **STOP GATE-1** | ⏸ **条件齐备、未放行** | ① 口径已批准；② `DEV-702` 补充清单已于 2026-11-15 第二轮裁定补批；③ G0 PASS、证据齐备；④ owner 选「先停」，未签放行，功能代码须另一个明确口令 |

**审计结束即停。** `V07-004` 及任何 `src/` 功能代码**未启动**；零源码改动、零 git 提交、零版本 / tag 变更、未安装依赖、未改产品文档路线图（V0.7 行仍 `Proposed`）。

**建议的下一个动作（不是 Task ID）：** owner 对 §4 补充清单点头（按 `DEV-613` 先例作为批准范围内内容扩展处理），并对 G1 明确放行；之后才可启动 `V07-004`。若 owner 选择先修 `DEV-701/703/704`，也应在功能代码阶段按任务顺序处理，不在 Phase 0 追加。

## 7. 证据索引

`V07_REPOSITORY_BASELINE_REPORT.md`（基线 / 差异）、`V07_MISSION_AND_EVALUATOR_ID_MAP.md`（全表 / 映射草案）、`V07_UI_AND_INPUT_CONTRACT_MAP.md`（UI / token / guard / 事件）、`V07_PERSISTENCE_AND_PRIVACY_REPORT.md`（3 key / 生命周期 / AI 零参与）、`V07_TEST_AND_PERFORMANCE_BASELINE.md`（实跑 / 硬断言 / 可追溯基线）、执行包 `09_GOVERNANCE/V07_GATE1_REVIEW_PACK.md`（签核记录）。

## 8. 第二轮裁定补录（2026-11-15；不改写上方 §4 / §6 的 Phase 0 原始判定）

| 决定 | owner 选项 | 落地 |
|---|---|---|
| 补充清单 | **照批，按上次先例（推荐）** | 起草期 3 处 + Phase 0 实查 ≥18 处**完整清单全部批准**，按 `DEV-613` 先例作为批准范围内内容扩展的期望值适配；`01_SCOPE` §9 已补录完整清单与执行要求；**逐条留痕只在 `V07-021` 实际改测试时执行，当前一条测试未改** |
| 功能代码 | **先停，我看完报告再说（推荐）** | 不启动 `V07-004`，零源码改动、零提交；6 份报告留原处等 owner 复查 |

**G1 现状**：口径、Q7、完整期望值适配清单、G0 证据均已齐备；唯一剩余是 **owner 未签放行**。仍按「未放行 / NOT PASSED」记录，不得据此提前写功能代码。下次开工口令到达时，建议下一个 Task ID 为 `V07-004`。
