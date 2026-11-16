# V07-004 任务报告 — 交互契约与只读查询通道类型

**日期：** 2026-11-15
**Status:** **PASS**
**Approved baseline SHA（tag `v0.6.1` / `f0980b8`）:** `f0980b8d3174ca819a961738fe6dd14264290b09`（开工前 `git rev-list -n1 v0.6.1` 复核吻合；master `4f18102` 为 tag 之后 docs-only 登记提交，非基线）
**门禁：** STOP GATE-1 **PASS / RELEASED**（owner 2026-11-15 18:47 选项 `现在开工（推荐）`；留痕见 `09_GOVERNANCE/V07_GATE1_REVIEW_PACK.md` §第三轮裁定）

## Repository facts and files inspected

- `src/plugins/mission/evaluators.ts`：`EvaluatorQuery` 现有 7 通道（3 必填 + 4 可选），`EvaluatorResult` 3 字段，`createDefaultEvaluatorRegistry()` 注册 18 个评估器。
- `src/plugins/mission/MissionRuntimePlugin.ts`：`baseQuery()` 是产品代码唯一构造 `EvaluatorQuery` 的位置；`textEvidence` 为运行时内存 Map。
- `src/plugins/electrical/query.ts`：`SwitchObservation` 的 `readonly position / state / lampPowered / sequence` 形状，作为新类型风格参照；两态只用 `open|closed`。
- `docs/v0.7/audit/V07_OPEN_QUESTIONS_AND_RISKS.md` §3.3：3 个通道类型草案与「必须可选」结论。
- `02_ARCHITECTURE/V07_ARCHITECTURE_AND_DATA_CONTRACTS.md` §3.2、ADR-0014 决策 4、ADR-0015 决策 2、`07_CLAUDE_CODE/01_IMPLEMENTATION_EXECUTION_PROMPT.md`。

## Files changed

| 文件 | 性质 | 内容 |
|---|---|---|
| `src/plugins/mission/interactionContracts.ts` | **新增** | `BinaryState`（`open|closed|wet|dry`）、`ObservationEntry` / `VariablePair` / `DecisionEntry` 三个全 `readonly` 记录类型、`InteractionSnapshot` / `InteractionSnapshotSource`、`EMPTY_INTERACTION_SNAPSHOT`、`toInteractionSnapshot()` 纯函数（深冻结投影，不修改输入、不共享引用） |
| `src/plugins/mission/interactionContracts.test.ts` | **新增** | 5 条契约测试 |
| `src/plugins/mission/evaluators.ts` | 修改 | 加一行 `import type`；`EvaluatorQuery` 追加 3 个**可选**通道 `observationLog` / `variableComparison` / `decisionSequence` |

零 UI / 渲染 / 持久化 / 事件 / 内容数据改动；零 git 提交。

## Content / API / schema / event impact（WorldSnapshot v1 diff 必须为零）

- `WorldSnapshot v1` diff：**0**（未触碰世界、存档、序列化代码）。
- 34 个 BlockId / 顺序、24 个知识点 ID、既有 18 个任务 ID / 18 个 evaluator ID、既有事件名、5 项能力：**全部零改动**。
- `EvaluatorResult` 仍 `{progress, complete, evidence?: {observation}}`：`EvaluatorQuery` 只加可选字段，既有 18 个评估器 `evaluate/describe` 签名逐字不变。
- `MissionRuntimePlugin.baseQuery()` **未改**：三个通道尚未注入（属 `V07-005`）；未注入时评估器按空集合降级，旧测试构造点一行不改。
- 未新增事件、未新增定时器、未新增每帧扫描。

## New runtime records: bounded? persisted?

- 本任务**只定义类型与纯函数**，未实例化任何运行时记录（`V07-005` 负责有界记录与生命周期清空，`V07-009` 冻结上限常量 / 溢出策略并测试）。
- 落盘结论：新模块 0 处 `localStorage` / `fetch` / `window` / `document` / 时钟 / 随机数访问；测试对源码做禁串扫描。快照全部 `Object.freeze`，且对 `position` 等普通字面量对象做浅拷贝冻结，外部持有可变记录也写不回评估器读到的视图。
- localStorage key 仍 **3** 个（`castle-academy-world-v1` / `castle-academy-view-v1` / `castle.academy.learner`）；`schemaVersion` 仍只接受 `1|2`（全库唯一 `schemaVersion: 3` 命中为既有负向断言测试）。

## Deterministic evidence chain（evaluator → EvaluatorResult → MasteryEvidenceRecord）

本任务未触碰判定链：没有新评估器、没有新任务、没有写回逻辑变更；`V07-007/008/012` 负责后续。反思 / 观察 / 决策记录**尚不存在**，因此不可能进入完成 / 掌握 / 奖励判定，也不可能产生掌握证据。

## Implementation summary

把 `V07-003` 只读 spike 的 3 个通道草案落成编译期契约：三个记录类型字段全 `readonly`，通道以 `ReadonlyArray` 暴露，并用一个纯函数把可变运行时记录投影成冻结快照。状态名只沿用既有二值规则（电 `open/closed`、水 `wet/dry`），`outcomeA/outcomeB` 是布尔观察而非数值测量，**不含任何物理量**，符合 Q7-5 与 ADR-0014 决策 6。三个通道在 `EvaluatorQuery` 上一律 `?` 可选，保证既有 18 个评估器与全部单测零破坏。

## Tests added / changed（V0.5 基线 20 条逐字节零改动）

新增 5 条（全部在 `interactionContracts.test.ts`）：
1. 冻结性：快照 / 三个通道数组 / 条目 / `position` 均 `Object.isFrozen === true`，写入抛 `TypeError`，输入对象不被改动；
2. 纯函数：输入数组与条目不变、返回对象与输入零共享、同输入两次结果等价；
3. 未注入通道时返回稳定的冻结空快照；
4. 契约模块禁串扫描（`Math.random` / `Date.now` / `fetch(` / `localStorage` / `window.` / `document.` / react / three / 定时器）；
5. 兼容：旧式 `EvaluatorQuery` 对象字面量（不含三通道）仍能构造，`evaluator.moat` 判定与 `describe` 不变，注册表仍 18 个 ID。

未改任何既有测试文件；未碰 `e2e/`。

## Commands actually run + exit codes

| 命令 | 结果 |
|---|---|
| `git rev-list -n1 v0.6.1` / `git rev-parse --short HEAD` / `git status --short` | `f0980b8…` / `4f18102` / 仅 `?? docs/v0.7/`；exit 0 |
| `npx vitest run --no-file-parallelism src/plugins/mission/interactionContracts.test.ts`（首次） | **exit 1**：4/5 PASS，禁串扫描命中源码注释里的 `localStorage` 字样 |
| 修复：把注释措辞改为「不碰界面、渲染与浏览器存储」（不弱化扫描规则） | 无测试改动 |
| `npx vitest run --no-file-parallelism <5 个 mission spec>` | **exit 0**：5 文件 / **44 用例** 全 PASS（含既有 `evaluators.test.ts` 禁串扫描） |
| `npm run typecheck` | **exit 0**（两次：首次与注释修复后复核） |
| `npm test -- --no-file-parallelism` | **exit 0**：**43 文件 / 344 用例** 全 PASS（Phase 0 基线 42 文件 339 用例 + 新增 5） |
| `git diff --check` | **exit 0** |
| `git diff -- src/plugins/mission/evaluators.ts` / `git grep` 稳定契约抽查 | 仅 1 文件 2 处改动（import + 3 个可选字段）；`schemaVersion: 3` 唯一命中为既有负向测试断言；3 个 key 未变 |

**未运行（NOT RUN，绝不预先写 PASS）：** `npm run build`、E2E、视觉回归 / canonical、ABBA 性能、安全抽查、角色 B 验收（分别归属 `V07-024~028 / 023 / 026`）。

## Visual regression impact

本任务零 UI、零渲染、零 HUD 改动，理论上 3D 世界 0 像素差；**未跑视觉回归**，按 NOT RUN 记录，不引用 V0.6.1 发布值冒充本版实测。

## Diff review

`git status --short`：`M src/plugins/mission/evaluators.ts`、`?? src/plugins/mission/interactionContracts.ts`、`?? src/plugins/mission/interactionContracts.test.ts`、`?? docs/v0.7/`（Phase 0 六份报告 + 本报告）。完整 diff 复核：无意外 API / schema / 事件 / ID 变化，无宽泛重构，无新增依赖。

## Known risks

- `V07-005` 必须实现运行时记录与读档 / 重置 / `refresh()` / `dispose()` 清空（`DEV-701`：现有 `textEvidence` 只在档案切换时清空）；本任务的冻结快照不等于生命周期已清空。
- `V07-009` 必须冻结三通道显式上限常量与溢出策略并测试（`AC-7032`）。
- `DEV-703`（电力评估器缺禁串扫描）留 `V07-007`；`DEV-704`（typing guard 仅护 `E`）留 `V07-018`；`DEV-705` 为文档口径偏差，实现期不改写历史文档。
- 逐条期望值适配留痕只在 `V07-021` 执行，当前一条既有测试未改。

## Next eligible Task ID（not auto-executed）

**`V07-005` — 有界运行时记录与生命周期**（依赖 `V07-004`）。STOP GATE-2 / 3 仍须 owner 另行放行。
