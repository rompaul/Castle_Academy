# V0.7.1 P1–P6 实现报告

**版本：** V0.7.1（实验性工程设计原型） · **基线：** `v0.7.0` / `96e34fe`
**任务：** Repair the Royal Bridge / 修复王国旧桥

## P1 桥梁任务内容与知识片段

- 新增 `src/content/engineering/bridgeContent.ts`：故事、导师提示、H0–H4 提示阶梯、5 段知识图解、BR-01~BR-08 儿童友好文案、完成/失败文案、旧水井预告。
- 新增 `v071MissionContracts.ts` / `v071Missions.ts`：1 条 schema-v2 任务，20 字段零扩展；只追加到 `ALL_MISSIONS` 末尾（24→25）。
- 知识点 append-only 新增 3 个：`kp.measurement.area`、`kp.arithmetic.multiplication`、`kp.engineering.material_count`（owner D3 授权，24→27）。
- 新增 `BridgeSession.ts` 与 `session.ts`：7 阶段状态机，合法回退与非法跳转拒绝均有单测。

## P2 工程设计逻辑

- `design.ts` 纯函数：`computeBridgeDesign`、`validateBridgeDesign`（BR-01~BR-08）、`createBridgeBlueprint`、`bridgeDeckBounds`、`cellWorldPosition`、`isBlueprintContinuous`、`coversBothBanks`、`createConstructionEvidence`、`isConstructionComplete`。
- 场景参数：河宽 6、右岸搭接 1、桥长 8–10、桥宽 3–4、预算 40、每格 1 块；桥右端固定 x=14，合法长度均在世界边界内。
- 15 条新增纯函数/会话单测全绿。

## P3 设计工作台 UI

- `V071BridgeWorkbench.tsx` + `v071.css`：局部网格地图、测量端点、长度/宽度滑杆、实时面积与材料、知识卡、分级提示、步骤条、施工 HUD、完成预告。
- 测量复用 `MeasurementPlugin.measureDistance()`；网格同轴测量按覆盖格数 +1 读数；挑战在挂载时设置、卸载时清除。
- 所有 UI 为 `position: fixed` DOM overlay，只使用 `--ca-*` token；App 的 typing guard 与滚轮/快捷键守卫覆盖工作台。

## P4 蓝图转施工场景

- `V071BridgeScene.ts`：河道、桥头、半透明 ghost 只在任务期间存在于临时 Three.js Group；不写 WorldState / WorldSnapshot。
- 蓝图由 `createBridgeBlueprint()` 生成，世界坐标由 `cellWorldPosition()` 单一映射；进入施工时一并存入既有 `BlueprintPlugin`（只存数据，不自动落方块）。
- `bridgeEvaluators.ts`：只读 `EvaluatorQuery.bridgeEvidence` 的确定性评估器；未注入时 0 进度，既有 24 个评估器零影响。

## P5 完成奖励与资源预告

- `V071ProgressStore.ts`：新增第 4 个 key `castle.academy.v071.progress`（owner D2 授权），schema v1，只存任务/奖励 ID；幂等、损坏回退、下一次写入自愈。
- 任务完成时写入 `resourceKit.masonry_basic`；工作台显示基础石砌材料包与旧水井预告；地图桥面格在完成态变为完成色。

## P6 测试与发布候选

- 期望值适配清单见 `V071_EXPECTATION_ADAPTATION.md`。
- 新增 E2E `v071-bridge-design.spec.ts`：主流程与失败路径各 1 条。
- 安全抽查脚本 `scripts/v071-safety-spotcheck.mjs`：4 key 白名单、禁用词 0 命中、第 4 key 无自由文本。
- 发布候选复验结果见 `V071_RELEASE_CANDIDATE_REPORT.md`。
