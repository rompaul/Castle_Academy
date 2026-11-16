# V0.8 Handoff Checklist — from V0.7.0

**交接日期：** 2026-11-16 · **来源版本：** `v0.7.0` / released 2026-11-16
**历史先例：** `docs/v0.6.1/V061_V07_Handoff.md`（注意其第 4 行「尚未提交 git」为历史时点文字，不判缺陷）。

## 1. Canonical 锚点（零容差约定）

- **3D 零容差锚点继续用 V0.6 canonical**（`docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png`）：V0.7 复测 0 像素差，V0.8 视觉回归沿用「隐藏全部 HUD 的 960×608 裁剪 + 容差 8/通道」口径（`scripts/v07-visual-regression.mjs` 可复制为 `v08` 版本，只写 `docs/v0.8/`）。
- V0.7 canonical（`docs/v0.7/screenshots/canonical/`，含 `V0.7.0` 版本字样）为 V0.8 的「上一版」全屏对照基准；预期 V0.8 若无 HUD 改动则差异仍只有版本字样。
- 旧 canonical（V0.6 / V0.51 / V0.6.1 / V0.7）一律不重截；全屏差异按 DDR-0001 / DDR-0002 §3 白名单归因，白名单外 BLOCKED 或另提 DDR-0003（仍预留未用）。

## 2. 六类形式实测结论（V0.7 交付状态）

- 六类形式全部有专属组件 + 专属纯函数评估器 + UI→唯一运行时→判定链 wiring 测试（`v07FormWiring.test.ts`）。
- 判定只读通道：`observationLog` / `variableComparison` / `decisionSequence`（可选、有界 128、`drop-oldest`、零落盘）。
- 反思输入与本地解释：可选、零落盘、不进 `baseQuery()`；`textEvidence`（设计说明，V0.51 语义）与反思是两个独立通道，不要合并。
- `completionSuppressed` / `freshSessionEvidence` 语义：会话证据动作与真实世界变化解除档案切换抑制；反思永不解除。回归 `v07CompletionSuppression.test.ts`，动 `MissionRuntimePlugin` 必跑。

## 3. 反思与证据边界（继续有效的红线）

- 反思 / 观察 / 对照 / 决策记录零落盘；localStorage 恒 3 key；`WorldSnapshot v1` 零学习者字段。
- 儿童可见 UI 0 处等级 / 难度 / 年级 / 百分比 / Tier / 掌握度 / 分数 / 星级；禁用词扫描在 `v07-safety-spotcheck.mjs`（豁免登记：禁用词表源 + 既有否定式文案「不扣分」）。
- 文案改动时同步维护 `v07InteractionModel.ts` 的 `FORBIDDEN_CHILD_WORDS` 与 `interactiveMissions.test.ts` 的 `CHILD_FORBIDDEN`。

## 4. Q-6 收口说明与下一步方向

- Q-6 已收口：V0.7 Experiment = 复用既有二值规则的同位置两态对照；**工程模拟（水压 / 流速 / 泵曲线 / 电压电流）仍未进产品**，是 V0.8 Experiment 的自然延伸方向。
- 三个只读查询通道可被任何未来评估器复用；新增通道须沿用「可选 + 有界 + 溢出策略冻结 + 零落盘」四件套。
- 创造类评估目前用 `query.world.all()` 计数；若 V0.8 提升创造评价维度，须先过 ADR（不得引入美观评分 / 排名）。

## 5. 未结项（跨版本累积）

| 项 | 状态 |
|---|---|
| 迁移窗口（`quest-panel` / `CastleQuestPlugin` / `quest.*` / 15 旧任务 ID） | 三次顺延（V0.6.1→V0.7→V0.7 之后）；清理需 owner 授权 + E2E 口径重评 |
| DEV-601 `verify:source` exit 1 | 只读登记，不属发布门禁 |
| O-1 外链字体噪声 | 独立 DDR 未提；`worldCanvas` 0 像素差不受影响 |
| AC-122 软件渲染帧率 | D-2 配对判定口径；`InstancedMesh` 优化候选仍未排期 |
| GitHub Release 页 | 历来由 owner 手动创建（PAT 无 release 写权限，勿重试 `gh release create`） |
| 编号占用 | `V07-001~030` / `AC-7001~7060` / `R-701~720` / `M1~M8` / `ADR-0014~0016` / `DDR-0003`（预留未用）不可复用；V0.8 从新编号段开始 |

## 6. V0.7 发布对象复验数字（交接基线）

typecheck 0 / build 0 / 408 单测（55 文件）/ E2E 47/47（`--workers=1`）/ `git diff --check 0`；anchor 0 px；main 136 px（纯版本字样）；ABBA A 329dc / 44.62ms、B +3.54% 归因 DOM overlay；安全抽查全 PASS；3 key / `pageErrors []`。
