# V07-002 · 测试与性能基线（Phase 0 实跑记录）

**日期：** 2026-11-15；**执行者：** `V07-001~003` 只读审计（owner 同次授权）
**重要：** 以下数字是**本版 Phase 0 实跑结果**，不是引用 V0.6.1 发布数字；V0.6.1 的 339 / 47 / 329 dc / 0 像素差只作量级与可追溯参考。

## 1. 实跑命令、退出码与用例数（FACT）

统一执行目录 `D:/data/project/Castle_Academy/Castle_Academy_V0.1_Source`；完整日志 `/tmp/v07-phase0-baseline.log`（仓库外，不提交）。

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `npm run typecheck` (`tsc -b --pretty false`) | 无错误 | **0** |
| 2 | `npm run build` (`tsc -b && vite build`) | 构建成功 | **0** |
| 3 | `npm test -- --no-file-parallelism` | `Test Files 42 passed (42)`、`Tests 339 passed (339)` | **0** |
| 4 | `npm run test:e2e -- --workers=1` | `47 passed (5.1m)`，13 个 spec 全绿 | **0** |
| 5 | `git diff --check` | 无空白错误 | **0** |

**并发口径（FACT + 项目约定）：** 单测一律 `--no-file-parallelism`（vitest 并行 worker 会因临时目录 EPERM 随机崩）；E2E 用 `--workers=1` 取干净记录 —— V0.6.1 发布时 `--workers=2` 曾出现 1 条 `page.goto` 30s 超时，单并发重跑 5/5 PASS，属软件渲染资源等待。`playwright.config.ts:10-14` 自带 `webServer`（`npm run dev -- --host 127.0.0.1`、`http://127.0.0.1:5173`、`reuseExistingServer: !CI`），**不得手动起 vite**；审计前发现并停止了遗留 vite server（PID 8532）。

**V0.5 基线 20 条 E2E（FACT）：** 分布在 6 个不带 `v051-` 前缀的 spec —— `diagnose.spec.ts`(1) / `diagnose-underground.spec.ts`(1) / `first-playable.spec.ts`(7) / `layer-section.spec.ts`(5) / `persistence.spec.ts`(3) / `water-quests.spec.ts`(3) = 20，逐字节零改动。13 个 spec 用例分布：3+5+1+1+7+4+5+4+3+3+3+4+4 = 47。

## 2. 静态统计与配置（FACT）

| 项 | 值 | 位置 |
|---|---|---|
| npm scripts | 8 条：`dev` `build` `preview` `test` `test:watch` `test:e2e` `typecheck` `verify:source` | `package.json:6-15` |
| vitest | `environment: "node"`、`include: ["src/**/*.test.ts"]`；**无** `workers` / `retries` / `timeout` 显式配置 | `vitest.config.ts:1-5` |
| playwright | `testDir "./e2e"`、`baseURL http://127.0.0.1:5173`、Desktop Chrome、SwiftShader WebGL args；**无** `workers` / `retries` / `timeout` 显式配置（取框架默认） | `playwright.config.ts:4-14` |
| 单测文件 | 42 个 `src/**/*.test.ts` | 静态统计 |
| E2E spec | 13 个 `e2e/*.spec.ts` / 47 用例 | 静态统计 |
| `verify:source` | exit 1（`DEV-601`，脚本 import 未声明的 `playwright`） | `README.md:91`，**只读登记，本版不修，本次未运行** |

## 3. 既有硬断言全表（FACT，实查行号与字面值）

### 3.1 起草期 §9 已列的 3 处

| 文件:行 | 字面值 |
|---|---|
| `src/plugins/mission/extendedEvaluators.test.ts:211-216` | `:211` ageScope `size===4`；`:213` `new Set(ALL_MISSIONS.flatMap(m=>m.expressionForms)).size).toBe(5)`；`:214-216` communication `toHaveLength(1)` 且 ID `mission.my-design-note.v1` |
| `e2e/v051-content-batch1.spec.ts:21` | `test("Content Pack 18 个任务：…")` —— **标题行**，数字断言在 `:38` |
| `e2e/v051-content-batch2.spec.ts:32` | `test("Content Pack 18 个任务：…覆盖 4 个年龄带与全部表达形式…")` —— **标题行**，断言在 `:44,:54,:55` |

### 3.2 Phase 0 新识别：18→24 / 5→6 还会撞到这些断言（FACT）

| # | 文件:行 | 现值 | 触发原因 |
|---|---|---|---|
| 1 | `src/plugins/mission/evaluators.test.ts:36` | `registry.ids()).toHaveLength(18)` | 评估器 18→24 |
| 2 | `src/plugins/mission/evaluators.test.ts:47` | `new Set(registry.ids()).size).toBe(18)` | 同上 |
| 3 | `src/plugins/mission/extendedEvaluators.test.ts:203` | `ALL_MISSIONS).toHaveLength(18)` | 任务 18→24 |
| 4 | `src/plugins/mission/extendedEvaluators.test.ts:213` | 形式 `size).toBe(5)` | 5→6 |
| 5 | `src/plugins/mission/extendedEvaluators.test.ts:215` | communication `toHaveLength(1)` | 1→≥2 |
| 6 | `src/plugins/mission/MissionRuntimePlugin.test.ts:67` | `offered[0].missions).toHaveLength(18)` | 全量 |
| 7 | `src/plugins/mission/MissionRuntimePlugin.test.ts:123` | `list).toHaveLength(18)` | 全量 |
| 8-9 | `src/plugins/mission/LearnerProfileProgressStore.test.ts:147,160` | `getMissions()).toHaveLength(18)` ×2 | 全量 |
| 10 | `src/content/electrical/glossary.test.ts:126` | `ALL_MISSIONS).toHaveLength(18)` | 全量 |
| 11 | `src/content/electrical/glossary.test.ts:137` | `graph.order).toHaveLength(18)` | 拓扑序长度 |
| 12 | `src/content/knowledge/missionGraph.test.ts:90` | `r.order).toHaveLength(18)` | 拓扑序长度 |
| 13 | `e2e/v051-content-batch1.spec.ts:38` | `result.definitions).toHaveLength(18)` | 全量 |
| 14 | `e2e/v051-content-batch2.spec.ts:44` | `defs).toHaveLength(18)` | 全量 |
| 15 | `e2e/v051-content-batch2.spec.ts:54` | 形式 `size).toBe(5)` | 5→6 |
| 16 | `e2e/v051-content-batch2.spec.ts:55` | communication `toHaveLength(1)` | 1→≥2 |
| 17-18 | `e2e/v051-mission-foundation.spec.ts:21,95` | `toHaveLength(18)` / `toBe(18)` | 全量 |

另有描述性标题与「4 条边 / 4 个 locked」类断言（`MissionRuntimePlugin.test.ts:59-77`、`missionGraph.test.ts:87-98`），若 `V07-011` 新增第 5 条先决链也需同步；`01_SCOPE` §9 起草期**只列了 3 处**，详见 `V07_OPEN_QUESTIONS_AND_RISKS.md` §4。

**不受影响（FACT）：** `registry.test.ts:55`（24 知识点，本版零新增）、`163-181`（19 个快照超集）、`blocks.test.ts:6`（34）、`blockCategories.test.ts:22,36-37,46`、`tokens.test.ts:10-49`、`missions.test.ts:44-53`（唯一性 + evaluator 1:1）、`glossary.test.ts:118-120`（既有电力任务字段）、`v051-content-batch1.spec.ts:39-41`（前三 ID）、`v051-content-batch2.spec.ts:46`（`defs.slice(9,15)`）、V0.5 基线 6 个 spec 全部逐字节零改动。

> V0.6.1 `DEV-613` 已按 owner 裁定把这些断言从 15 改到 18 并逐条留痕（`docs/v0.6.1/audit/V061_DEV613_EXPECTATION_ADAPTATION.md` §2）。V0.7 需沿用同一先例，不得静默改测试。

## 4. canonical / 性能基线可追溯（FACT，非本版重测）

| 证据 | 数值 | 来源 |
|---|---|---|
| 3D 零容差锚点 | `anchor` 960×608 / 583680 像素 / **differingPixels 0** / `worldCanvas 0` / `yBands` 全 0 | `docs/v0.6.1/screenshots/canonical/visual-regression.json:16-35` |
| 全屏 main | 1280×720 / differingPixels 70189 / **7.616%**；`yBands`: topbar 26 / **worldUpper 0** / hotbarBand 70143 / footer 20；热栏带 **99.93%** | 同文件 `:36-72` |
| 电力场景 | `powered` / **338 draw calls** | 同文件 `:74-83` |
| D-2 ABBA | A1→B1→B2→A2，180 rAF/run；**A = 329 dc / 45.52 ms**、**B = 338 dc / 45.98 ms**、`frameTimeDeltaPercent 1.01`、`cleanWorldDrawCallsNoRegression PASS` | `docs/v0.6.1/V061_Performance_Paired.json:4-70` |
| 方法 | `scripts/v061-perf.mjs:18,83-89,103,105`；`scripts/v061-visual-regression.mjs:17,68-147,118-121,125-128` | — |

**等价性说明（FACT + INFERENCE）：** 自 `tag v0.6.1` 之后仅有一条 docs-only 提交 `4f18102`，源码字节零改动，工作树干净，故上述视觉 / 渲染基线对本版发布对象等价且可追溯。README `105` 仍保留签核时历史值 `7.623% / 99.84%`，与 JSON 最终重截值 `7.616% / 99.93%` 并存（V0.6.1 报告已双向登记）。

## 5. 明确 NOT RUN（不得预先写 PASS）

| 项 | 归属 |
|---|---|
| 本版独立 3D 视觉回归、新脚本、新 canonical 集 | `V07-024`（须只写 `docs/v0.7/`） |
| 本版 D-2 同机同脚本 ABBA 性能配对 | `V07-025` |
| 儿童安全与数据安全抽查 / AI 零参与运行时检索 | `V07-027/028` |
| M1~M8 实现截图对照、角色 B 独立验收 | `V07-022/023`（STOP GATE-2） |
| 截图 / 性能 / 安全 JSON 的本版数值 | 一律 NOT RUN；不得引用 V0.6.1 数值冒充实测 |

## 6. 产物处置

本次 `npm run build` 与 Playwright 生成 `dist/`、`test-results/`（均被 .gitignore 隐藏）。审计收尾按项目约定移出仓库、不提交；5173 遗留 vite server 已停止。报告写入后 `git status --porcelain` 应只剩 `docs/v0.7/audit/` 6 个未跟踪 md。
