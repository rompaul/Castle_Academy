# V0.7.1 期望值适配清单

**日期：** 2026-11-16 · **基线：** `v0.7.0` / `96e34fe`
**依据：** owner D2（第 4 个 localStorage key）与 D3（知识点 24→27）授权变更；沿用 V0.6.1 DEV-613「先记录失败，再按批准清单逐条适配」先例。

## 1. 契约变更（owner 已拍板）

| 项 | V0.7.0 | V0.7.1 | 来源 |
|---|---:|---:|---|
| 任务定义 | 24 | 25 | 追加 `mission.bridge-repair.v1`，既有 24 个 ID / 顺序 / 文案零改动 |
| 评估器 | 24 | 25 | 追加 `evaluator.bridge-repair`，注册在同一默认注册表末尾 |
| 知识点 | 24 | 27 | append-only 新增面积 / 乘法 / 材料数量 3 个 ID，旧 ID 零改动 |
| 先决边 | 5 | 5 | 桥梁任务 `prerequisiteMissionIds: []`，不新增边 |
| localStorage key | 3 | 4 | 新增 `castle.academy.v071.progress` |
| 先决链 | 5 | 5 | 图无环、无悬空，V0.7 六任务关系零改动 |

## 2. 单元测试适配（19 条 → 全绿）

| 文件 | 适配点 | 原因 |
|---|---|---|
| `src/content/electrical/glossary.test.ts` | `ALL_MISSIONS` 24→25；`graph.order` 24→25；edges 仍 5 | 任务总数增加、桥梁无前置 |
| `src/content/knowledge/missionGraph.test.ts` | `order` 24→25；标题标注 V0.7.1 无新边 | 同上 |
| `src/content/knowledge/registry.test.ts` | `KNOWLEDGE_POINTS.length` 24→27 | D3 append-only 新增 |
| `src/content/missions/interactiveMissions.test.ts` | 任务数 / 唯一数 24→25；知识点 24→27；`slice(18)` → `slice(18,24)` | 6 个 V0.7 任务仍紧跟第 18 位，桥梁在其后 |
| `src/content/missions/v07LearningSupport.test.ts` | `graph.order` 24→25；边数仍 5 | 桥梁无前置 |
| `src/content/missions/v07MissionContracts.test.ts` | 任务 / 评估器 24→25；知识点 24→27；`slice(18,24)` | 同上 |
| `src/plugins/mission/evaluators.test.ts` | 注册表 24→25 | 新评估器追加 |
| `src/plugins/mission/interactionContracts.test.ts` | 注册表 24→25 | 同上 |
| `src/plugins/mission/extendedEvaluators.test.ts` | `ALL_MISSIONS` 24→25 | 同上 |
| `src/plugins/mission/LearnerProfileProgressStore.test.ts` | `getMissions()` 24→25 | 同上 |
| `src/plugins/mission/MissionRuntimePlugin.test.ts` | offered 24→25；available 19→20；能力缺失列表 24→25 | 桥梁任务无前置，初始 available |
| `src/ui/mission/V07FormInteractions.test.ts` | `ALL_MISSIONS` 24→25；`slice(18,24)` | V0.7 白名单仍恰好 6 个 |
| `src/ui/mission/v07UiTokens.test.ts` | typing guard 断言字符串随实现重构改为 `isTypingTarget(target)` | 语义不变，仍先于快捷键处理 |

## 3. E2E 适配（3 文件）

| 文件 | 适配点 |
|---|---|
| `e2e/v051-mission-foundation.spec.ts` | 全量任务数 24→25（2 处） |
| `e2e/v051-content-batch1.spec.ts` | 全量定义数 24→25 |
| `e2e/v051-content-batch2.spec.ts` | 全量定义数 24→25 |

**V0.5 基线 20 条 E2E 逐字节零改动。**

## 4. 新增测试

- 纯函数 / 状态机 / 会话 / 进度存储：4 文件 19 用例全绿。
- E2E：`e2e/v071-bridge-design.spec.ts` 2 条（主流程 + 失败路径）全绿。

## 5. 复验结果

| 项 | 结果 |
|---|---|
| typecheck | 0 |
| build | 0（既有 chunk-size 警告） |
| 单元测试 | 59 文件 / 427 用例全绿 |
| E2E | 见发布候选复验报告 |
| `git diff --check` | 见发布候选复验报告 |
