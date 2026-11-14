# V0.6.1 — GATE-3 评审材料（一页式）

**日期：** 2026-11-14 · **用途：** owner 评审，未点头前不动版本号 / tag / git
**基线：** tag `v0.6.0` / `0bd6e4f` · **当前状态：** 全部功能与验证完成，**GATE-3 未签核**

## 1. 三道门禁一眼看

| 门禁 | 结论 | 证据 |
|---|---|---|
| **STOP GATE-1**（2026-11-13） | **PASS** — ADR-0011/0012/0013 Approved，批准基线 `v0.6.0`/`0bd6e4f`，Q-1/Q-3/Q-7 按报告照批 | `docs/v0.6.1/audit/`（6 份）、`PACKAGE_MANIFEST.json` 的 `stop_gate1_signature_2026_11_13` |
| **STOP GATE-2**（2026-11-14） | **PASS** — 角色 B 独立复核 → 四轮 owner 裁定 → `FULLY SATISFIED` + E1~E9 / 10 张截图评审通过 + DDR-0002 Approved | `V061_ROLE_B_ACCEPTANCE_REPORT.md`（原判定未改写）、`V061_STOP_GATE2_OWNER_RULINGS_2026_11_14.md`（四节）、`DDR-0002_MC_STYLE_BLOCK_BAR.md` |
| **STOP GATE-3** | **待 owner 决定** — 材料齐备，未改 `0.6.0`、未打 `v0.6.1`、未提交 git | 本文件 + `V061_Release_Notes.md`（DRAFT） |

## 2. 验收数字（AC-6701~6762）

| 项 | 结果 |
|---|---|
| typecheck / build / `git diff --check` | 0 / 0 / 0 |
| 单测 | **339/339**（42 文件） |
| E2E | **47/47**，`--workers=2`；**V0.5 基线 20 条逐字节零改动** |
| 干净世界 3D 区域 | **0 像素差**（V0.6 canonical 锚点，960×608 / 583680 像素） |
| 全屏 HUD 差异 | 7.623%，**99.84% 落在热栏带**、`worldUpper = 0`，按 DDR-0002 §3 白名单归因 |
| 电力新场景 | 单独冻结 canonical；`powered` / 338 draw calls |
| D-2 ABBA 性能 | 干净 329 dc / 45.52ms，通电 338 dc / 45.98ms，**+1.01%**（小于轮内波动） |
| 安全抽查 | 禁用词 **0 命中**；3 个既有 localStorage key **零新增**、零字段交叉；三条安全文案 + 3 级提示齐；外部请求仅既有 Google Fonts；`pageErrors []` |
| 稳定契约 | `WorldSnapshot v1`、既有 25 个 BlockId 与顺序、atlas 49/64、3 个共享材质、既有事件名：零变更 |

## 3. 本版有意变更（不是回归）

`DDR-0002`（Approved）：帮助面板新增常驻安全条目 + `F` / `WHEEL` / `E` 控制行；热栏由 34 格平铺改为 **9 格快捷栏 + 7 类分类面板**（`E` 打开、数字键 / 滚轮切格、点方块放进当前格）。AC-6750 的 HUD ≤0.5% 判据由白名单替代并经 owner 签核；**3D 世界 0 像素差未放宽**。

## 4. 已知限制（写进 Release notes）

1. 软件渲染（SwiftShader）约 21.8fps，既有环境瓶颈（AC-122），非产品设备回退。
2. GitHub Release 页需 owner 手动创建：fine-grained PAT 无 release 写权限（403，v0.5.0 / v0.6.0 同因）。
3. 迁移窗口保留旧 `quest-panel` / `quest.*` 事件与 15 个旧任务 ID，清理顺延到 V0.6.1 之后。
4. O-1：顶栏 / footer 外链字体像素噪声，保留 canonical，留独立 DDR。
5. DEV-601：`npm run verify:source` 仍 exit 1（`v05-quest-screenshots.mjs` 未声明 playwright，脚本未被引用），只读登记未修，不阻塞本版。
6. E4/E5/E6/E8 无独立 PNG（由 Phase 2 视觉脚本与集成测试覆盖）。
7. 工程模拟（水压 / 流速 / 泵曲线）归 V0.7 Experiment（Q-6 跨版本 OPEN）。

## 5. 待你点头的三件事

| # | 动作 | 现在的状态 |
|---|---|---|
| 1 | 版本号改 `0.6.1`、提交 git、打 tag `v0.6.1` | **未做**（仍 0.6.0，工作树全部未提交） |
| 2 | Release notes 从 DRAFT 转正式、创建 GitHub Release 页 | 文案已备；Release 页因 403 需你手动 |
| 3 | V0.7 起草（按 `V061_V07_Handoff.md`） | 交接清单已归档，未启动 |

## 6. 证据索引

`V061_PHASE4_VERIFICATION_REPORT.md`（025/026/027）、`V061_028_030_Report.md`（028/029/030）、`V061_Performance_Paired.json`、`screenshots/canonical/visual-regression.json`、`V061_Safety_Spotcheck.json`、`screenshots/gate2/`（10 张）、`V061_Release_Notes.md`、`V061_V07_Handoff.md`、`V061_Parent_Teacher_Note.md`。

## 7. 发布后补录（2026-11-14，GATE-3 ACCEPT）

> 本节为追加记录；上方 §1~§6 是 **签核当时**的评审材料，原文与数字均不改写。

- owner 决定：`ACCEPT，按清单发布（推荐）`。三道门禁全部 PASS。
- §5「待你点头的三件事」中第 1、2 项已执行：`package.json` 0.6.1（含 `package-lock.json` 根包版本追平）、应用内标识 `V0.6.1`、Release notes 定稿、README 同步；第 3 项（V0.7 起草）按交接清单留待 V0.7，本版不启动。
- **最终发布对象复验**（版本号与界面标识变更后重跑）：typecheck 0 / build 0 / **339/339 单测** / **47/47 E2E（`--workers=1` 干净记录）** / `git diff --check 0`；`--workers=2` 复跑有 1 条 `page.goto` 超时，单独重跑 5/5 PASS，属已登记的软件渲染资源等待。
- 应用内版本标识同步后按 V0.51 先例重截 V0.6.1 canonical：3D 锚点仍 **0 像素差**，全屏差异 **7.616%**、热栏带占比 **99.93%**（签核时 7.623% / 99.84% 保留为历史值），电力场景 `powered` / 338 dc，`pageErrors []`。
- 完整记录见 **`V061_POST_GATE3_RELEASE_VERIFICATION.md`**。
- 唯一遗留手工动作：**GitHub Release 页由 owner 手动创建**（PAT 403），文案取 `V061_Release_Notes.md`。
