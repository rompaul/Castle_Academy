# V061 Phase 2 实现证据（V061-009~016）

**日期**：2026-11-13
**批准基线**：tag `v0.6.0` / `0bd6e4f`
**性质**：FACT —— 全部为实际实现与实际运行结果的记录；未运行的证据保持 NOT RUN。

## 1. 实际命令与退出码

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | exit **0** |
| `npm test -- --no-file-parallelism` | **310 / 310 PASS**（V0.6 基线 256 + V061-004~016 共 54 条新增），exit **0** |
| `npm run build` | exit **0**（仅既有 chunk size 警告） |
| `npx playwright test --workers=1` | **47 / 47 PASS**，exit **0**；**V0.5 基线 20 条一行未改** |
| `node scripts/v061-electrical-visual.mjs` | exit **0**，`pageErrors: []` |

## 2. 新增 / 修改文件

| 文件 | 任务 | 说明 |
|---|---|---|
| `src/plugins/electrical/events.ts` | 010/014 | 3 个 `electric.*` 事件名、版本化 payload 类型、`PumpOutputPort` 窄端口 |
| `src/plugins/electrical/query.ts` | 010 | `ElectricalQuery` 只读查询契约（含 `isPumpOutputActive`） |
| `src/plugins/electrical/ElectricalPlugin.ts` | 009/011/014 | 生命周期、合并重算、有界 / 重入保护、事件 diff 发布 |
| `src/plugins/electrical/ElectricalPlugin.test.ts` | 009/010/011/014 | 10 条契约测试 |
| `src/plugins/electrical/electricalWater.integration.test.ts` | 016 | 7 条 AC-6723~6730 集成测试 |
| `src/plugins/water/WaterPlugin.ts` | 015 | 注入端口、订阅 `electric.network.changed`、`sources` 并入泵出口、阀门适配层 |
| `src/rendering/ThreeWorldRenderer.ts` | 012/013 | composition root 注入、双态 overlay、独立材质实例、剖面兼容、测试钩子 |
| `scripts/v061-electrical-visual.mjs` | 012/013 | 运行时 draw call / overlay / 剖面实测脚本 |

`WaterSim.ts` / `WorldState.ts` / `EventBus.ts` / `WorldSnapshot v1` / 既有 25 个 Block ID / 既有事件名 / 15 任务 / 15 评估器 **零变更**。

## 3. V061-012 双态视觉实测（Q-1 照批方案）

运行时实测输出（`node scripts/v061-electrical-visual.mjs`）：

| 场景 | draw calls | overlay 段数 | 独立 lit 材质 | 灯状态 | 页面异常 |
|---|---|---|---|---|---|
| 干净世界（无电力方块） | **329** | 0 | 0 | — | 0 |
| 通电链路（5 方块） | **338** | **4** | **1** | `powered` | 0 |
| 开关断开 | — | **2**（源侧仍亮，逐段点亮） | 0 | `switch-open` | 0 |
| 剖面视图（x=2 positive） | 149 | 4（数量不变，走同一裁切路径） | — | — | 0 |

- **干净世界 329 dc 与 V0.6 基线逐值一致**；通电场景 +9 = 5 个方块 mesh + 4 个 overlay 段，归因清晰。
- 通电导体用**一个共享 wireframe 几何体 + 一个共享材质**逐段点亮；负载用 `base.clone()` 的**独立材质实例** emissive；
  3 个共享 `MeshStandardMaterial` 一个字节未改，未烘焙第二套纹理（atlas 仍 49/64）。
- 上限 `MAX_ELECTRICAL_OVERLAY_SEGMENTS = 64`：超限退化为 DOM 状态消息（Q-1 fallback），draw call 增量有上界。
- 两态可逆：合上 → 灯亮 / 4 段点亮；断开 → `switch-open` / 2 段点亮，视觉与状态消息口径一致。
- 形状（wireframe 轮廓）+ 亮度同时变化，不只靠颜色（AC-6735 的渲染层证据）。

## 4. V061-013 图层 / 剖面兼容

- overlay mesh 加入对应 `layerRenderAdapter` 分组，并调用既有 `applySectionViewSingle()`；
  `applySectionView()` 新增遍历 overlay 集合，剖析视图不破坏可见性。
- E2E 47/47 全绿，其中 `layer-section.spec.ts` / `diagnose-underground.spec.ts` / 蓝图 / 测量相关用例均未改。
- overlay `userData.kind = "electrical-overlay"`，不进入 `blockMeshes`，因此射线拾取、选中、测量、移除逻辑不受影响。

## 5. 事件顺序与事件环守卫（ADR-0011 决策 9）

```
world.block.placed / removed / world.blueprint.placed
  → ElectricalPlugin markDirty（microtask 合并，同 tick 只重算一次）
  → computeElectricalNetwork() 全量有界重算
  → electric.network.changed（先发布不可变结果）
  → electric.load.state.changed / electric.pump.state.changed（仅 diff）
  → WaterPlugin 比较 pumpActiveKeys 后按需 markDirty → 水重算一次
  → water.* 事件（不反向触发电力重算）
```

- `ElectricalPlugin` 只订阅 `world.block.*` 与 `world.blueprint.placed`，**不订阅任何 `water.*`**；
  无关方块变更直接忽略（AC-6708）。集成测试 AC-6727 发射 `water.flow.updated` / `water.simulation.tick` 后
  电力重算次数不变、无 `electric.network.changed`。
- 合并预算 `MAX_MERGED_RECOMPUTES = 16`，重入保护 `recomputing` 标志；无 `setInterval`、无每帧图扫描。
- 水侧只依赖 `PumpOutputPort.isPumpOutputActive()` 窄端口，不 import `ElectricalPlugin` 私有实现。

## 6. V061-015 / 016 水电联动

- 泵出口 = 通电泵正上方 `y+1` **空格**并入 `sources`；被占据时不伪造出水（AC-6724/6729）。
- 阀门适配层：`water_valve_open` 在 `WaterWorldQuery.hasBlock/blockAt` 视为空格（水贯通）；
  `water_valve_closed` 仍是方块（V0.5 语义终止）。`WaterSim.ts` 规则函数零变更。
- AC-6728：既有纯水场景（7×7 石地 + 水源）在注入端口前后的水格集合**逐值一致**。
- AC-6726：移除电源后泵输出关闭、水格清空，无陈旧残留。
- 端口缺失时灯 / 信标仍可用、水侧不出水（AC-6729）。

## 7. 仍 NOT RUN / 后续任务

- D-2 同机同脚本 ABBA 性能配对 → V061-026（本文件是单点实测，不是配对判定）。
- V0.6 canonical 锚点视觉回归（DEV-608 脚本改造）→ V061-025。
- E1~E9 UI 对照、状态消息 6 类、术语表与安全文案 → V061-019/022/023。
- 角色 B 独立验收 + STOP GATE-2 → V061-024。
