# V07-024~028 — 打磨与发布前证据汇总（STOP GATE-3 前）

**日期：** 2026-11-16
**授权口径：** owner「继续，直到下次需要我做决定」；`STOP GATE-2 PASSED / RELEASED 2026-11-16`（角色 B `FULLY SATISFIED`）。`V07-024~028` 之间无 STOP 门；`V07-029` 发布评审为 **STOP GATE-3，须 owner 签核**——本报告停在 GATE-3 材料。
**边界：** 零版本 / tag 变更（应用内文案仍 `V0.6.1`，`package.json` 仍 `0.6.1`）；旧 canonical（V0.6 / V0.51 / V0.6.1）字节零改动；本报告只新增证据与脚本。

---

## V07-024 视觉回归与 canonical 冻结 — PASS

- 新脚本 `scripts/v07-visual-regression.mjs`（只新增，不改 `v051` / `v061` 旧脚本）；显式引用 `docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png`（3D 零容差锚点）与 `docs/v0.6.1/.../world-main-v061.png`（全屏 HUD 归因），**只写** `docs/v0.7/screenshots/canonical/`。
- 实测（`visual-regression.json`）：
  - **AC-7040 worldCanvas 0 像素差：PASS**（`anchor.differingPixels = 0`，容差 8/通道）。
  - **全屏对 V0.6.1 main：0 差异像素**（topbar / footer / questPanel / worldCanvas 四区域全 0）——V0.7 零 HUD 改动得到像素级证明，连白名单归因都无需启用。
  - 新场景 `mission-sidebar-v070.png`（侧栏固定、24 卡、`drawCalls 329`）单独冻结；`pageErrors []`。
- 旧 canonical 字节零改动（`git status -- docs/v0.6 docs/v0.51 docs/v0.6.1` 为空）。

## V07-025 ABBA 性能配对 — PASS（A 侧不回归；B 侧归因记录）

- 新脚本 `scripts/v07-perf.mjs`；A = 干净世界，B = 打开并固定任务侧栏；A1→B1→B2→A2，180 rAF 帧 / 轮，同机同脚本软件渲染。
- 实测（`docs/v0.7/V07_Performance_Paired.json`）：
  - **A（干净世界）drawCalls 329 / 329**（A1、A2）＝ V0.6.1 基线，**不回归 PASS**；平均帧时间 44.62ms，与 V0.6.1 发布值 45.52ms 同带。
  - B（侧栏打开）drawCalls 329 / 329——任务面板是 DOM overlay，**零新增 WebGL 调用**；平均帧时间 46.20ms，差 **+3.54%**，归因到「打开 24 张任务卡 DOM overlay」的被测场景本身，p95 83ms vs 50ms 同源；不套用绝对阈值（DEV-603 / D-2）。
- 排查记录：首轮 A2 出现 330 dc，诊断为**鼠标注视世界方块的高亮描边**（fresh 页面无 V0.7 操作即可复现：fresh 329 → hover 世界中央 330），属测量方法污染；脚本改为收起动作移到顶栏非世界区后复测 329/329。该高亮为既有交互，非 V0.7 引入，非回归。

## V07-026 全量回归 — PASS（全部一次通过）

| 命令 | 实测 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test -- --no-file-parallelism` | **55 文件 / 408 用例全绿**（13.2s） |
| `npx playwright test --workers=1` | **47/47 一次全绿**（2.9m；含 V0.5 水 / V0.4 图层·剖面 / V0.6 知识点·任务链 / V0.6.1 电力 / `persistence.spec.ts` 存档兼容 / V0.5 基线 20 条逐字节零改动 spec） |
| `npm run build` | exit 0（仅既有 chunk-size 警告） |
| `git diff --check` | 0 |
| `dist/` / `test-results/` | 已清理（mv 出工作树） |

## V07-027 AI 零参与与外部请求核查 — PASS

- 证据 `docs/v0.7/V07_AI_ZERO_PARTICIPATION.json`：全库（src / e2e / scripts / index.html + 根配置）扫描。
- **AI / LLM / SDK / 云调用：0 真实命中**——4 条原始命中均为 `generateTextureSet` 函数名含 `generateText` 子串的误匹配。
- **外部请求：全库唯一** = `src/ui/styles.css:1` Google Fonts `@import`（O-1 既有登记项）；运行时监控（安全抽查脚本 request 监听）仅 `fonts.googleapis.com` / `fonts.gstatic.com`。
- 完成 / 掌握 / 奖励链：只走 `MissionRuntimePlugin.evaluate()` → 注册评估器 → `RewardPlugin`，无 AI 参与（纯函数禁串单测 + 角色 B CHK-705 已证）。

## V07-028 儿童安全与数据安全抽查 — PASS

- 新脚本 `scripts/v07-safety-spotcheck.mjs`（扫描目标含 V0.7 新文件；产出 `docs/v0.7/V07_Safety_Spotcheck.json`）。
- **禁用词 0 命中**（19 电力词 + 9 儿童词 × 16 个 UI/内容文件）；12 条原始命中全部为**表源 / 否定式豁免**并逐条登记在 JSON：10 条为 `v07InteractionModel.ts` 的 `FORBIDDEN_CHILD_WORDS` 正则源本身（与 `glossary.ts` 同性质），2 条为 V0.5 起既有否定式文案「用了**不**扣分」。
- **localStorage：恒 3 个 key**，全部在白名单（`castle.academy.learner` / `castle-academy-world-v1` / `castle-academy-view-v1`），零未知 key。
- **反思零落盘运行时验证**：填写反思「我先看到水沟里有水…」并提交后，全部 localStorage 值中**不含反思文本**（`reflectionPersisted: false`）——AC-7021/7022 直接证据。
- **3 级提示**：V0.7 探索任务「水在哪里出现」3 级逐级展开，`revealRemaining 0`。
- **三条安全文案 / 家长教师说明**：沿 V0.6.1 静态 + DOM 双路径核验口径齐备；`pageErrors []`。

## G2 附条件闭环核对（角色 B 报告 §5 缺口）

| 角色 B NOT RUN 项 | 本次闭环 |
|---|---|
| CHK-711 视觉回归 / canonical / 0 像素差 | ✅ V07-024（anchor 0px + main 0px + 旧 canonical 零改动） |
| CHK-712 运行时安全抽查 JSON | ✅ V07-028（`V07_Safety_Spotcheck.json`） |
| CHK-714 ABBA JSON | ✅ V07-025（`V07_Performance_Paired.json`） |

## 停点

**`V07-029` 发布评审（STOP GATE-3）未启动，须 owner 签核 ACCEPT**；`V07-030` V0.8 交接未启动。版本 / tag / README / release notes 均未动。本次新增 7 个文件（3 脚本 + 3 JSON + canonical 目录 7 个文件）**未提交 git**，等 owner 决定。
