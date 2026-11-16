# V07-001 · V0.7 仓库基线报告（只读审计）

**执行：** 2026-11-15，Phase 0 `V07-001~003`；owner 已授权 docs-only 报告输出（`STOP GATE-1` 同次裁定「签完就跑」）
**方法：** 只读 `git` / `Read` / `Grep` / `Glob` + 三路只读源码盘点；未改源码、未提交、未打 tag、未改版本
**标注：** FACT（代码或输出可直接证实）/ INFERENCE（推演）/ UNKNOWN（无法证实）

## 1. 批准基线核对（G0 前置条件）

| 项 | 期望（起草期） | 实测（FACT） | 判定 |
|---|---|---|---|
| 分支 / HEAD | master `4f18102` | `master` / `4f18102 docs: register V0.6.1 release object...` | ✅ |
| tag 类型 | annotated tag | `git cat-file -t v0.6.1` → `tag` | ✅ |
| tag 解引用 | `f0980b8d3174ca819a961738fe6dd14264290b09` | `git rev-list -n1 v0.6.1` → 同值 | ✅ **批准基线吻合** |
| master 是否等于基线 | 否（tag 之后 docs-only 登记提交） | `4f18102` ≠ `f0980b8` | ✅ 未误用 |
| `package.json` / lock 根包 | `0.6.1` | `0.6.1` / `0.6.1` | ✅ |
| 应用内版本标识 | 2 处 `V0.6.1` | 2 处（`src/app/App.tsx`） | ✅ |
| Release notes | 已定稿 | `docs/v0.6.1/V061_Release_Notes.md:3` → **已定稿**（STOP GATE-3 ACCEPT，2026-11-14） | ✅ |
| 工作树 | 干净 | `git status --porcelain` 空（报告写入前 = 0） | ✅ |
| 产物 / 端口 | 无 `dist/` `test-results/`；5173 空闲 | 审计开始时 5173 有**遗留 vite dev server**（PID 8532，`--host 0.0.0.0`），已显式停止并确认空闲；`dist/` `test-results/` 由本次基线实测生成，收尾清理 | ✅ 已处置 |
| 远端 refs | `origin/master = 4f18102`、`refs/tags/v0.6.1^{} = f0980b8` | **UNKNOWN** — 本地代理 `127.0.0.1` 未启，本次未重新 `git ls-remote`；2026-11-14 发布时已核对 | 按 `V07_Repository_Baseline_Audit.md:16` 记 UNKNOWN，**不判失败** |

**结论（FACT）：** `tag v0.6.1` / `f0980b8` 为本版批准基线，全部本地吻合；`0bd6e4f` / `v0.6.0` / `0821dbf` / `768769b` / `1052a24` 仅作历史追溯。**G0 前置 PASS，未触发 BLOCKED。**

## 2. canonical 与发布证据清单（字节未改动）

| 目录 | 文件 | 用途 |
|---|---|---|
| `docs/v0.6/screenshots/canonical/` | `world-canvas-anchor-v060.png`、`world-main-v060.png` | **3D 零容差锚点**（V0.7 继续沿用） |
| `docs/v0.6.1/screenshots/canonical/` | `world-main-v061.png`、`world-clean-v061.png`、`world-canvas-anchor-v061.png`、`anchor-diff.png`、`main-diff.png`、`electrical-scene-v061.png`、`visual-regression.json` | V0.6.1 HUD / 电力锚点 |
| `docs/v0.6.1/` | `V061_Performance_Paired.json`、`V061_Safety_Spotcheck.json`、`V061_POST_GATE3_RELEASE_VERIFICATION.md` | 性能 / 安全 / 发布复验 |

`git status --porcelain` 为空 → 上述文件相对 HEAD 零改动（FACT）。`scripts/v061-visual-regression.mjs:22-23` 显式引用 V0.6 canonical、只写 V0.6.1 canonical；`scripts/v061-perf.mjs:19,111` 只写 `docs/v0.6.1/`。**V0.7 必须新脚本、只写 `docs/v0.7/`，不得重截旧 canonical**（`R-714`）。

## 3. 代码规模与稳定契约（FACT，实际行号）

| 契约 | 实测值 | 位置 |
|---|---|---|
| `WorldSnapshot` | `{ version: 1, blocks: [{x,y,z,blockId}] }`，`SNAPSHOT_VERSION = 1` | `src/core/world/WorldState.ts:9-12,14,56-84` |
| BlockId | **34**（7+15+3+9，既有 25 个 ID 与顺序零变更） | `src/core/world/blocks.ts:103-255,210` |
| 方块分类 | 7 组 / 9 格，`DEFAULT_QUICK_SLOTS = BLOCKS.slice(0,9)` | `src/core/world/blockCategories.ts:22-63,66-68` |
| 知识点 | **24** 个 ID，正则 `^kp\.[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,2}$`（3~4 段） | `src/content/knowledge/registry.ts:36-37,48-266` |
| 任务 / 评估器 | **18 / 18**，全部 `schemaVersion: 2` | `src/content/missions/index.ts:13-18`、`src/plugins/mission/evaluators.test.ts:36,47` |
| `MissionDefinition` | **20 个字段**（17 必填 + 3 可选），**非起草期所写 22** | `src/content/missions/types.ts:28-64` |
| `EvaluatorQuery` / `EvaluatorResult` | 7 通道 / 3 字段 | `src/plugins/mission/evaluators.ts:139-163` |
| 能力 | 5 项（`building.basic` / `water.simulation` / `layers.section` / `measurement.distance` / `electric.basic`） | `src/plugins/mission/CapabilityRegistry.ts:46-55` |
| localStorage | 3 个 key | `PersistencePlugin.ts:39-40`、`learner/types.ts:59` |
| 事件 | `MISSION_EVENTS` 6、`quest.*` 迁移 3、`electric.*` 3、`learner.*` 3 | 见 `V07_UI_AND_INPUT_CONTRACT_MAP.md` / 报告 4 |
| 测试规模 | 42 单测文件 / 339 用例；13 E2E spec / 47 用例 | 本次实跑，见报告 5 |

## 4. 与起草期事实表的差异（须登记，不改写历史文档）

| # | 起草期表述 | 实测 FACT | 影响 |
|---|---|---|---|
| D1 | `MissionDefinition` 22 字段（`01_SCOPE` §8） | **20 字段**（`types.ts:28-64`）；校验器 16 条规则（`:87-150`） | 文档数字更正；不影响 v2 容量结论 |
| D2 | `validateMissionDefinition()` 位置 `types.ts:123-125` 只提 schemaVersion | 完整函数 `:87-150`；`schemaVersion ∈ {undefined,1,2}` 在 `:122-125` | 更正行号 |
| D3 | `MasteryEvidenceRecord` 在 `learner/types.ts:14-20` | `:14-20` 是 `MissionProgressEntry`；证据记录在 `:27-33` | 更正行号 |
| D4 | 3 个 key 都在 `PersistencePlugin.ts:38-41` | 该文件只有 2 个；第 3 个在 `learner/types.ts:59` | 更正位置 |
| D5 | 「读档 / 重置 / `refresh()` 清空 `textEvidence`」 | **仅 `onExternalChange`（档案切换）清**（`MissionRuntimePlugin.ts:165`）；`resetEvaluation():286-300` **不清**，`refresh():302-305` 只调 `evaluate()` | **契约风险**，见报告 4 §3、报告 6 §5；`V07-005/018` 必须显式补清空 |
| D6 | `src/ui/mission/mission.css` | 实际为 `src/ui/mission.css` | 更正路径 |
| D7 | `glossary.test.ts:119-120` | 实际 `src/content/electrical/glossary.test.ts:119-120` | 更正路径 |
| D8 | 期望值适配「3 处」 | 实查受 18→24 / 5→6 影响的硬断言 **≥17 处** | **重要**，见报告 6 §4；需 owner 补充批准 |
| D9 | 交接清单 `V061_V07_Handoff.md:4`「尚未提交 git / 未打 tag」 | 已发布 `f0980b8` / `v0.6.1` | 历史时点文字，按 `SOURCE_AND_ASSUMPTION_REGISTER.md` 保留原文 |
| D10 | `V06_EVENT_AND_CAPABILITY_MAP.md:60` 记 4 项能力 | 代码 5 项 | 同上，已登记 |
| D11 | `v051-content-batch1.spec.ts:21`、`batch2.spec.ts:32` 是「硬断言」 | 两行均为 `test(` 标题；真正数字断言在 `:38` / `:44,:54,:55` | 更正适配清单定位 |
| D12 | README 发布表 HUD `7.623% / 99.84%` | `visual-regression.json` 记录 `7.616% / 99.93%`（最终重截值） | 历史值差异，V0.6.1 报告已双向登记 |

## 5. 本报告的边界

- 本次只新增 `docs/v0.7/audit/` 下 6 份 md（docs-only，owner 已授权），**不提交 git**；报告写入后 `git status --porcelain` 应只列出这 6 个未跟踪文件。
- 未运行 `verify:source`（`DEV-601` 只读登记，本版不修）；未安装 / 更新依赖；未启动新的常驻服务（仅停止遗留 server）。
- 基线实测命令、退出码与用例数见 `V07_TEST_AND_PERFORMANCE_BASELINE.md`。
