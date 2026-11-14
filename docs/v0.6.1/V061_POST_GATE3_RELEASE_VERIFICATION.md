# V0.6.1 — GATE-3 ACCEPT 后发布对象复验与发布记录

**日期：** 2026-11-14
**owner 决定：** `ACCEPT，按清单发布（推荐）` —— 改版本号 `0.6.1`、提交 git、打 `v0.6.1` tag、Release notes 定稿；GitHub Release 页由 owner 手动创建（PAT 403）
**性质：** 功能增量版，基线 tag `v0.6.0` / `0bd6e4f`；独立 tag / 独立 canonical 集 / 独立性能报告
**用途：** 记录「GATE-3 签核之后、正式提交之前」对**最终发布对象**（而非签核时的候选对象）所做的全部变更与复验。GATE-3 评审材料 `V061_GATE3_Review_Pack.md` 中的数字保持原文，不改写历史判定。

## 1. 发布对象变更清单

| # | 文件 | 变更 | 说明 |
|---|---|---|---|
| 1 | `package.json` | `"version": "0.6.0"` → `"0.6.1"` | 版本号唯一来源 |
| 2 | `package-lock.json` | 顶层与 `packages[""]` 的 `"version": "0.5.1"` → `"0.6.1"` | 追平历史遗留的不一致（V0.6.0 发布时未同步，仍写 0.5.1）；**仅根包元数据，零依赖 / 解析字段变更** |
| 3 | `src/app/App.tsx` | 顶栏 `version-pill` 与 footer 的 `V0.6.0` → `V0.6.1` | 应用内版本标识，2 处 |
| 4 | `docs/v0.6.1/V061_Release_Notes.md` | DRAFT → **已定稿**（GATE-3 ACCEPT） | 文案来源，供 GitHub Release 页复制 |
| 5 | `README.md` | 当前 release / 标题 / 摘要 / 发布管理 / Next → V0.6.1 | 同时修正随版本变化已过时的说明：25→34 方块、`1`–`9` 与 `E`/`WHEEL`/`F` 控制、19→24 知识点、15→18 任务与评估器、256→339 单测、`kp.electric.*` 注册状态、发布验收表改为 V0.6.1、V0.6.1 从「in development」改为已发布、补充 V0.6.1 文档索引与 DDR-0002 白名单条目；修正机械替换造成的「no `v0.6.1`-only short tag」病句 |
| 6 | `docs/v0.6.1/screenshots/canonical/` | 按最终界面文案重截 4 张 canonical + 2 张 diff + `visual-regression.json` | 见 §3；沿用 V0.51 时「发布后应用内标识同步 + canonical 重截」的做法 |
| 7 | 本文件及 §4 列出的状态文档 | 发布后状态补录 | 历史判定原文均保留，只追加 |

## 2. 最终发布对象复验（2026-11-14）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | **exit 0** |
| 生产构建 | `npm run build` | **exit 0**（793.70 kB / gzip 218.47 kB；`chunk >500kB` 为 V0.5 起既有告警） |
| 全量单测 | `npm test -- --no-file-parallelism` | **339/339 PASS，42 文件**，9.70s |
| 全量 E2E（干净记录） | `npm run test:e2e -- --workers=1` | **47/47 PASS**，4.5 min；V0.5 基线 20 条逐字节零改动 |
| 全量 E2E（并发复跑） | `npm run test:e2e -- --workers=2` | 46/47 + 1 条 `page.goto` 30s 超时；该 spec 单独 `--workers=1` 重跑 **5/5 PASS**。为软件渲染资源等待（README「E2E flakiness」已登记），**非断言失败、非产品缺陷**；随后单并发全量 47/47 取得干净记录 |
| 空白 / 冲突标记 | `git diff --check` | **0**（仅 `core.autocrlf` 的 LF→CRLF 提示，既有 DEV-602 口径） |
| 视觉回归 | `node scripts/v061-visual-regression.mjs` | **exit 0**，`pageErrors []`；3D 锚点 **0 像素差**，见 §3 |

## 3. canonical 重截（应用内版本标识同步后）

`v061-visual-regression.mjs` 显式引用 `docs/v0.6/screenshots/canonical`，**不重截任何 V0.51 / V0.6 canonical**（DEV-602 防护），只写 `docs/v0.6.1/screenshots/canonical/`。

| 项 | GATE-2 时（界面写 V0.6.0） | 最终发布对象（界面写 V0.6.1） |
|---|---|---|
| 3D 区域锚点 960×608 / 583680 px | **0 像素差** | **0 像素差**（未放宽） |
| 全屏 main 差异 | 70257 px / **7.623%** | 70189 px / **7.616%** |
| `yBands.topbar` | 65 | 26 |
| `yBands.worldUpper` | **0** | **0** |
| `yBands.hotbarBand` | 70143 | 70143（未变） |
| `yBands.footer` | 49 | 20 |
| 热栏带占比 | **99.84%** | **99.93%** |
| 电力场景 | `powered` / 338 dc | `powered` / 338 dc |

顶栏 / footer 的少量差异变化属既有 **O-1 外链字体噪声**（V0.6 审计已登记 10.226% / 2.91% 同型噪声），不是版本文案引入的回归；热栏带像素数完全不变，3D 世界区域仍严格 0 像素差。`AC-6750` 的 HUD ≤0.5% 判据继续按 **DDR-0002 §3 白名单**归因（owner 已签核），电力新场景仍单独冻结。

**口径说明：** `V061_GATE3_Review_Pack.md`、`V061_PHASE4_VERIFICATION_REPORT.md`、`V061_Release_Notes.md` 中出现的 7.623% / 99.84% 是**签核时候选对象**的实测值，作为历史证据保留；发布对象的最终值以本表右列和 `screenshots/canonical/visual-regression.json` 为准。

## 4. 同步的状态文档

| 文件 | 处理 |
|---|---|
| `docs/v0.6.1/V061_GATE3_Review_Pack.md` | 追加「发布后补录」节；原「待你点头的三件事」标注为已执行，原文保留 |
| `docs/v0.6.1/V061_PHASE4_VERIFICATION_REPORT.md` | 追加「发布对象复验补录」节；§4 当时状态标注为历史 |
| `docs/v0.6.1/V061_028_030_Report.md` | 追加「发布后补录」节 |
| `docs/v0.6.1/V061_Release_Notes.md` | 已定稿；HUD 数字改为最终发布对象值并注明 GATE-2 历史值 |
| `Castle_Academy_V0.6.1_Execution_Package/02_ARCHITECTURE/DDR-0002_MC_STYLE_BLOCK_BAR.md` | 追加发布后重截记录 |
| `Castle_Academy_V0.6.1_Execution_Package/09_GOVERNANCE/PACKAGE_MANIFEST.json` | `status` 与 `gate3_*` 证据段更新 |
| `Castle_Academy_V0.6.1_Execution_Package/01_Execution/V061_Progress_Log.md` | 追加发布条目、填写「发布记录」六行 |
| `Castle_Academy_V0.2.1_Product_Document/04_Roadmap/VERSION_ROADMAP.md` | V0.6.1 行状态改为已发布 |

> 执行包与产品文档位于工作区根目录，不属于源码仓库 `Castle_Academy_V0.1_Source` 的发布 commit；源码仓库内可追溯的发布证据为 `docs/v0.6.1/` 与 `scripts/`。

## 5. 清理与收尾

- `dist/`、`test-results/` 为验证产物，已清理，不进入发布 commit。
- 5173 dev server 为本次重截临时启动，脚本结束后已停止；E2E 由 Playwright 自管 `webServer`。
- GitHub Release 页**仍需 owner 手动创建**：`gh release create` 恒 403（fine-grained PAT 无 release 写权限，v0.5.0 / v0.5.1 / v0.6.0 同因）。入口 https://github.com/rompaul/Castle_Academy/releases/new ，选完整 tag `v0.6.1`，复制 `docs/v0.6.1/V061_Release_Notes.md`。

## 6. 发布对象登记

见同目录 `V061_Progress_Log.md` 的「发布记录」节，以及 `git tag -l v0.6.1` / `git ls-remote origin refs/tags/v0.6.1`。
