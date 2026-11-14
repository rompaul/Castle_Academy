# V061-030 — V0.7 交接清单

**日期：** 2026-11-14
**状态：** 交接材料已归档；V0.6.1 尚未提交 git / 未改版本号 / 未打 tag，GATE-3 待 owner 决定
**交接对象：** V0.7 Interactive Learning Missions（含 Experiment 方向）

## 1. 视觉基线（canonical 锚点）

| 用途 | 路径 | 说明 |
|---|---|---|
| 3D 世界零像素差锚点 | `docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png` | **V0.7 继续以此为零容差锚点**，V0.6.1 实测 0 差异 |
| V0.6.1 新冻结 | `docs/v0.6.1/screenshots/canonical/` | `world-canvas-anchor-v061.png` / `world-clean-v061.png` / `world-main-v061.png` / `electrical-scene-v061.png` + `visual-regression.json` |
| 视觉脚本 | `scripts/v061-visual-regression.mjs` | **DEV-608 已修复**：显式引用 V0.6 canonical，不重截旧 canonical；`v051-visual-regression.mjs` 仍硬编码 V0.51，V0.7 不要再沿用 |
| HUD 差异口径 | `DDR-0002_MC_STYLE_BLOCK_BAR.md` §3 | 帮助面板 4 处 + 热栏 1 处为有意变更；白名单之外仍判 BLOCKED |

> V0.7 若继续改 HUD，需新 DDR；3D 世界区域 0 像素差不因 HUD 变更而放宽。

## 2. 双态与开关交互

- 开关 / 阀门两态 = 两个 blockId；`WorldSnapshot v1` 无朝向 / 状态字段，`electricalBlockState.ts` 负责切换与存档往返。
- `F` 键注视切换（`ThreeWorldRenderer.toggleFocusedBlock()`），不占左键 / 右键；帮助面板 `F` 行常驻。
- 学习证据口径（DEV-615 裁定）：**同一位置**的 `closed(灯亮)` + `open(灯灭)` 成对观察才算活动 B 完成；`ElectricalQuery.getSwitchObservations()` 是有界运行时日志，读档 / 重置清空，零落盘。
- 双态视觉：逐段点亮 overlay + 独立材质实例，**不烘焙第二套纹理**；atlas 实测 49/64，8×8 上限仍有余量。

## 3. 术语表与安全文案

- 唯一真源 `src/content/electrical/glossary.ts`：儿童可见对象名、6 类状态消息、三条安全文案、禁用词表。
- 禁用词扫描：`glossary.test.ts`（11 条）+ `scripts/v061-safety-spotcheck.mjs` 独立抽查；三条安全文案因必须逐字含「插座和电线」而单独豁免（AC-6745/6747），不得改写。
- 家长 / 教师说明：`docs/v0.6.1/V061_Parent_Teacher_Note.md`；首次引导 + 帮助面板常驻 + UI 零真实布线步骤，安全靠界面设计而非改名（PD-013 / R-628）。

## 4. 数据与生命周期

- localStorage 仍 3 个 key；世界存档零学习者字段、档案零世界字段；快捷格内容只在运行时内存。
- 派生态不落盘；`ElectricalPlugin` 合并有界重算，`dispose()` / `refresh()` 清空观察日志；无每帧全图扫描、无新增定时器。
- AI 零参与：评估器为确定性纯函数，无 LLM / 云 / 账号 / 外部请求（既有 O-1 外链字体除外）。

## 5. 跨版本未结项（V0.7 需承接）

| 项 | 状态 | 建议 |
|---|---|---|
| 工程模拟（水压 / 流速 / 泵曲线） | Q-6 跨版本 OPEN，归 V0.7 Experiment | V0.7 起草时最终确认范围 |
| 迁移窗口清理（旧 `quest-panel` / `quest.*` 事件、15 个旧任务 ID） | 为保护 V0.5 基线 20 条 E2E 再次顺延 | V0.7 首个独立小版本处理，需单独回归 |
| O-1 顶栏 / footer 外链字体像素噪声 | 保留 canonical，留独立 DDR | V0.7 起可考虑自托管字体或豁免登记 |
| AC-122 软件渲染低帧率 | 已归因，非产品设备瓶颈 | 真机 GPU 复测，不与 SwiftShader 数字比较 |
| DEV-601 `verify:source` exit 1 | 只读登记未修 | V0.7 修 `v05-quest-screenshots.mjs` 的 playwright 声明或移除脚本 |
| GitHub Release 页 | PAT 403，需 owner 手动创建 | 与 v0.5.0 / v0.6.0 / v0.6.1 同批处理 |
| E4/E5/E6/E8 独立场景截图 | Phase 2 视觉脚本 + 集成测试覆盖，无独立 PNG | V0.7 若需逐图评审再补拍 |
| MC 式方块栏后续 | 当前为「全部展开 + 滚动」分类面板 | 如要标签页式分组，另开 V0.7 UI 任务 |

## 6. 编号与文档索引

- 本版占用：任务 `V061-001~030`、验收 `AC-6701~6762`、风险 `R-617~636`、参考图 `E1~E9`、ADR `0011~0013`、DDR `0002`。**V0.7 不得复用**。
- 门禁记录：`docs/v0.6.1/audit/V061_STOP_GATE2_OWNER_RULINGS_2026_11_14.md`（四节）、`V061_ROLE_B_ACCEPTANCE_REPORT.md`（原判定未改写）。
- 验证与发布材料：`V061_PHASE4_VERIFICATION_REPORT.md`、`V061_Performance_Paired.json`、`V061_Safety_Spotcheck.json`、`V061_Release_Notes.md`（DRAFT）、`V061_V07_Handoff.md`（本文件）。
- 独立性能报告 / canonical 集 / tag：GATE-3 后由 owner 决定落地。
