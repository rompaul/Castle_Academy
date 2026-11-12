# V0.6 Phase 0 — 仓库基线审计报告

- **报告 ID：** V06_REPOSITORY_BASELINE_REPORT
- **Task ID：** V06-001 / V06-002 / V06-003
- **日期：** 2026-11-12
- **性质：** 只读审计 + 既有基线测试；**零源码改动、零功能代码**
- **批准基线：** `master` HEAD `768769bac3ee84968ed087c5f14b98e1d300e414`（`768769b`）
- **状态：** Phase 0 完成；**STOP GATE-1 未签核**，ADR 仅为定稿待批

> 证据分级：**FACT** = 本轮实际命令 / 文件读取所得；**INFERENCE** = 由 FACT 推导的判断；**UNKNOWN** = 未验证或无法验证。未运行的检查一律写 `NOT RUN`，绝不推断 PASS。

---

## 1. 发布对象与 Git 基线（FACT）

| 项目 | 实际值 | 证据 |
|---|---|---|
| 分支 | `master` | `git branch --show-current` |
| HEAD | `768769bac3ee84968ed087c5f14b98e1d300e414` | `git log -1 --format=%H` |
| HEAD 提交 | `768769b docs: 同步应用内版本标识到 V0.5.1，重截 canonical 截图`（2026-11-10 19:42:07 +0800） | 同上 |
| 工作树 | **干净**（`git status --short` 无输出） | 审计开始 / 结束各一次 |
| `v0.5.1` → | `0821dbfb28406d145727da32f669ca757e044e01` | `git rev-list -n1 v0.5.1` |
| `v0.5.0` → | `6f5e244fbc459b1f39d17640516fd15760c2816d` | `git rev-list -n1 v0.5.0` |
| tag 全量 | `v0.5.1`, `v0.5.0`, `v0.4.0`, `v0.3.0`, `v0.2.0` | `git tag -l --sort=-creatordate` |
| `package.json` 版本 | `0.5.1` | 读取 package.json |
| 可用 scripts | `dev` / `build` / `preview` / `test` / `test:watch` / `test:e2e` / `typecheck` / `verify:source` | 同上 |

**FACT：** 与 V0.6 执行包 `01_SCOPE/V06_SCOPE_AND_ACCEPTANCE.md` §4、`09_GOVERNANCE/SOURCE_AND_ASSUMPTION_REGISTER.md` §1 登记的 `0821dbf` / `v0.5.1` / `768769b` 完全一致，无偏差。假设 A-1（登记册 §4）**已验证成立**。

**INFERENCE：** V0.6 功能代码的正确开发基线是 `768769b`（当前 master），而非 tag 指向的 `0821dbf`；后者是发布对象，中间还有 README 与应用内标识同步、canonical 重截等提交。ADR 的「批准基线 commit」应由 owner 在 STOP GATE-1 签核时确认填 `768769b`，本报告不代填。

---

## 2. 目标领域 ↔ 现有模块差异表

| V0.6 目标能力 | 现有模块（FACT，路径 + 符号） | 判定 | 说明 |
|---|---|---|---|
| 知识点稳定 ID / Registry | **无** | **需新建（纯数据）** | 全库检索 `knowledgePoint\|knowledgeGraph\|mastery\|progression\|curriculum` 零实现命中，见 §3 |
| Content Pack schema v2 | `src/content/missions/types.ts` `MissionDefinition` (L27–56)、`validateMissionDefinition()` (L76–120) | **需扩展** | 已有 `prerequisiteMissionIds: string[]` (L49) 占位；无 `schemaVersion`、无 `knowledgePointIds` |
| 15 任务无损迁移 | `castleWaterMissions.ts` / `waterExtensionMissions.ts` / `crossAgeMissions.ts` | **需扩展（只加字段与边）** | 15 个定义，全部 `prerequisiteMissionIds: []` |
| 先决条件图谱 | **无**；`MissionRuntimePlugin` 状态机为三态 | **需新建纯函数 + 扩展运行时** | 视图态 `unavailable` 已存在于 `MissionSummary.status` (types.ts L62) |
| 确定性掌握证据 | `LearnerProfile` / `MissionProgressEntry` (`learner/types.ts` L14–28)，已有 `evidence?: { completedAt, evaluatorId }` | **需扩展** | 现有 evidence 只是「完成摘要」，非按知识点的掌握证据 |
| 评估器产出证据 | `evaluators.ts` / `extendedEvaluators.ts`，15 个 `evaluator.<slug>` | **可复用 + 只扩展返回字段** | 判定逻辑不得改；已有确定性单测护栏 |
| 学习者档案 v1→v2 | `learner/types.ts` `LearnerProfileStore.version: 1` (L30–34)、`isLearnerProfileStore()` (L83–102)、`emptyStore()` (L104–106)、`LearnerProfilePlugin` | **需扩展（含容错）** | 现有结构化校验硬编码 `store.version !== 1` 即判损坏，v2 迁移必须同步改 |
| 任务 UI 挂载点 | V0.51 任务侧栏 / 详情；`src/ui/tokens.css` | **可复用** | DDR-0001 冻结，不新增 DDR |
| 世界状态 / 快照 | `src/core/world/WorldState.ts` `WorldSnapshot` (L9–12)、`SNAPSHOT_VERSION = 1` (L14) | **零改动（红线）** | 新数据一律不进世界存档 |
| 渲染 / 方块 | `blocks.ts` 25 个 Block ID、`textureGenerator.ts` atlas | **零改动（红线）** | V0.6 无 3D 资产变更 |

**FACT：** 未发现第二套 WorldState / EventBus / Renderer / Persistence / Mission Runtime / 评估器框架，V0.6 「复用 + 扩展」架构约束可满足。

---

## 3. 知识点层与 AI 零参与的检索证明（FACT）

检索命令（在 `src/` 全量 `.ts/.tsx/.js/.json`）：

```
Grep -i "knowledgePoint|knowledgeGraph|mastery|progression|curriculum|openai|anthropic|langchain|llm|@ai-sdk"
```

- **零实现命中。** 唯一 6 条命中全部是 `src/plugins/mission/LearnerProfileProgressStore.test.ts` 中 `fillMoat()` 函数，因 `-i` 让关键词 `llm` 命中 `fi**llM**oat` 的 `llM` 子串 —— **假阳性**，与知识点 / LLM 无关。
- 依赖树：dependencies = `@vitejs/plugin-react`, `lucide-react`, `react`, `react-dom`, `three`；devDependencies 仅 `@playwright/test`, `@types/*`, `typescript`, `vite`, `vitest`。**无任何 LLM / AI SDK**。
- 既有确定性护栏（FACT）：`src/plugins/mission/evaluators.test.ts:53` 与 `extendedEvaluators.test.ts:98` 断言评估器源码不含 `Math.random|Date.now|new Date(|fetch(|localStorage|window.`。

**结论（FACT + INFERENCE）：** V0.5.1 完成判定链路由确定性评估器独占，AI 零参与；V0.6 建立知识点 Registry 时不会与既有实现冲突，且 V0.9 的「AI 只能引用已注册 ID」约束尚无任何代码承载，需靠本版 Registry 提供锚点。

---

## 4. 测试与基线实测摘要（FACT，详见 `V06_TEST_AND_PERFORMANCE_BASELINE.md`）

| 检查 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| typecheck | `npm run typecheck` | **0** | 无输出，PASS |
| 单测 | `npm test -- --no-file-parallelism` | **0** | 28 文件 / **215 passed** / 7.00s |
| build | `npm run build` | **0** | 1623 modules / 6.42s（>500kB chunk 警告，既有现象） |
| E2E | `npx playwright test --workers=1` | **0** | **47 passed** / 2.2m |
| 视觉回归 | `node scripts/v051-visual-regression.mjs` | **0** | **worldCanvas 0 像素差**；topbar 10.206% / footer 2.849% / questPanel 0.01% |
| DOM / 档案延迟 | `node scripts/v051-perf.mjs` | **0** | draw calls **329**、任务数 15 |
| 帧时间 / draw calls | `node scripts/v042-perf.mjs` | **0** | 329 dc；flat 44.86ms / textured 47.88 / 47.53ms |
| 源码校验 | `npm run verify:source` | **1（FAIL）** | **既有基线缺陷**，见 §5 / DEV-601 |

基线指标全部与执行包登记值对齐：215 单测 / 47 E2E / 329 draw calls / `worldCanvas` 0 像素差。

---

## 5. 偏差与发现登记（DEV）

| ID | 类型 | 内容 | 影响 |
|---|---|---|---|
| **DEV-601** | 既有基线 FAIL | `npm run verify:source` exit 1：`scripts/v05-quest-screenshots.mjs:5` `import { chromium } from "playwright"`，但 `package.json` 只声明 `@playwright/test`。该脚本未被任何 package script / vite / playwright config 引用。 | **不阻塞 V0.6**（本版不修改该脚本，且它不在 V0.6 验收命令集内）。按「不通过改写既有测试解决阻塞」原则，本轮只读登记，不修复。V1.0 清理脚本时一并处理。 |
| **DEV-602** | 审计方法 | `v051-visual-regression.mjs` 完整模式会**重截 S1~S8 canonical**（owner 已确认锚点）；且观察到**延迟二次写入**：首次备份+恢复后 `git status` 已空，稍后又有 `s1` / `s7` 两张 PNG 与 `diffs/visual-regression.json`（date 字段）被重写。 | 运行前备份 10 张 canonical + 3 个 diffs；二次写入后用 `git restore --source=HEAD` 恢复两张 PNG，并用 HEAD 原始字节覆盖 JSON（规避 `core.autocrlf=true` 的 CRLF 误报）。最终 `git status --short` 仅剩 `?? docs/v0.6/`，10 张 canonical SHA 与 HEAD 逐一一致。**V0.6 实施期必须改用 `--clean-only`，或同样做「备份 → 运行 → git 级恢复 → 复验」。** |
| **DEV-603** | 性能噪声 | `v051-perf.mjs` 两次运行 p95 差异极大（首次 sidebarOpen p95 3ms，复测 96.2ms）。 | 印证 D-2「同机同脚本 ABBA 配对判定」必要；**不得套用绝对阈值**。 |
| **DEV-604** | 回归红线（新） | 47 条 E2E 中 7 个任务被直接点击 / 硬断言状态：`moat`（必须 `active` 与 `completed`）、`well`、`dungeon`、`measure-tower`、`section-detective`、`my-design-note`、`channel-dam`。单测 `missions.test.ts:63` 断言 `prerequisiteMissionIds === []`，但**只覆盖首批 3 个** `CASTLE_WATER_MISSIONS`。 | Q-2 先决条件链**不得**落在这 7 个任务上，尤其 `moat`；详见 `V06_OPEN_QUESTIONS_AND_RISKS.md` §2。 |
| **DEV-605** | 既有视觉差异 | topbar 本轮实测 10.206%（V0.51 记录 O-1 为 9.681%），外链字体加载噪声。 | 保留 canonical，不重截；留 V1.0 / 独立 DDR，不在 V0.6 处理。 |

---

## 6. 环境与运行前提（FACT）

- 5173 端口在审计开始时已有遗留 dev server（PID 3116，node.exe，命令行 `.../vite/bin/vite.js --host 0.0.0.0`，归属本源码仓库）。`curl http://127.0.0.1:5173/` 返回 200、`/src/main.tsx` 返回 200，Playwright `webServer.reuseExistingServer` 复用该实例，**未新起 server、未杀进程**。
- vitest 必须 `--no-file-parallelism`（沙箱并行 worker EPERM）；E2E 必须 `--workers=1` 且不与 build 并行；两者本轮均串行执行。
- 软件渲染（SwiftShader）下 FPS ~21 属环境现象，按 D-2 配对判定，非产品缺陷。

---

## 7. 报告索引与结束条件

| 报告 | 内容 |
|---|---|
| `V06_REPOSITORY_BASELINE_REPORT.md` | 本文：发布对象、差异表、检索证明、偏差登记 |
| `V06_MISSION_AND_EVALUATOR_ID_MAP.md` | 15 任务 / 15 评估器 ID 全表、字段契约、E2E 硬约束、知识点映射提案 |
| `V06_LEARNER_AND_PERSISTENCE_CONTRACT_MAP.md` | 学习者域、3 个 localStorage key、WorldSnapshot、迁移与容错落点 |
| `V06_EVENT_AND_CAPABILITY_MAP.md` | 事件名全表、4 项能力、测试钩子、设计 token |
| `V06_TEST_AND_PERFORMANCE_BASELINE.md` | 全部命令 / 退出码 / 日志、视觉与性能原始数据 |
| `V06_OPEN_QUESTIONS_AND_RISKS.md` | Q 定案、schema v2 电力任务 spike、UNKNOWN 保留项、待签核 ADR 清单 |

**结束条件核对：**

- 基线 HEAD SHA：✅ `768769b`（工作树干净）
- V0.5.1 发布证据：✅ `0821dbf` / `v0.5.1`
- ID 清单：✅ 15 + 15
- 契约映射：✅ 见报告 2/3/4
- localStorage 盘点：✅ 3 个 key
- 事件清单：✅ 见报告 4
- canonical / 性能基线：✅ 见报告 5
- 测试结果：✅ 全部实际执行，含 1 项 FAIL 如实登记
- 待批 ADR 决策清单：✅ 见报告 6
- **建议的下一个 Task ID：** `V06-004`（**NOT AUTO-EXECUTED**，须先经 STOP GATE-1 owner 签核）

> ⛔ **STOP GATE-1 未通过。** 本轮产出的是审计证据与 ADR 定稿，不是批准。Phase 1（V06-004~020）不得启动，不得写任何功能代码。
