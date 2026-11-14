# V061-003 水 ↔ 电契约映射（V0.6.1）

**审计基线**：tag `v0.6.0` / `0bd6e4f`
**日期**：2026-11-13

## 1. WaterPlugin 只读契约（FACT）

`src/plugins/water/WaterPlugin.ts:40-46`：

```ts
export interface WaterQuery {
  hasWater(position: GridPosition): boolean;
  getWaterCells(): GridPosition[];
  isPipeFlowing(position: GridPosition): boolean;
  isConverged(): boolean;
}
```

`getQuery()` 实现 `:108-115`：返回闭包，`hasWater` 查 `applied` Map、`getWaterCells` 返回副本、`isPipeFlowing` 查 `appliedPipes` Set、`isConverged` 检查 pending 与 dirty。**结果为快照值，无可变引用泄露**。

## 2. 事件契约（FACT）

| 事件名 | payload | 发射点 |
|---|---|---|
| `water.flow.updated` | `WaterFlowUpdatedPayload { added, removed, reason: "source-changed" \| "recalculate" \| "tick" }`（`:29-33`） | `:202-207` |
| `water.pipe.state.changed` | `PipeStateChangedPayload { changed: Array<{position, flowing}> }`（`:36-38`） | `:215` |
| `water.simulation.tick` | `{ activeCells, pendingOps }` | `:171`（收敛）、`:218`（tick 末） |
| `world.block.placed` / `world.block.removed` | `{position, blockId}` / `{position}` | 订阅于 `:80-85` → `markDirty()` |

**事件名前缀检索（FACT）**：`src/` 中现有 `water.*`、`mission.*`、`quest.*`（迁移窗口）、`world.*`、`learner.*` 等；`electric.*` **0 命中**，无前缀冲突（见 `V061_REPOSITORY_BASELINE_REPORT.md` §3）。V061-010 仍须做一次正式契约测试并检索。

## 3. 水模拟规则与坐标语义（FACT）

`src/plugins/water/WaterSim.ts:3-18`：

1. 水只存在于**空格**（无方块的位置）；
2. **向下**：正下方为空格 → 流向正下方，水平计数清零，一路到底；
3. **水平**：当前格正下方非空（被方块/水支撑）→ 向四邻空格扩散，步数 ≤ `horizontalSpreadLimit`（默认 7）；
4. `drain_channel` 吸收并终止；
5. `water_pipe_blue` 与水源**正交连通**的管道链 = flowing；链上任一管道的正交空格为**出水口**（视为被支撑的源头，水平计数清零）。

`src/core/world/coordinates.ts`：`GridPosition {x,y,z}`；`WORLD_BOUNDS` X/Z `[-16,16)`、Y `[-32,64)`；`positionKey()` 生成确定性键；**无朝向持久化字段**。
`WaterSim` 为纯逻辑：无 DOM / Three.js / 随机数 / 墙钟 / 隐藏全局状态，全量 BFS 重算、键序排序保证可重放。

## 4. 源收集点与重算触发（Q-2 / ADR-0011 决策 9 关键）

`WaterPlugin.ts:125-134`（FACT）：

```ts
private recalculate(): void {
  const sources = this.world.all()
    .filter((record) => record.blockId === "water_source")
    .map((record) => record.position);
  this.target = computeWater({ world: {...}, sources, minY: -32 }, this.config);
  ...
}
```

触发链（FACT）：`world.block.placed/removed` → `markDirty()` (`:119-122`) → `recalculate()`；`activate()` 末尾 `refresh()` (`:88`)；`refresh()` (`:103-106`) 用于存档加载/重置；`setInterval(tick, 150ms)` (`:87`) 分批应用，单 tick ≤512 格。

**INFERENCE（集成点结论）**：`sources` 数组是**唯一**的水源入口。泵联动的最小侵入方式是在此处把「通电泵在约定出口产生的虚拟水源位置」并入 `sources`，不改 `computeWater()` 规则、不改 `WaterSim` 传播语义。这满足 ADR-0011 决策 8「通电泵在约定出口提供确定性虚拟水源，二值；不计算压力/流量/泵曲线」。

## 5. Q-2 泵几何定案（GATE-1 前关闭）

原稿提案「下方进 / 上方出」与 V0.5 水语义存在张力：水规则是**重力向下**，没有「消耗 / 逆向输送」概念，且出水口必须是**空格**。

**定案（本轮）**：
- **出口**：通电泵方块**正上方相邻空格**（`y+1`）注册为二值虚拟水源，并入 `recalculate()` 的 `sources`。该格下方被泵方块占据（非空）→ 按规则 3 水平扩散，形成可见水流；不引入反向重力。
- **进水侧**：「下方进」只保留为**儿童可见的叙事 / 视觉方向**（泵体下方需要有水或接水路），**不写成模拟规则**：不消耗水、不要求下方必须有水才能出水，也不修改 `computeWater()`。理由：V0.5 水源无限、无消耗模型；引入「必须有进水」会改水规则并破坏 V0.5 基线 20 条 E2E。
- **阀门**：`water_valve_closed` 阻断水路按「该格视为非空格 / 终止」处理，等价于既有 `drain_channel` 的吸收终止语义的变体，实现期在 `WaterWorldQuery.blockAt()` 适配层表达，不改 `WaterSim.ts` 规则函数。
- **朝向**：全部 `orientation: "fixed"`，`WorldSnapshot v1` 零字段变化。

**UNKNOWN**：上述「virtual source 并入 sources」与「阀门适配层」尚未写集成测试（V061-015/016 负责）。本轮只做契约对账，不写功能代码。

## 6. 事件顺序与重入保护（ADR-0011 决策 9 / 停止条件）

冻结顺序（写进 ADR 供签核）：

```
电力方块变更 (world.block.*)
  → ElectricalPlugin 重算（合并同 tick、有界）
  → 发布不可变 ElectricalQuery + electric.* 事件
  → 水侧通过 isPumpOutputActive() 只读端口读取泵/阀输入
  → WaterPlugin 重算一次（并入虚拟水源）
  → water.* 事件
```

**硬约束**：`water.flow.updated` / `water.simulation.tick` **不得**反向触发电力重算（除非确有电力方块变更）；`ElectricalPlugin` 不 import `WaterPlugin` 私有实现，反之亦然；禁止每帧全图扫描。V061-011/016 须写事件环守卫测试。

## 7. 差异表（本文件范围）

| 目标 | 现有 | 结论 |
|---|---|---|
| 泵输出端口 | 无 | **新建** `isPumpOutputActive()` 只读窄端口（V061-014） |
| 虚拟水源注入 | `recalculate()` 的 `sources` 唯一入口 | **需扩展**（最小侵入，不改 WaterSim） |
| 阀门阻断水路 | `drain_channel` 吸收语义 | **需扩展**（适配层表达，不改规则函数） |
| 水查询 | `WaterQuery` 4 方法 | **可复用**（电力评估器直接查询） |
| 事件前缀 `electric.*` | 0 命中 | **新建**，无冲突 |
| 事件环防护 | 无 | **新建**（V061-011/016） |
