# V07-021 — 期望值适配与逐条留痕（DEV-702 / Q7-7）

**日期：** 2026-11-15
**批准依据：** owner 第二轮裁定「照批，按上次先例」—— 起草期 3 处 + Phase 0 实查 ≥18 处数字 / 集合断言一并批准，性质等同 V0.6.1 `DEV-613`；**属批准范围内内容扩展引起的期望值适配，不是为让失败测试变绿而改写测试**。逐条留痕只在 `V07-021` 实际改测试时执行（本文件即留痕）。
**批准清单出处：** `Castle_Academy_V0.7_Execution_Package/01_SCOPE/V07_SCOPE_AND_ACCEPTANCE.md` §9 + §9 补录；`docs/v0.7/audit/V07_TEST_AND_PERFORMANCE_BASELINE.md` §3.2；`docs/v0.7/audit/V07_OPEN_QUESTIONS_AND_RISKS.md` §4。
**先例模板：** `docs/v0.6.1/audit/V061_DEV613_EXPECTATION_ADAPTATION.md`。

## 1. 本次实际接线（唯一入口，只追加）

| 文件 | 变更 | 不变式 |
|---|---|---|
| `src/content/missions/index.ts` | `ALL_MISSIONS` 末尾追加 `...V07_MISSIONS`（18 → 24） | 前 18 个 ID 与顺序逐字不变；不新建平行入口 |
| `src/plugins/mission/evaluators.ts` | `createDefaultEvaluatorRegistry()` 末尾调用 `registerInteractiveEvaluators(registry)`（18 → 24） | 既有 18 个 evaluator ID 与顺序不变；`EvaluatorResult` 三字段不变 |
| `src/content/missions/interactiveMissions.ts`、`interactiveEvaluators.ts` | 仅改文件头过期注释（原写「暂不接入」） | 六个任务 / 六个评估器定义体零改动 |

**稳定契约复核：** `WorldSnapshot v1` diff 0；34 个 BlockId 零改动；24 个知识点 ID 零改动；`schemaVersion` 仍只接受 `1|2`（六个新任务全为 2）；localStorage 仍 3 个 key；三个运行时通道仍只读、有界、零落盘；反思文本不进判定链。

## 2. 先接线、再实跑、再逐条适配（不预先放宽）

接线后先跑一次全量单测，**如实记录 15 条失败**（11 个文件），确认失败全部是「18→24 / 5→6 / 1→2 / 4→5 条边」这类数量与集合期望，没有一条是逻辑回归：

```text
npm test -- --no-file-parallelism   →  11 failed | 43 passed (54 files); 15 failed | 389 passed (404 tests)
典型失败：expected [ …(24) ] to have a length of 18 but got 24 / expected 6 to be 5 / 4 locked 变 5 locked
```

随后按下表逐条适配，再跑回归：`npm run typecheck` exit 0；`npm test -- --no-file-parallelism` **54 文件 / 404 用例 exit 0**。

## 3. 单测逐条变更清单（11 文件）

| # | 文件:位置 | 原值 | 新值 | 语义是否改变 | 理由 |
|---|---|---|---|---|---|
| U1 | `src/plugins/mission/evaluators.test.ts:33` | 标题「3+12+3 评估器」 | 「3+12+3+6 评估器」 | 否 | 描述性标题同步 |
| U2 | `evaluators.test.ts:36` | `registry.ids()).toHaveLength(18)` | `24` | 否（仍断言全量唯一） | 6 个评估器追加到同一注册表 |
| U3 | `evaluators.test.ts:38-46` | `has()` 清单 18 个 ID | 追加 6 个 V0.7 ID（共 24 个逐条验证） | 否（语义加强） | 新 ID 同样必须真实注册 |
| U4 | `evaluators.test.ts:47` | `new Set(ids).size).toBe(18)` | `24` | 否 | 唯一性不变式 |
| U5 | `src/plugins/mission/extendedEvaluators.test.ts:203` | `ALL_MISSIONS).toHaveLength(18)` | `24` | 否（仍断言 Content Pack 全量） | 6 个任务只追加到末尾 |
| U6 | `extendedEvaluators.test.ts:212-213` | 形式集合 `size).toBe(5)` + 注释「life-simulation 留 V0.6」 | `6` + 注释说明六类全覆盖 | 否（AC-231 阈值 ≥3，现为 6） | 批准清单 §9 第 1 项 |
| U7 | `extendedEvaluators.test.ts:215-216` | `communication).toHaveLength(1)` + `communication[0].id === "mission.my-design-note.v1"` | `toHaveLength(2)` + `map(id).toContain("mission.my-design-note.v1")` | 否（仍是硬数字；既有交流任务仍必须在） | 第 2 个 communication 由 `explain-my-choice` 提供 |
| U8 | `src/plugins/mission/MissionRuntimePlugin.test.ts:59` | 标题「14 available + 4 locked」 | 「19 available + 5 locked」 | 否 | 24 任务、5 条先决链 |
| U9 | `MissionRuntimePlugin.test.ts:67` | `offered[0].missions).toHaveLength(18)` | `24` | 否（`slice(0,3)` 三任务 ID 断言逐字保留） | 全量 |
| U10 | `MissionRuntimePlugin.test.ts:73-78` | 4 条 locked 断言 + available 14 | 追加 `mission.choose-water-route.v1` locked、available 19 | 否（locked 语义不变） | `V07-011` 新增第 5 条链 |
| U11 | `MissionRuntimePlugin.test.ts:123` | `list).toHaveLength(18)` | `24` | 否（仍断言「缺失能力时全部 unavailable」） | 全量 |
| U12 | `src/plugins/mission/LearnerProfileProgressStore.test.ts:147,160` | `getMissions()).toHaveLength(18)` ×2 | `24` ×2 | 否 | 无档案降级 / 档案损坏容错仍可用 |
| U13 | `src/content/knowledge/missionGraph.test.ts:87` | 标题「18 个 / 4 条边」 | 「24 个 / 5 条边」 | 否 | 描述性标题同步 |
| U14 | `missionGraph.test.ts:90,93-98` | `order).toHaveLength(18)` + 4 条边数组 | `24` + 追加 `["mission.find-the-pattern.v1","mission.choose-water-route.v1"]`（既有 4 条逐字保留） | 否（无环 / 无悬空不变） | `V07-011` 新链 |
| U15 | `src/content/electrical/glossary.test.ts:126-128` | `ALL_MISSIONS).toHaveLength(18)` + `slice(-3)` | `24` + `slice(15, 18)` | 否（电力三任务仍固定占 15~17 位） | 追加任务不能改变电力任务位置断言的语义 |
| U16 | `glossary.test.ts:137,143` | `graph.order).toHaveLength(18)` + `edges).toHaveLength(4)` | `24` + `5` | 否（「既有 3 条边逐字保留」断言保留） | 第 5 条链 |
| U17 | `src/plugins/mission/interactionContracts.test.ts:126` | `registry.ids()).toHaveLength(18)` | `24` | 否（仍验证旧 `EvaluatorQuery` 构造点零改动可判定） | 同一注册表追加 |
| U18 | `src/content/missions/interactiveMissions.test.ts:33-41` | 「与既有 18 个零碰撞」+ `existing).toHaveLength(18)` | 「已接入唯一入口：24 个零重复、末尾 6 个等于冻结表、前 18 不含新 ID」 | 否（碰撞检查更强） | 由「未接入」阶段改为「已接入」阶段 |
| U19 | `src/content/missions/v07MissionContracts.test.ts:13-22` | `existing).toHaveLength(18)` + 新 ID 不在 `ALL_MISSIONS` | `ALL_MISSIONS).toHaveLength(24)` + 末尾 6 个等于冻结表 + 全量零重复 | 否 | 同上 |
| U20 | `v07MissionContracts.test.ts:24-33` | 注册表 18 + `has(id) === false` | 注册表 24 + `has(id) === true` | 否（验证对象从「预留」改为「已注册」） | 同上 |
| U21 | `src/content/missions/v07LearningSupport.test.ts:60` | `combined = [...ALL_MISSIONS, ...V07_MISSIONS]` | `combined = ALL_MISSIONS` | 否（修重复拼接，否则 30 个 / 6 条边） | 接入后不能把同一批任务再拼一次 |
| U22 | `src/ui/mission/V07FormInteractions.test.ts:86-91` | 遍历 `ALL_MISSIONS` 断言「一个都不在白名单」 | 遍历 `slice(0,18)` + 断言 `slice(18)` 恰好等于白名单 | 否（既有 18 个任务不挂新 UI 的语义保留） | 接入后白名单恰好是末尾 6 个 |

> 未列入本节的单测文件一律零改动。

## 4. E2E 逐条变更清单（3 文件；V0.5 基线 20 条零改动）

| # | 文件:位置 | 原值 | 新值 | 语义是否改变 | 理由 |
|---|---|---|---|---|---|
| E1 | `e2e/v051-content-batch1.spec.ts:21` | 标题「18 个任务」 | 「24 个任务」 | 否 | 描述性标题 |
| E2 | `v051-content-batch1.spec.ts:38` | `definitions).toHaveLength(18)` | `24` | 否（`slice(0,3)` 前三 ID、`slice(3,9)` 批次 1 六 ID 逐字保留） | 全量 |
| E3 | `e2e/v051-content-batch2.spec.ts:32` | 标题「18 个任务 / 全部表达形式」 | 「24 个任务 / 六类表达形式」 | 否 | 描述性标题 |
| E4 | `v051-content-batch2.spec.ts:44` | `defs).toHaveLength(18)` | `24` | 否 | 全量 |
| E5 | `v051-content-batch2.spec.ts:54` | 形式集合 `size).toBe(5)` | `6` | 否 | 六类全覆盖 |
| E6 | `v051-content-batch2.spec.ts:55` | `communication).toHaveLength(1)` | `2` | 否 | 第 2 个 communication |
| E7 | `e2e/v051-mission-foundation.spec.ts:21` | `missions).toHaveLength(18)` | `24` | 否 | 全量 |
| E8 | `v051-mission-foundation.spec.ts:95` | `missions).toBe(18)` | `24` | 否 | 档案容错后任务全量 |

**未改（逐字节）：** `e2e/diagnose.spec.ts`、`e2e/diagnose-underground.spec.ts`、`e2e/first-playable.spec.ts`、`e2e/layer-section.spec.ts`、`e2e/persistence.spec.ts`、`e2e/water-quests.spec.ts`（V0.5 基线 6 spec / 20 条）；`v051-content-batch2.spec.ts:46-49` 的 `slice(9, 15)` 与 CROSS_AGE_IDS；`v051-content-batch1.spec.ts:39-41` 前三任务 ID。

## 5. 零改动核验命令与实测输出

```bash
cd Castle_Academy_V0.1_Source
git diff --name-only -- e2e/                     # 只输出 3 个 v051 文件
git diff --name-only -- e2e/diagnose.spec.ts e2e/diagnose-underground.spec.ts \
  e2e/first-playable.spec.ts e2e/layer-section.spec.ts e2e/persistence.spec.ts \
  e2e/water-quests.spec.ts                     # 输出为空（实测为空）
git diff --name-only -- src/content/knowledge/registry.test.ts \
  src/content/missions/missions.test.ts src/core/world/WorldState.ts \
  src/core/world/blocks.ts                     # 输出为空（实测为空）
```

实测：`git diff --name-only -- e2e/` 输出恰为 3 个 `v051-*` 文件；两条零改动核验命令输出均为空。`git diff --check` exit 0。

## 6. 实跑结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test -- --no-file-parallelism`（接线后、适配前） | 15 failed / 389 passed（如实记录，见 §2） |
| `npm test -- --no-file-parallelism`（适配后） | **54 文件 / 404 用例 PASS**，exit 0 |
| `git diff --check` | exit 0 |
| `npx playwright test --workers=1` | **47/47 PASS（5.0m）**，exit 0，见 §7 |

## 7. E2E 实测记录

`npx playwright test --workers=1` 实测 **47 passed / 0 failed（5.0m）**，其中：

- V0.5 基线 6 个 spec / 20 条：`diagnose` 1、`first-playable` 7、`layer-section` 5、`persistence` 3、`water-quests` 3、`diagnose-underground` 1 —— 文件逐字节零改动，全部 `ok`。
- 本次改过的 3 个 `v051-*` spec：`v051-content-batch1` 3 条、`v051-content-batch2` 4 条、`v051-mission-foundation` 4 条，全部 `ok`（含「24 个任务」「六类表达形式」「2 个 communication」与档案容错后全量 24）。
- 其余 `v051-*` 与 V0.6.1 电力 / 图层 / 剖面 / 奖励 / 引导 spec 全部 `ok`；`v051-mission-foundation.spec.ts` 的 `pageErrors` 断言为 `[]`。
- 关键兼容断言仍成立：`v051-content-batch1.spec.ts` 的「护城河完成动作不会连带完成任何新增任务」与 `expect(after).toEqual(["mission.moat.v1"])` 均通过 —— 24 个任务下种子世界与幂等保护没有伪完成。
- 全程未手动启动 vite（Playwright config 自带 webServer），5173 由测试自行管理。

## 8. 边界

- 本裁定**不豁免**其它停止条件：若旧 E2E 失败、3D 像素差 > 0、性能超 ABBA 噪声、安全文案缺失，仍按 BLOCKED 上报。
- 本裁定**不预支** STOP GATE-2：角色 B `FULLY SATISFIED` 与 M1~M8 截图评审仍须 owner 放行。
- 接入后 `isAllCompleted()` 覆盖任务数由 18 变 24；旧 `quest.updated` 仍只发 3 个水任务，不受内容扩展影响（由 V0.5 基线 E2E 守护）。
- canonical / ABBA / 安全抽查 / 角色 B / build / release 仍 NOT RUN。
