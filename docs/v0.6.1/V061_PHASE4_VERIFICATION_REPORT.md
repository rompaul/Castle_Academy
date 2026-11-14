# V0.6.1 Phase 4 验证报告（V061-025 / 026 / 027）

**日期：** 2026-11-14
**状态：** STOP GATE-2 已签核；V061-025 / 026 / 027 **全部完成并 PASS**；V061-028~030 未启动
**基线：** tag `v0.6.0` / `0bd6e4f`（V0.6 canonical），非 V0.51 canonical
**证据目录：** `docs/v0.6.1/screenshots/canonical/`、`docs/v0.6.1/V061_Performance_Paired.json`

## 0. STOP GATE-2 签核

owner 在本轮选项「**签核，开始跑实测（推荐）**」中一次性完成：批准 `DDR-0002_MC_STYLE_BLOCK_BAR.md`、判定 `FULLY SATISFIED`、E1~E9 / GATE-2 截图（10 张）评审通过，并授权启动 V061-025~027。

角色 B 独立验收报告（`V061_ROLE_B_ACCEPTANCE_REPORT.md`）的**原判定不改写**；其风险 1（DEV-608 未修复）与风险 2（帮助面板 HUD 像素变化）的关闭路径分别由本轮 V061-025 新增脚本与已批准的 DDR-0002 §3 白名单兑现，由 owner 签核确认闭环。

## 1. V061-025 — 视觉回归与 canonical 冻结（DEV-608 已修复）

**新增脚本** `scripts/v061-visual-regression.mjs`：显式引用 `docs/v0.6/screenshots/canonical/` 的 `world-canvas-anchor-v060.png` 与 `world-main-v060.png`；**不改动**仍有硬编码 V0.51 路径的 `v051-visual-regression.mjs`，**不重截**任何已提交的 V0.51 / V0.6 canonical（规避 DEV-602 二次写入）。

| 判定 | 结果 |
|---|---|
| **AC-6750 干净世界 3D 区域 0 像素差** | **PASS** — 960×608 裁剪区 583680 像素，`differingPixels = 0`（容差 8/通道，与 V0.51 脚本同法） |
| 全屏 `world-main` 对 V0.6 锚点 | 差异 70257 px / 7.623% |
| 差异垂直分布（归因证据） | topbar 65 / **worldUpper 0** / **hotbarBand 70143（99.84%）** / footer 49 → **全部落在 HUD**，3D 世界零差异 |
| HUD ≤0.5% 判据 | **由 DDR-0002 §3 白名单替代**（owner 已签核）：34 格平铺热栏 → 9 格 + 分类入口属有意变更；白名单之外的差异仍判 BLOCKED。3D 世界 0 像素差这条硬约束未放宽 |
| **AC-6751 含电力方块新场景单独冻结** | **PASS** — `electrical-scene-v061.png`，`loadState = powered`，drawCalls 338；不与旧区域混判 |

**冻结产物**（`docs/v0.6.1/screenshots/canonical/`）：`world-canvas-anchor-v061.png`、`world-clean-v061.png`、`world-main-v061.png`、`electrical-scene-v061.png`、`anchor-diff.png`、`main-diff.png`、`visual-regression.json`。脚本 exit 0、`pageErrors []`。

## 2. V061-026 — D-2 同机同脚本 ABBA 性能配对

**新增脚本** `scripts/v061-perf.mjs`：同一 page / 同一脚本 / 每轮 180 rAF 帧，顺序 `A1 → B1 → B2 → A2`（A = 干净世界，B = 通电电路），报告 `V061_Performance_Paired.json`。不套用 DEV-603 记录的失真绝对阈值。

| 轮次 | avgFrameMs | p95FrameMs | drawCalls |
|---|---|---|---|
| A1 干净世界 | 45.90 | 83.2 | **329** |
| B1 通电 | 46.13 | 50.1 | 338 |
| B2 通电（复测） | 45.83 | 50.1 | 338 |
| A2 干净世界（复测） | 45.14 | 50.1 | **329** |

配对结果：A = 45.52ms / 329 dc，B = 45.98ms / 338 dc，**帧时间差 +1.01%**；A 两轮自身波动 0.76ms 大于配对差 0.46ms，判**无显著回归**。通电场景 +9 draw calls 归因于 5 段 overlay，实际值单独记录。软件渲染约 21.8fps 属既有环境瓶颈（AC-122 已归因，非产品设备瓶颈）。`cleanWorldDrawCallsNoRegression = PASS`。

## 3. V061-027 — 全量回归

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| 全量单测（含 7 条 `blockCategories.test.ts`） | **339/339**（42 文件） |
| 全量 E2E | **47/47**（`--workers=2`；V0.5 基线 20 条逐字节零改动）。本轮签署后产品代码零变更，复用同日 47/47 实测；默认 7 workers 的 20 条纯超时属软件渲染资源等待，非断言失败 |
| `npm run build` | 0（chunk >500kB 为既有告警） |
| `git diff --check` | 0 |
| V0.5 水 / V0.4 图层·剖面 / 存档兼容 | 由 `water-quests.spec.ts` / `layer-section.spec.ts` / `persistence.spec.ts` 覆盖，均 PASS |
| 稳定契约 | `WorldSnapshot v1`、既有 25 个 BlockId 与顺序、atlas 49/64、3 个共享材质、localStorage 3 个 key、既有事件名：零变更 |

## 4. 遗留与下一步

- **V061-028**（安全抽查）、**V061-029**（Release notes DRAFT）、**V061-030**（V0.7 交接）：**已完成**，见 `docs/v0.6.1/V061_028_030_Report.md`。GATE-3 正式签核 / 版本号 / tag 仍待 owner。
- GitHub Release 页仍需 owner 手动创建（fine-grained PAT 无 release 写权限，403；与 v0.5.0 / v0.6.0 同因）。
- git 全部未提交；`package.json` 仍为 0.6.0，未打 `v0.6.1` tag。
- 下一步需 owner 决定 GATE-3 是否放行（发布评审 ACCEPT、版本号 / tag / Release notes）。

> 以上 §4 为 **2026-11-14 Phase 4 当时**的状态留痕，原文不改。

## 5. 发布对象复验补录（2026-11-14，GATE-3 ACCEPT 后）

- owner 已 `ACCEPT`；版本号 / 应用内标识已改 `0.6.1` / `V0.6.1`，Release notes 定稿，git 提交与 tag `v0.6.1` 由发布流程执行。
- **对最终发布对象重跑**：typecheck 0 / build 0 / **339/339 单测（42 文件）** / **47/47 E2E（`--workers=1` 干净记录）** / `git diff --check 0`。`--workers=2` 复跑有 1 条 `page.goto` 30s 超时，单并发单独重跑 5/5 PASS，属已登记的软件渲染资源等待，非断言失败。
- **canonical 重截**（应用内版本标识同步后）：`scripts/v061-visual-regression.mjs` exit 0、`pageErrors []`；3D 锚点 **0 像素差**；全屏差异 70189 px / **7.616%**，`yBands` = topbar 26 / **worldUpper 0** / hotbarBand 70143（**99.93%**）/ footer 20；电力场景 `powered` / 338 dc。§3 的 7.623% / 99.84% 为签核时候选对象的历史实测值。
- `dist/`、`test-results/` 已清理，临时 dev server 已停止。
- 详见 `V061_POST_GATE3_RELEASE_VERIFICATION.md`。
