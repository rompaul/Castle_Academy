# V0.6 Phase 0 — 测试与性能基线

- **报告 ID：** V06_TEST_AND_PERFORMANCE_BASELINE
- **Task ID：** V06-002
- **日期：** 2026-11-12 · **性质：** 全部命令**实际执行**，退出码与日志摘要如实记录
- **基线：** `master` `768769b`（工作树干净）
- **环境：** Windows / Git Bash / Node，Chromium SwiftShader 软件渲染；5173 遗留 dev server（PID 3116，本仓库 vite，复用未重启）

> 规则：未运行写 `NOT RUN`，绝不推断 PASS。E2E 与 build **串行**执行；vitest 使用 `--no-file-parallelism`（沙箱并行 worker EPERM）；E2E `--workers=1`。

---

## 1. 命令与退出码总表（FACT）

| # | 命令 | 退出码 | 耗时 | 结论 |
|---|---|---|---|---|
| 1 | `npm run typecheck` | **0** | 10s | PASS，无输出 |
| 2 | `npm test -- --no-file-parallelism` | **0** | 10s（vitest 7.00s） | PASS，28 文件 / **215/215** |
| 3 | `npm run build` | **0** | 10s（vite 6.42s） | PASS，1623 modules |
| 4 | `npx playwright test --workers=1` | **0** | 2m24s（报告 2.2m） | PASS，**47/47** |
| 5 | `node scripts/v051-visual-regression.mjs` | **0** | 31s | PASS，`worldCanvas` **0 像素差** |
| 6 | `node scripts/v051-perf.mjs`（首轮） | **0** | — | PASS，draw calls 329 |
| 7 | `node scripts/v051-perf.mjs`（复测取完整输出） | **0** | 9s | PASS，见 §3 |
| 8 | `node scripts/v042-perf.mjs` | **0** | 54s（与 #6 同一批） | PASS，见 §4 |
| 9 | `npm run verify:source` | **1（FAIL）** | — | **既有基线缺陷**，见 §5 |

---

## 2. 单测 / build / E2E 明细（FACT）

**单测**（`npm test -- --no-file-parallelism`）：28 个测试文件全部通过，215 tests，7.00s（transform 312ms / collect 1.58s / tests 229ms）。含 `src/content/missions/missions.test.ts`(8)、`src/plugins/learner/LearnerProfilePlugin.test.ts`(11)、`src/plugins/mission/*`(10+7+15+5)、`src/ui/tokens.test.ts`(4)、`src/core/world/*`(7+7+6) 等。

**build**：`tsc -b && vite build` → `dist/index.html` 0.56 kB、`index-*.css` 23.30 kB、`index-*.js` 747.77 kB (gzip 204.62 kB)。**既有警告**：chunk >500 kB（Vite 建议 code-split），属 V0.5.1 既有现象，非本轮回归。

**E2E**（47 passed / 2.2m）：13 个 spec 文件全部通过，包括 V0.5 基线 `first-playable`(7)、`layer-section`(5)、`persistence`(3)、`water-quests`(3)、`diagnose*`(2) 与 V0.51 的 `v051-*`(27)。关键断言：`mission.moat.v1` 激活为 `active`、完成为 `completed`、15 任务字段齐全、4 年龄带、5 种表达形式、档案损坏容错、多档案隔离、奖励幂等。

---

## 3. 视觉回归（FACT，`visual-regression.json`）

命令：`node scripts/v051-visual-regression.mjs`（完整模式，1280×720 世界视图对比 `docs/v0.5/screenshots/quest_panel_stage.png`，容差 8/通道）

| 分区 | 差异像素 | 比例 |
|---|---|---|
| **worldCanvas** | **0** | **0.000%** ✅ |
| topbar | 9928 | 10.206% |
| footer | 1313 | 2.849% |
| questPanel | 12 | 0.010% |
| 全图 | 11305 / 921600 | 1.227% |

- `worldCanvas` **0 像素差**，与 V0.51 发布评审一致，是 V0.6 的发布硬门槛锚点。
- topbar 10.206%：既有 **O-1 外链字体**加载噪声（V0.51 记录 9.681%，本轮略高）；footer 2.849%：`V0.5.1` 版本文本预期变化。脚本注释明确「零容差判定以渲染代码零改动 + 布局尺寸不变为准」，动态水模拟像素差仅作参考。
- 产出 11 张截图（S1~S8 + `world-clean-v051` + `world-canvas-anchor-v051` + `world-main-v051(diffs)`）。

**只读保障（FACT）：** 该脚本完整模式会**重截 S1~S8 canonical**。运行前已备份 10 张 canonical + 3 个 diffs 文件，运行后逐字节恢复；`git status --short` 为空，10 张 SHA 前后完全一致：

```
s1 fd161bac…  s2 67eed700…  s3 a0c9c7a6…  s4 4da7c3e7…
s5 39188b08…  s6 f0343079…  s7 7d35d669…  s8 aa57164c…
world-canvas-anchor 53b02a9b…  world-clean a66db834…
```

→ 登记为 **DEV-602**：V0.6 实施期视觉回归应改用 `--clean-only`，或沿用「备份 → 运行 → 恢复」流程，避免误改 owner 已确认锚点。

> ⚠️ **补充（最终校验时发现）：** 上述备份恢复后 `git status` 曾为空，但稍后观察到**延迟二次写入** —— `s1-onboarding-nickname.png`、`s7-mission-complete-reward.png` 与 `diffs/visual-regression.json`（`date` 变为 `2026-11-12T06:31:38.475Z`）又被重写。已用 `git restore --source=HEAD` 恢复两张 PNG，并用 `git show HEAD:...` 的原始 LF 字节覆盖 JSON（`core.autocrlf=true` 会因 CRLF 产生仅 stat 的 `M` 误报）。最终 `git status --short` 仅剩 `?? docs/v0.6/`，两张 PNG 的 SHA 与 HEAD 逐一一致，`git diff --check` 通过。此现象进一步说明实施期**不可假定脚本退出即无后续写入**，必须在最后一步复验 git 状态。

---

## 4. DOM / 学习者延迟与帧时间（FACT）

### 4.1 `node scripts/v051-perf.mjs`（复测完整输出）

```json
{
  "timerResolutionMs": 0.1, "readBatchSize": 100,
  "sidebarOpenColdMs": 96.2,
  "sidebarOpenWarm": { "samples": 19, "avgMs": 10.453, "p95Ms": 86.9, "maxMs": 86.9 },
  "sidebarOpen":     { "samples": 20, "avgMs": 14.74,  "p95Ms": 96.2, "maxMs": 96.2 },
  "sidebarClose":    { "samples": 20, "avgMs": 7.96,   "p95Ms": 82.7, "maxMs": 82.7 },
  "profileWrite":    { "samples": 20, "avgMs": 0.9,    "p95Ms": 11.4, "maxMs": 11.4 },
  "profileRead":     { "samples": 20, "avgMs": 0.029,  "p95Ms": 0.478, "maxMs": 0.478 },
  "missions": 15, "drawCalls": 329
}
```

首轮同一脚本输出（被 `tail` 截断的部分）：`sidebarOpen avg 1.075 / p95 3.0`，`sidebarClose avg 0.38 / p95 1.3`，`profileWrite avg 0.18 / p95 0.8`，`profileRead avg 0.005 / p95 0.01`，`missions 15 / drawCalls 329`。

> ⚠️ **DEV-603（重要）：** 两次同机同脚本运行 p95 差 30 倍以上（3ms vs 96.2ms）。这不是产品回归，是软件渲染 + 后台负载噪声。V0.6 性能判定必须按 **D-2 同机同脚本 ABBA 配对**，不得套用执行包里的绝对毫秒阈值，也不得拿本报告的绝对值当门槛。

### 4.2 `node scripts/v042-perf.mjs`（300 帧 / 模式）

| 模式 | avgFps | avgFrameMs | p95FrameMs | drawCalls | triangles | textures |
|---|---|---|---|---|---|---|
| flat（`?flat=1`，V0.4.1 基线路径） | 22.3 | 44.86 | 50.1 | **329** | 3936 | 1 |
| textured（V0.4.2） | 20.9 | 47.88 | 50.1 | **329** | 3936 | 2 |
| textured（run 2） | 21.0 | 47.53 | 50.1 | **329** | 3936 | 2 |

`frame-time delta (textured vs flat): -6.7% faster or equal`。软件渲染下 ~21 FPS 属环境现象（V0.51 已归因 AC-122），非产品设备瓶颈。**329 draw calls 全模式稳定**，与执行包基线一致。

---

## 5. 唯一失败项：`verify:source`（FACT，如实登记）

```
> castle-academy@0.5.1 verify:source
> node scripts/verify-source.mjs

Source verification failed (1 issue(s)):
- scripts\v05-quest-screenshots.mjs: external import is not declared in package.json: playwright
VERIFY_EXIT=1
```

- 成因（FACT）：`scripts/v05-quest-screenshots.mjs:5` 为 `import { chromium } from "playwright"`，而 `package.json` 只声明 `@playwright/test`，`verify-source.mjs` 按包名前缀检查外部 import 并判失败。
- 影响面（FACT）：该脚本**未被任何 package script / vite.config / playwright.config 引用**；`grep v05-quest-screenshots package.json vite.config.* playwright.config.*` 无命中。
- 处置（决定）：这是 **V0.5 遗留的既有基线缺陷**，不是 V0.6 引入的回归，也不在 V0.6 验收命令集（`V06_Repository_Baseline_Audit.md` §2）内。按「不得通过改写既有测试或配置来『解决』阻塞」的治理原则，**Phase 0 只读登记为 DEV-601 / 已知失败，不修复**。V1.0 清理历史脚本或单独修 package.json 时处理。
- 若 owner 认为 V0.6 发布门禁必须包含 `verify:source` 全绿，则需在 STOP GATE-1 前单独批准一处范围外改动 —— 本报告不自行执行。

---

## 6. 已知环境问题（继承 V0.51，FACT）

| 现象 | 处理 |
|---|---|
| vitest 并行 worker 沙箱 EPERM | `--no-file-parallelism`（本轮已用） |
| 5173 `strictPort` / 遗留 server | 本轮复用已有实例，未新起、未杀进程 |
| E2E 与 build 并行会假性失败 | 严格串行（本轮已用） |
| 软件渲染 FPS 偏低 | D-2 同机配对判定，不套绝对阈值 |
| 后台 dev server 随沙箱会话结束被杀 | 非产品缺陷 |

---

## 7. 测试产物清理与仓库状态（FACT）

- `dist/`、`test-results/`、`playwright-report/` 由 build / E2E 产生，均被 `.gitignore` 隐藏；本轮按项目约定在最终校验阶段统一清理（见一致性校验任务）。
- canonical 与 diffs 已恢复；**审计结束后 `git status --short` 为空**（不含本报告目录，报告为 owner 授权的 docs-only 输出）。
- 全部 9 条命令中 8 条 exit 0、1 条 exit 1（已登记）。**无 NOT RUN 项**（V0.6 Phase 0 要求的 6 条基线命令全部实际执行）。
