# DEV-613 — owner 裁定与既有期望值适配登记（V0.6.1 Phase 3）

**日期：** 2026-11-13
**裁定原文：** owner「按 A 继续」
**裁定对象：** Q-3 照批的 3 个电力任务 + V061-017 的 `kp.electric.*` 注册使 `ALL_MISSIONS` 15→18、`KNOWLEDGE_POINTS` 19→24、`EvaluatorRegistry.ids()` 15→18，与 V0.51 时期的数量硬断言冲突；`TASK_BREAKDOWN.md` 停止条件写有「不得通过改写既有 E2E 来解决阻塞」。AI 停在 V061-017 之前请求 owner 裁定口径。

## 1. 裁定口径（A）

1. **性质判定**：15→18、19→24、15→18（评估器）属**已批准范围（ADR-0012 Q-3 / ADR-0008 追加语义）内的内容扩展引起的期望值适配**，不是「为让失败测试变绿而改写测试」，也不属于停止条件所指的「用改测试来解决阻塞」。
2. **V0.5 基线 20 条 E2E 一行不改**：`diagnose.spec.ts` / `diagnose-underground.spec.ts` / `first-playable.spec.ts` / `layer-section.spec.ts` / `persistence.spec.ts` / `water-quests.spec.ts` 共 6 个文件保持逐字节不变（用 `git diff -- e2e/<file>` 逐文件核验为空）。
3. **V0.51 的 3 条 E2E 只改数字期望，不改断言语义**：
   - `v051-content-batch1.spec.ts:38` `toHaveLength(15)` → `18`；
   - `v051-content-batch2.spec.ts:44` `toHaveLength(15)` → `18`，并把 `defs.slice(9)` 收窄为 `defs.slice(9, 15)` 以**保持「批次 2 六个」的原语义**（新任务追加在末尾，不插队）；
   - `v051-mission-foundation.spec.ts:21` `toHaveLength(15)` → `18`、`:95` `toBe(15)` → `18`。
   - 其余断言（前三任务 ID 顺序、批次 1/2 六个 ID、4 个年龄带、5 种表达形式、唯一 communication 任务、种子世界不伪完成、localStorage key 不含 learner、旧 `quest.updated` 三任务）**逐字不动**。
4. **不新建平行内容入口**：3 个电力任务并入既有 `ALL_MISSIONS`，走 schema v2 + 既有 `MissionRuntimePlugin` / `EvaluatorRegistry` / `MissionSidebar`；不新增第 4 个 localStorage key，不改 `WorldSnapshot v1`，不删 `quest.*` / `quest-panel`。
5. **逐条登记**：每个被修改的既有断言在 §2 登记文件、位置、原值、新值、理由；未列入 §2 的既有测试文件一律零改动。

## 2. 逐条变更清单（实现后按实际 diff 复核）

### 2.1 E2E（仅 3 个 V0.51 文件）

| # | 文件:行 | 原值 | 新值 | 语义是否改变 | 理由 |
|---|---|---|---|---|---|
| E1 | `e2e/v051-content-batch1.spec.ts:21,38` | 标题「15 个任务」+ `toHaveLength(15)` | 标题「18 个任务」+ `toHaveLength(18)` | 否（仍断言 Content Pack 全量） | 3 个电力任务追加到 `ALL_MISSIONS` 末尾 |
| E2 | `e2e/v051-content-batch2.spec.ts:32,44` | 标题「15 个任务」+ `toHaveLength(15)` | 标题「18 个任务」+ `toHaveLength(18)` | 否 | 同上 |
| E3 | `e2e/v051-content-batch2.spec.ts:47,49`（两处） | `defs.slice(9)` | `defs.slice(9, 15)` | 否（仍取「批次 2 六个」） | 追加的三个任务不能落进批次 2 切片；用显式上界保持原语义 |
| E4 | `e2e/v051-mission-foundation.spec.ts:21` | `toHaveLength(15)` | `toHaveLength(18)` | 否 | `getMissions()` 全量 |
| E5 | `e2e/v051-mission-foundation.spec.ts:95` | `toBe(15)` | `toBe(18)` | 否 | 档案容错重置后任务全量 |

### 2.2 单测（既有断言的期望值 / 集合适配）

| # | 文件:行 | 原值 | 新值 | 理由 |
|---|---|---|---|---|
| U1 | `src/content/knowledge/registry.test.ts:53-55` | 标题「19 个」+ `toBe(19)` | 「24 个」+ `toBe(24)` | V061-017 追加 5 个 `kp.electric.*` / 系统类知识点 |
| U2 | `src/content/knowledge/registry.test.ts:73-77` | `kp.electric.*` 未注册断言为 `false` | 断言 V0.6.1 已注册且仍在预留前缀表中 | ADR-0008 决策 3 的「本版仅预留」在 V0.6.1 被 Q-3 批准范围取代；保留「前缀表与查询函数不变」断言 |
| U3 | `src/content/knowledge/registry.test.ts:120` | `isRegisteredKnowledgePoint('kp.electric.circuit.closed') === false` | `true` | 该 ID 已实际注册 |
| U4 | `src/content/knowledge/missionGraph.test.ts:87-98` | `toHaveLength(15)` + 3 条边 | `18` + 4 条边（新增 A→B） | Q-3 定案「3 个电力任务 + 1 条链」；既有 3 条边逐字保留，新增边追加 |
| U5 | `src/plugins/mission/evaluators.test.ts:36,46` | `toHaveLength(15)` / `toBe(15)` | `18` | 3 个电力评估器注册到同一 `EvaluatorRegistry` |
| U6 | `src/plugins/mission/extendedEvaluators.test.ts:203` | `toHaveLength(15)` | `18` | `ALL_MISSIONS` 全量 |
| U7 | `src/plugins/mission/LearnerProfileProgressStore.test.ts:147,160` | `toHaveLength(15)` ×2 | `18` ×2 | `getMissions()` 全量 |
| U8 | `src/plugins/mission/MissionRuntimePlugin.test.ts:59-73` | `offered[0].missions` 15；`available` 12 | 18；`available` 14（新增 A/C available、B locked） | 全量 + 新增一条链使 locked 3→4 |
| U9 | `src/plugins/mission/MissionRuntimePlugin.test.ts:121` | `toHaveLength(15)` | `18` | 空能力注册表下全量任务均 unavailable |
| U10 | `src/content/missions/missions.test.ts:143-147` | 「`kp.electric.*` 前缀未注册、一律被拒」 | 「已注册的 `kp.electric.*` 被接受、未注册的电力点仍被拒」 | V061-017 实际注册后双模校验语义不变：只认已注册 ID；断言从「全拒」改为「按注册集合判定」，未注册仍拒绝（新增一条负例） |
| U11 | `src/plugins/mission/evaluators.test.ts:34-47` | 15 个 ID 清单 + `toHaveLength(15)` / `toBe(15)` | 18 个 ID 清单（追加 3 个电力评估器）+ `18` | 同一注册表唯一性断言，新增 3 个 ID 也逐条验证 `has()` |
| U12 | `src/plugins/mission/MissionRuntimePlugin.test.ts:59`、`src/plugins/mission/extendedEvaluators.test.ts:200`、`src/content/knowledge/missionGraph.test.ts:87` 等 | 测试标题里的「15 / 19 / 3 条边」 | 与新值一致的描述文字 | 仅描述性标题同步，不改变断言 |

> 单测断言语义均保持：唯一性、schema 校验、三任务 ID 顺序、4 个年龄带、5 种表达形式、唯一 communication 任务、证据字段、档案容错等一条未删。
> 实际运行结果：`npm test -- --no-file-parallelism` **326/326 PASS**、`npx playwright test --workers=1` **47/47 PASS**（含 V0.5 基线 20 条一行未改）。

## 3. 未改动清单（核验方式）

```bash
cd Castle_Academy_V0.1_Source
git diff --name-only -- e2e/diagnose.spec.ts e2e/diagnose-underground.spec.ts \
  e2e/first-playable.spec.ts e2e/layer-section.spec.ts e2e/persistence.spec.ts \
  e2e/water-quests.spec.ts        # 必须输出空
git diff --name-only -- src/core/world/WorldState.ts src/core/world/blocks.ts \
  src/plugins/mission/evaluators.ts        # blocks.ts / WaterPlugin / 渲染器属 Phase 1/2 既有改动；WorldState.ts 必须无改动
```

`WorldSnapshot v1`、既有 25 个 Block ID 与顺序、既有 `quest.*` / `mission.*` / `water.*` 事件名、15 个旧任务 ID 与 15 个旧 evaluator ID、3 个共享材质：全部保持零变更（新增只追加）。

## 4. 边界说明

- 本裁定**不豁免** `TASK_BREAKDOWN.md` 其它停止条件；若出现旧 E2E 失败、canonical 像素差、性能超配对噪声、安全文案缺失等，仍按 BLOCKED 上报。
- 本裁定**不预支** STOP GATE-2 签核；V061-024 仍需 owner 的 `FULLY SATISFIED` 与 E1~E9 截图评审。
- `15→18` 后 `isAllCompleted()` 覆盖的任务数增加，`castle.quests.allCompleted` 触发条件相应变化；E2E 全量回归须确认 V0.5 基线 20 条不受影响（旧 `quest.updated` 仍是 3 个水任务，不随内容扩展变化）。
