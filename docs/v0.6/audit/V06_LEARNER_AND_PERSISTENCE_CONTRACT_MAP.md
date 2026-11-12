# V0.6 Phase 0 — 学习者域与持久化契约映射

- **报告 ID：** V06_LEARNER_AND_PERSISTENCE_CONTRACT_MAP
- **日期：** 2026-11-12 · **性质：** FACT 契约清单（含路径 + 行号）
- **基线：** `768769b`

---

## 1. 学习者域类型（`src/plugins/learner/types.ts`，FACT）

| 符号 | 行号 | 实际值 |
|---|---|---|
| `AgeBand` | L8 | `"6-7" \| "8-10" \| "11-12" \| "13-15"` |
| `AGE_BANDS` | L10 | 上述 4 档只读数组 |
| `MissionStatus` | L12 | `"available" \| "active" \| "completed"`（**三态，无 locked**） |
| `MissionProgressEntry` | L14–20 | `{ status, evidence?: { completedAt, evaluatorId }, hintsUsed }` |
| `LearnerProfile` | L22–28 | `{ id, nickname, ageBand, createdAt, missionProgress }` |
| `LearnerProfileStore` | L30–34 | `{ version: 1, activeProfileId, profiles }` |
| `LearnerStore` | L37–41 | 可注入存储接口 `getItem/setItem/removeItem` |
| `LEARNER_STORAGE_KEY` | **L43** | `"castle.academy.learner"` |
| `LEARNER_EVENTS` | L46–50 | `created` / `switched` / `recovered` |
| `NICKNAME_MIN/MAX` | L67–68 | 1 / 16 |
| `validateNickname()` | L71–76 | trim 后长度校验，不收集真实姓名 |
| `isAgeBand()` | L78–80 | 枚举校验 |
| `isLearnerProfileStore()` | **L83–102** | 结构化校验；**L86 `store.version !== 1` 即 false** |
| `emptyStore()` | L104–106 | `{ version: 1, activeProfileId: "", profiles: [] }` |

**关键迁移落点（FACT + INFERENCE）：** `isLearnerProfileStore()` 在 L86 硬编码 `version: 1`。ADR-0010 的 v1→v2 迁移必须同时改：类型联合、`isLearnerProfileStore()` 的接受范围、`emptyStore()`、以及 `LearnerProfilePlugin` 的加载/容错分支。仅改类型而不改校验器，v2 档案会被判「损坏」并触发 `learner.profile.recovered` 重置 —— 这是最易漏的回归点，应写入 V06-015/016 单测。

既有 `MissionProgressEntry.evidence` **不是**掌握证据（FACT）：它只在任务 `completed` 时写 `{ completedAt, evaluatorId }`，是完成摘要。ADR-0010 的 `MasteryEvidenceRecord` 是不同概念（按知识点、由世界状态查询支撑），不得就地覆盖该字段语义，否则 V0.51 档案数据与 E2E 断言（如 `v051-mission-detail.spec.ts:46` 读 `hintsUsed`）会受影响。

---

## 2. localStorage key 全量盘点（FACT，共 3 个）

| key | 定义位置 | 用途 |
|---|---|---|
| `castle-academy-world-v1` | `src/plugins/persistence/PersistencePlugin.ts:39` (`storageKey`) | 世界快照 |
| `castle-academy-view-v1` | `src/plugins/persistence/PersistencePlugin.ts:40` (`storageKeyView`) | 图层/剖面视图状态（L117 `saveViewState`） |
| `castle.academy.learner` | `src/plugins/learner/types.ts:43` | 学习者档案 |

- `src/plugins/persistence/PersistencePlugin.ts:177` 与 `src/plugins/learner/LearnerProfilePlugin.ts:41` 都以可注入 `Store` 读取 `localStorage`，便于单测内存化。
- 既有断言（FACT）：`src/plugins/mission/LearnerProfileProgressStore.test.ts:100–112` 检查世界 JSON 不含 `nickname` / `missionProgress` / 昵称值，学习者 JSON 不含 `blocks`，`JSON.parse(worldJson).version === 1`，且该测试夹具的 `Object.keys(store.data)` 恰为 **2 个 key**（世界 + 学习者；视图状态未写入）。

**红线（V0.6 非协商规则）：** 不得新增第 4 个 key；学习者数据一律不进世界快照。V06-024 的数据安全抽查应复用这些断言，并补充 v2 字段不进 worldJson。

---

## 3. 世界快照（`src/core/world/WorldState.ts`，FACT）

```ts
export interface WorldSnapshot {          // L9–12
  version: number;
  blocks: Array<{ x: number; y: number; z: number; blockId: BlockId }>;
}
const SNAPSHOT_VERSION = 1;              // L14
const VALID_BLOCK_IDS = new Set(BLOCKS.map(b => b.id));  // L16
```

| 行为 | 位置 | 说明 |
|---|---|---|
| `serialize()` | L56–66 | 输出 `{ version: SNAPSHOT_VERSION, blocks }` |
| `load()` | L68–80+ | 先校验全部方块、不修改原世界；任一非法即整体失败（**原子性**） |

**FACT：** `WorldSnapshot` 无 `orientation`、无朝向字段，无学习者字段。`blocks.ts` 有 **25 个** Block ID（`grep -c '^\s*{ id: "'` = 25）。

**零变更要求：** V0.6 新增的知识点 / 任务链 / 掌握证据一律不进世界存档。V0.6.1 的电力开关与阀门因此必须用两个 Block ID 表达状态（而非加 `orientation`/`powered` 字段），该约定已写入 V0.6.1 ADR-0011，本轮复核成立。

---

## 4. 容错与迁移路径（FACT + 提案）

`LearnerProfilePlugin`（`src/plugins/learner/LearnerProfilePlugin.ts`）：

- L38 `storageKey` 默认 `LEARNER_STORAGE_KEY`；L41 注入 `localStorage`。
- 既有单测 `LearnerProfilePlugin.test.ts` 覆盖：损坏 JSON（L98 `{"{not-json"`）、结构不合法（L114 `profiles: [{id:"x"}]`）、**不支持版本**（L120 `version: 2` → 容错重置）、恢复后档案数正确（L109）。

> ⚠️ **重要（INFERENCE）：** 现有 `LearnerProfilePlugin.test.ts:120` 已把 `version: 2` 当作「不支持版本 → 应容错重置」的用例。ADR-0010 落地 v2 后，该用例语义必须改写为「v2 合法档案应正常加载」，并另造 `version: 99` 覆盖真正的「不支持版本」。这是 V06-016 迁移/容错单测必须处理的既有断言，否则 v2 迁移测试会与旧护栏冲突。**该测试属 V0.51 单测，非 V0.5 基线 20 条 E2E，允许按 ADR 修改，但须在任务报告中逐项登记。**

ADR-0010 提案路径（**未实现，待 STOP GATE-1 批准**）：

| 输入 | 行为 |
|---|---|
| `version === 2` | 结构化校验后直接使用 |
| `version === 1` | 兼容读取 → 补齐新字段 → 原子升级写入 |
| 其他版本 / 损坏 JSON / 存储异常 | `emptyStore()` + `learner.profile.recovered` |

零丢失约束：保留 `id / nickname / ageBand / createdAt / missionProgress / activeProfileId` 全部值；新字段空数组；幂等可重放；写入失败不留半升级结构；多档案切换不串数据。

---

## 5. 「目标领域 ↔ 现有模块」差异结论

| 目标 | 可复用 | 需扩展 | 必须新建 |
|---|---|---|---|
| v2 档案 | `LearnerStore` 注入、`LEARNER_EVENTS.recovered` 容错通道、`validateNickname` | `LearnerProfileStore.version` 联合、`isLearnerProfileStore()`、`emptyStore()`、`LearnerProfilePlugin` 加载分支、旧 `version:2` 单测语义 | `MasteryEvidenceRecord` 类型（纯类型）及证据数组字段 |
| 证据产出 | 15 个 `evaluator.<slug>` 与世界查询接口 `EvaluatorQuery` | `EvaluatorResult` 只加证据字段，判定逻辑一行不改 | 无（不新建评估器框架） |
| 世界存档 | 全部 | 无 | 无（零变更） |

**FACT：** 不存在第二套持久化层；V0.6 只需在既有学习者域内演进，符合 `01_Execution/V06_Implementation_Plan.md` §1 的「复用 + 扩展」约束。
