# V061-004 持久化兼容性报告（V0.6.1）

**审计基线**：tag `v0.6.0` / `0bd6e4f`
**日期**：2026-11-13

## 1. WorldSnapshot v1（FACT，必须零变更）

`src/core/world/WorldState.ts:9-16`：

```ts
export interface WorldSnapshot {
  version: number;
  blocks: Array<{ x: number; y: number; z: number; blockId: BlockId }>;
}
const SNAPSHOT_VERSION = 1;
const VALID_BLOCK_IDS = new Set<string>(BLOCKS.map((block) => block.id));
```

`serialize()` (`:56-66`) 只输出 `version` + `blocks[]`，每块仅 `{x,y,z,blockId}`。**零学习者字段、零朝向字段、零派生态字段**。

## 2. 原子加载与前向兼容（ADR-0011 决策 14）

`WorldState.load()` (`:68-86`)：

- `version !== 1` 或 `blocks` 非数组 → 直接 `return false`；
- 逐块校验 `isInsideBuildArea(position)` 与 `VALID_BLOCK_IDS.has(block.blockId)`，**任何一块非法即整体失败**，先构造 `nextBlocks` 不修改原世界；
- 全部通过后才 `this.blocks = nextBlocks`（原子替换）。

**FACT 结论**：含 V0.6.1 新 Block ID 的存档在**旧版本**（未注册这 9 个 ID）加载时会被 `VALID_BLOCK_IDS` 拒绝并原子失败 —— 这正是 ADR-0011 决策 14 要求记录的既有行为，须写进 V0.6.1 已知限制。反之，旧存档在 V0.6.1 中仍可加载（`version` 不变、既有 ID 仍有效），**无需迁移**。

## 3. 开关 / 阀门状态表达（FACT + 定案）

- `WorldState` 公共 API：`place/remove/replace`（V061-008 将通过替换 `blockId` 切换 `switch_open ↔ switch_closed`、`water_valve_open ↔ water_valve_closed`）。
- 因为快照只存 `blockId`，**两个 ID 表达两态**即可完整存取，无需新字段、无需朝向、无需额外存储 key。
- `BlockModel.orientation` 只存在于注册表元数据（`blocks.ts:5-9`），不进快照；9 个新方块统一 `orientation: "fixed"`。

## 4. 学习者档案 v2（FACT）

`src/plugins/learner/types.ts`：

- `:27-33` `MasteryEvidenceRecord { missionId, evaluatorId, knowledgePointId, completedAt, observation }`；
- `:42` `LearnerProfile.masteryEvidence?: MasteryEvidenceRecord[]`；
- `:45-50` `LearnerProfileStore { version: 1 | 2; activeProfileId; profiles }`；
- `:99-103` `isLearnerProfileStore()` 接受 v1 与 v2；
- `:131-133` `emptyStore()` 返回 `version: 2`；
- `:135-143` `migrateLearnerProfileStoreV1toV2()`：只补 `masteryEvidence: []` 与 `version: 2`，幂等。

**契约影响**：V0.6.1 的电力任务完成时按知识点追加 `MasteryEvidenceRecord`，**直接复用** v2 结构，无需再迁移档案版本、无需新 key。V061-021 只负责产出证据记录。

## 5. localStorage key 盘点（FACT，必须仍为 3 个）

| key | 定义位置 | 内容 |
|---|---|---|
| `castle-academy-world-v1` | `PersistencePlugin.ts:39` | `WorldSnapshot v1` |
| `castle-academy-view-v1` | `PersistencePlugin.ts:40` | 视图状态 |
| `castle.academy.learner` | `src/plugins/learner/types.ts` `LEARNER_STORAGE_KEY` | 学习者档案 v2 |

全库检索（本轮）：`grep -rn "castle-academy\|castle\." src/plugins/` → 除测试用例外无第 4 个 key。
**停止条件**：新增第 4 个 key 即 BLOCKED。

## 6. 派生态不落盘（FACT + 约束）

- 水域：`WaterPlugin.applied` / `appliedPipes` / `target` 均为插件内存 Map/Set；`activate()` / `refresh()` 时全量重算（`WaterPlugin.ts:53-65, 88, 103-106`）。
- 电力（本版）：通电态 / 连通分量 / `pumpActive` 必须沿用同一模式，从 `WorldState` 重建，**绝不序列化**。
- 任务运行态：持久化三态 `available/active/completed` 在 `LearnerProfile.missionProgress`；`locked` / `unavailable` 是 `MissionSummary` 的**派生视图态**（`src/content/missions/types.ts:66+`），不落盘。

## 7. 迁移窗口（FACT）

`quest-panel` / `CastleQuestPlugin` / `quest.*` 双事件仍保留（V0.5 基线 20 条 E2E 依赖），清理**顺延到 V0.6.1 之后**。本版不得提前删除，否则 G0 停止条件触发。

## 8. 风险清单（本文件范围）

| 风险 | 等级 | 缓解 |
|---|---|---|
| 含新 ID 的存档在旧版本被原子拒绝 | 中（已知限制） | 写进 release notes 与家长/教师说明；不尝试「兼容旧版」而破坏 `version: 1` |
| 误把通电态写进 `WorldState` / 快照 | 高（停止条件） | V061-008/016 存档往返测试断言快照字段集合恒为 `{version, blocks[]}` |
| 新增第 4 个 localStorage key | 高（停止条件） | V061-028 数据安全抽查 |
| 档案 v2 再迁移 | 低 | 直接复用 `MasteryEvidenceRecord`，不改 `version` |
| `core.autocrlf=true` 造成 canonical stat 误报 | 中（流程） | 用 HEAD 原始字节覆盖，不以 `git status` 单次结果为准 |
