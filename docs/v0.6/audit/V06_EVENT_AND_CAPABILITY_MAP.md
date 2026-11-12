# V0.6 Phase 0 — 事件与能力映射

- **报告 ID：** V06_EVENT_AND_CAPABILITY_MAP
- **日期：** 2026-11-12 · **性质：** FACT 清单
- **基线：** `768769b` · 提取命令：`grep -rhoE '"(mission|quest|learner|water|view|world)\.[a-zA-Z0-9._-]+"' src/ | sort -u`

---

## 1. 事件名全表（FACT）

### 1.1 任务域 `mission.*`（`src/plugins/mission/events.ts` `MISSION_EVENTS`）

| 常量 | 事件名 | payload 接口 |
|---|---|---|
| `offered` | `mission.offered` | `MissionOfferedPayload { missions: MissionSummary[] }` |
| `activated` | `mission.activated` | `MissionActivatedPayload { missionId }` |
| `progressUpdated` | `mission.progress.updated` | `MissionProgressUpdatedPayload { missionId, progress, complete }` |
| `completed` | `mission.completed` | `MissionCompletedPayload { missionId, successMessage, reward? }` |
| `rewardGranted` | `mission.reward.granted` | `MissionRewardGrantedPayload { missionId, reward }` |

### 1.2 迁移窗口（**红线：V0.6 禁止删除**）

| 事件名 | 定义位置 |
|---|---|
| `quest.updated` | `src/plugins/mission/evaluators.ts:79` `QUEST_UPDATED_EVENT` |
| `quest.completed` | `evaluators.ts:80` `QUEST_COMPLETED_EVENT` |
| `castle.quests.allCompleted` | `evaluators.ts:78` `ALL_QUESTS_COMPLETE_EVENT` |

旧 `quest-panel` DOM 组件亦须保留：V0.5 基线 20 条 E2E 依赖它。V0.51 已因这个原因顺延一次清理窗口，V0.6 执行包再次顺延到 **V0.6.1 之后**。

### 1.3 学习者域

| 事件名 | 定义位置 | payload |
|---|---|---|
| `learner.profile.created` | `learner/types.ts:47` | `{ profileId, nickname, ageBand }` |
| `learner.profile.switched` | `learner/types.ts:48` | `{ profileId }` |
| `learner.profile.recovered` | `learner/types.ts:49` | `{ reason: "corrupt" \| "unsupported-version" \| "storage-error", message }` |

### 1.4 水 / 视图 / 世界域

```
water.flow.updated        water.pipe.state.changed      water.simulation.tick
view.mode.changed
world.block.placed        world.block.removed
world.blueprint.placed    world.blueprint.deleted       world.blueprint.saved
world.building-tools.line-placed    world.building-tools.rectangle-filled
world.hover.info          world.loaded                  world.saved
```

`water.simulation` 是**能力 ID**（见 §2），不是事件名；`mission.<slug>.v1` 形式的字符串是任务 ID，不是事件。

### 1.5 v2 新事件的约束（ADR-0009 §8，提案）

若 V06-012 需要 `mission.unlocked`：必须版本化、结构化 payload、走既有 `EventBus` DomainEvent 信封、写契约测试，并在 ADR-0009 批准后填入确切名称。**不得改任何既有事件名**。Phase 0 未决定是否需要新事件（见 `V06_OPEN_QUESTIONS_AND_RISKS.md` §5）。

---

## 2. 能力注册表（FACT，`src/plugins/mission/CapabilityRegistry.ts`）

`createV051Capabilities()`（L46–53）注册 **4 项**：

| 能力 ID | 默认值 |
|---|---|
| `building.basic` | `true` |
| `water.simulation` | `true` |
| `layers.section` | `true` |
| `measurement.distance` | `true` |

API：`register()` L12 / `isAvailable()` L16（异常返回 false）/ `missing()` L27 / `setAvailable()` L32（测试钩子）/ `unregister()` L36 / `ids()` L40。

**FACT：** 未注册的能力 = 不可用；任务启动前检查 `requiredCapabilities`，缺失时显示「暂不可玩」（S8），不隐藏、不阻塞建造。E2E `v051-mission-detail.spec.ts:54+` 与视觉回归脚本用 `setCapabilityAvailable("measurement.distance", false)` 验证。

`MissionProgressStore` 接口（L59–64）含 `get / set / onExternalChange?`（档案切换重载），`InMemoryMissionProgressStore`（L66–82）为内存实现；V0.51 已由 `LearnerProfileProgressStore` 适配器接入学习者域。V0.6 应复用，不得新建第二套进度存储。

**INFERENCE：** V0.6 的 `locked` 与 `unavailable` 都应是派生视图态；`CapabilityRegistry.missing()` 已提供「能力缺失」判定，先决条件图提供「前置未完成」判定，两者可组合进 `MissionSummary.status`，无需改持久化三态。

---

## 3. 测试钩子 `window.__CASTLE_TEST__`（FACT）

- 挂载：`src/rendering/ThreeWorldRenderer.ts:245`，仅 `import.meta.env.DEV`。
- 卸载：同文件 L671（DEV 下删除）。
- 关键项（L245–275+）：
  - 世界：`getBlockCount`, `hasBlock`, `placeBlock`, `removeBlock`, `reset`, `getPlayerPosition`, `setPlayerPosition`
  - 渲染：`getRenderInfo() → { drawCalls, triangles, textures, geometries }`
  - 图层：`getLayerVisibility`, `setLayerVisibility`, `getSectionView`, `setSectionView`
  - 水：`getWater() → { cells, isConverged, hasWater }`
  - 任务：`getQuests`, `getMissions`, `getMissionDefinitions`, `placeWaterSource`（视觉/性能脚本使用）
  - 学习者：`getActiveProfile`, `listProfiles`, `setProfile`, `setCapabilityAvailable`

**FACT：** `v051-perf.mjs` 与 `v051-visual-regression.mjs` 均依赖 `waitForFunction(() => Boolean(window.__CASTLE_TEST__))`，5173 dev server 必须处于 DEV 模式。

**INFERENCE：** V0.6 的 K1~K6 截图与新知识/证据 UI 若需新钩子，应遵循「只追加、不覆盖 V0.5 既有项」的既有注释约定（L266），并同步写 E2E 契约测试。

---

## 4. 设计系统与视觉锚点（FACT）

| 项 | 实际值 |
|---|---|
| token 文件 | `src/ui/tokens.css`（1963 bytes），`src/ui/tokens.test.ts` 4 个单测 |
| DDR | DDR-0001 Approved（V0.51），冻结；V0.6 **不新增 DDR** |
| canonical | `docs/v0.51/screenshots/canonical/` 共 **10 张**：`s1-onboarding-nickname` … `s8-mission-unavailable`、`world-canvas-anchor-v051`、`world-clean-v051` |
| 回归产出 | `docs/v0.51/screenshots/diffs/` 3 个文件：`visual-regression.json`、`world-main-diff.png`、`world-main-v051.png` |
| 脚本 | `scripts/v051-visual-regression.mjs`（1280×800 与 1280×720 双视口）、`scripts/v051-perf.mjs`、`scripts/v042-perf.mjs` |

**红线：** overlay 为 `position:fixed`，不得改变 canvas 视口尺寸；`worldCanvas` 分区（x≥320, 76≤y<684）零容差 0 像素差；新 UI 只用现有 token，不新增硬编码颜色。

---

## 5. AI / LLM 零参与（FACT）

依赖树中的外部包仅 `@vitejs/plugin-react`, `lucide-react`, `react`, `react-dom`, `three`（运行时）与 `@playwright/test`, `@types/*`, `typescript`, `vite`, `vitest`（开发）。**无 LLM / AI SDK**。全库检索 `knowledgePoint|knowledgeGraph|mastery|progression|curriculum|openai|anthropic|langchain|llm|@ai-sdk` 零实现命中（唯一命中的 `fillMoat` 为 `llm` 子串假阳性）。

评估器确定性护栏：`src/plugins/mission/evaluators.test.ts:53`、`extendedEvaluators.test.ts:98` 断言源码不含 `Math.random|Date.now|new Date(|fetch(|localStorage|window.`。

**INFERENCE：** V0.6 的 Registry 建成后可作为 V0.9「AI 只能引用已注册 ID」的锚点；本版不引入任何 AI 组件，且完成/掌握判定链路由确定性评估器独占。
