# V07-001 · 持久化与隐私报告（只读审计）

**状态：** FACT 为主；§6 为 INFERENCE 风险判断。本版 Phase 0 未改任何存储代码。

## 1. 3 个 localStorage key（FACT）

| # | key | 定义 | 写入 |
|---|---|---|---|
| 1 | `castle-academy-world-v1` | `src/plugins/persistence/PersistencePlugin.ts:39` | `:85` |
| 2 | `castle-academy-view-v1` | `PersistencePlugin.ts:40` | `:121`（`saveViewState`） |
| 3 | `castle.academy.learner` | `src/plugins/learner/types.ts:59`（`LEARNER_STORAGE_KEY`） | `LearnerProfilePlugin.ts:231-238` |

白名单常量（FACT）：`scripts/v061-safety-spotcheck.mjs:142-147` 的 `knownKeyWhitelist` 恰为上述 3 个；`docs/v0.6.1/V061_028_030_Report.md:14` 与 `V061_Safety_Spotcheck.json` 记录 V0.6.1 抽查结果「3 个既有 key、零新增 key」。

## 2. 世界快照与字段隔离（FACT）

- `WorldSnapshot { version: number; blocks: Array<{x,y,z,blockId}> }`，`SNAPSHOT_VERSION = 1`（`src/core/world/WorldState.ts:9-12,14`）；`serialize()` 写 version，`load()` 对 `version !== 1` 直接拒绝（`:56-84`）。**V0.7 零变更**。
- 学习者档案：`LearnerProfile { id, nickname, ageBand, createdAt, missionProgress, masteryEvidence? }`（`learner/types.ts:35-43`）；`LearnerProfileStore.version: 1|2`，`isLearnerProfileStore()` 只接受 `1|2`（`:45-50,98-129`），`emptyStore()` 返回 `version: 2`（`:131-133`），V1→V2 迁移幂等补 `masteryEvidence: []`。
- `MasteryEvidenceRecord` **5 字段**：`missionId` / `evaluatorId` / `knowledgePointId` / `completedAt` / `observation`（`:27-33`）；`LearnerProfilePlugin.ts:128-139` 只追加、不修改、不去重，注释明写「绝不写入世界存档」。
- 字段隔离硬断言：`src/plugins/mission/LearnerProfileProgressStore.test.ts:81-113`（核心 `:103-111`）—— 世界存档 JSON 不含 `nickname` / `missionProgress` / 昵称字面量，档案 JSON 不含 `blocks`，`version === 1`，且 `Object.keys(store.data)` 恰为 2 个 key（世界 + 学习者）。
- E2E 侧：`e2e/v051-mission-foundation.spec.ts:27,44-45,83`、`v051-onboarding.spec.ts:23,49`、`v051-mission-detail.spec.ts:45`；`v051-content-batch2.spec.ts:60-71` 断言「交流类任务文字证据只校验最短长度、不写入任何存档」。

## 3. `textEvidence` 生命周期 —— 与起草期契约不符（重要，FACT）

| 事件 | `textEvidence` 是否清空 | 位置 |
|---|---|---|
| 声明 | `private readonly textEvidence = new Map<string,string>()`，运行时内存 | `MissionRuntimePlugin.ts:95-96` |
| 写入 | `submitTextEvidence()` → `trim` → 非空 → `set` → `structuralDirty=true` → `evaluate()` | `:307-319` |
| 暴露 | `baseQuery()` 以 `ReadonlyMap` 注入 `EvaluatorQuery.textEvidence` | `:371` |
| **档案切换 / 新建 / 损坏重置**（`onExternalChange`） | ✅ **清空** | `:159-171`（`:165`） |
| **读档 / 重置**（`resetEvaluation()`） | ❌ **不清**（也不清 `structuralDirty`）；只清 `everWet / measurementUsed / allCompletedNotified / completionSuppressed / seenLocked / unlockedNotified` | `:286-300` |
| `refresh()` | ❌ 不清，只调 `evaluate()` | `:302-305` |
| `reloadFromStore()` | ❌ 未涉及，只清 `states` / `completedNotified` | `:338-363` |
| 调用点 | `ThreeWorldRenderer.ts:569,824`（读档/重置）、`:347`（refresh） | — |

**影响（INFERENCE）：** ADR-0015 决策 2 与 `01_SCOPE` §6 要求「读档 / 重置 / `refresh()` 清空」；现有 `textEvidence` 只在档案切换时清。V0.7 新增的观察日志、变量对照、决策序列若照抄现有 `textEvidence` 生命周期，会**读档后残留**，撞 `R-710`。`V07-005` 必须显式在 `resetEvaluation()` / `refresh()` / `dispose()` 补清空并写生命周期测试；既有 `textEvidence` 语义是否一并修正须在实现期按 ADR-0015 决定（本版不改既有 18 任务行为）。

## 4. AI / 网络 / 随机 / 时间检索（FACT）

| 模式 | 实现调用 | 说明 |
|---|---|---|
| `fetch` / `XMLHttpRequest` / `WebSocket` / `openai` / `anthropic` / LLM SDK / 云账号 | **0 处实现调用** | 命中全为测试禁用正则字面值、安全抽查脚本字符串、V0.6/0.51 报告文字 |
| `Math.random` | 1 处：`LearnerProfilePlugin.ts:242`（`newId()` 在 `crypto.randomUUID` 不可用时的回退） | 不参与判定链 |
| `Date.now` | `EventBus.ts:33,36`、`BlueprintPlugin.ts:98,105,121,155`、`LayerPlugin.ts:68,103,138,155,185`、`PersistencePlugin.ts:88,107`、`LearnerProfilePlugin.ts:242` | 全部是事件 `timestamp` / `createdAt` / 回退 ID；`types.ts:25` 注明 `completedAt` 不参与任何掌握度计算 |
| 外部请求 | `styles.css:1` Google Fonts `@import`（O-1，V0.5 既存） | 本版不修、不新增 |

**判定链（FACT）：** `MissionRuntimePlugin.evaluate()`（`:377-469`）→ 注册评估器 `evaluate(EvaluatorQuery)`（`:396`）→ `EvaluatorResult {progress, complete, evidence.observation}` → `MasteryEvidenceRecord`（`:439-447`）→ `recordMasteryEvidence`（`LearnerProfilePlugin.ts:133-139`）。全为只读查询的确定性计数，**AI 零参与**。`dependencies` 仅 `@vitejs/plugin-react` / `lucide-react` / `react` / `react-dom` / `three`；`devDependencies` 无 LLM / HTTP 客户端（`package.json:16-32`）。

## 5. 三条安全文案与术语表（FACT）

V0.6.1 的首次引导 / 帮助面板常驻 / 家长教师说明三条电力安全文案与 `src/content/electrical/glossary.ts` 唯一真源零改动（审计时 `git status` 为空）。`registry.test.ts:67-72` 对知识点 label/summary 扫禁用词 `/等级|难度|年级|tier|level|percent|百分比|掌握度/i`。V0.7 新增文案不得出现识别性术语、真实电气数值或布线步骤（`PRODUCT_DEFINITION.md` §5.6、`R-718`）。

## 6. V0.7 数据边界检查清单（供 `V07-028` 复用）

1. `localStorage` key 集合 ⊆ 3 个白名单，零新增 key；
2. 世界存档 0 `nickname` / `missionProgress` / 反思文本 / 观察 / 决策记录；档案 0 `blocks` / 世界字段；
3. `MasteryEvidenceRecord` 仍 5 字段，不由自由文本生成；
4. 新增运行时记录有显式上限、溢出策略、读档 / 重置 / `refresh()` / `dispose()` 清空；
5. 完成 / 掌握 / 证据 / 奖励四条链无 LLM / `fetch` / 云调用；
6. `pageErrors []`，无新增外部请求（O-1 白名单外 0 条）；
7. M6 / M7 文案明示「本地、不保存、不上传」。

**本版 Phase 0 抽查状态：NOT RUN**（浏览器运行时抽查属 `V07-028`，STOP GATE-2 之后）。
