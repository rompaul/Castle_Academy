# V0.6.0 Release Notes

**版本**：0.6.0（tag `v0.6.0`）
**日期**：2026-11-12
**主题**：知识与任务基础（Knowledge & Mission Foundation）
**批准基线**：`768769b`（V0.5.1 master）；实施 commits `c3b51e2`（Phase 1+2）、`15aeca7`（Phase 3）、`0bd6e4f`（Phase 4 / 发布提交）
**发布状态**：STOP GATE-3 已于 2026-11-12 经 owner 签核 **ACCEPT**；tag `v0.6.0` → `0bd6e4f`，master 与 tag 均已推送 origin。GitHub Release 页由 owner 手动创建（PAT 权限限制），本文件即其文案来源。

## 新增

- **知识点 Registry**（ADR-0008）：19 个知识点（`kp.<domain>.<concept>(.<aspect>)` 四段命名空间，3~4 段冻结正则），`kp.electric.*` 前缀为 V0.6.1 预留。纯数据模块，带 `validateKnowledgePoint()` 校验。
- **任务内容 schema v2**（ADR-0009）：`schemaVersion: 2` + `knowledgePointIds`；v1 旧内容零变更兼容读取（双模校验，v1 行为逐字不变）。
- **先决条件任务链**：15 任务无损迁移到 v2（文案逐字节未动）；仅 3 条先决边（`water-flow→seven-steps→broken-pipe`、`count-bridge→material-budget`），避开全部 E2E 硬断言任务。
- **任务链 UI**（K3/K4）：锁定态「先完成〈任务名〉」、解锁推进态；锁定不阻塞自由建造；`unavailable` 用独立图标区分。
- **任务详情知识点卡**（K2）：平实语言展示本任务用到的知识；无等级/百分比/Tier。
- **确定性掌握证据**（ADR-0010）：任务完成时按知识点落 `MasteryEvidenceRecord`（observation 为评估器产出的确定性摘要）；15 个评估器判定逻辑一行未改。
- **证据记录面板**（K5）：只读、不打分、不上传；空态平实文案。
- **档案 v2 迁移**：`castle.academy.learner` version 1→2 原子迁移（幂等、容错复用 `learner.profile.recovered`）；v1 旧档自动升级。
- **迁移/容错提示**（K6）：右下非模态轻卡片，≤400ms 动画，支持 `prefers-reduced-motion`。
- **`resolveMissionGraph()`**：纯函数图算法（Kahn + 字典序就绪队列），环/悬空/自引用检测。

## 变更

- `MissionSummary` 新增 `locked` 派生视图态与 `prerequisiteTitles`；持久化三态（available/active/completed）不变。
- 新事件 `mission.unlocked`（锁定→可玩转变时发射一次，确定性、可重放）；旧 `quest.*` 事件保留（V0.5 基线兼容）。
- 应用内版本标识与 `package.json` 升至 0.6.0。

## 明确不做（范围红线）

- 零新方块、零渲染/atlas 改动（worldCanvas 视觉锚点 0 像素差）；
- 世界存档 0 学习者字段；localStorage 仍 3 个 key；
- AI/LLM 零参与（依赖清单 0 项）；
- 儿童界面无等级/百分比/Tier/排名。

## 已知限制

- **DEV-601（既有，未修）**：`npm run verify:source` exit 1——`scripts/v05-quest-screenshots.mjs:5` import 未声明的 `playwright`；脚本未被任何 script/config 引用。按治理原则只读登记，不阻塞发布。
- **O-1（既有）**：顶栏外链字体导致 topbar 区域视觉回归噪声 ~10.2%（footer 2.8%），与 V0.5.1 一致；worldCanvas 区域 0 像素差。
- **性能判定口径（D-2）**：同机同脚本 ABBA 配对；绝对帧时间阈值不适用（同机两次 p95 可差 30 倍）。本轮 draw calls 329→329、textured vs flat 帧时间差在噪声内。
- E2E 偶发 `load` 超时（AC-221 等 2 条）为 dev server 冷编译抖动，复跑即过；与产品代码无关。
- 知识点映射表批准时标「21 个」实际去重 19 个（复用重复计数）；ADR-0008 建议 4 段正则与批准的 3 段 ID 冲突，按 ADR「正则实现期冻结」条款定为 3~4 段。

## 验证证据（V06-022~024）

| 检查 | 结果 |
|---|---|
| typecheck / build | exit 0 / exit 0 |
| 单测 | 256/256（V0.5.1 基线 215 → +41 条全绿） |
| E2E | 47/47（V0.5 基线 20 条一行未改） |
| 视觉回归 | worldCanvas **0 像素差**；questPanel 0.01%（≤0.5%） |
| 性能 | draw calls **329→329**；DOM 延迟 p95 ≤0.7ms |
| 数据安全 | 3 个 localStorage key；世界存档 0 学习者字段；AI 零参与 |

## V0.6.1 交接清单

1. **G0 状态**：V0.6.1 实施冻结解除条件 = V0.6 实际发布对象确认（本版本 commit/tag：见 `git tag v0.6.0`）。批准基线**不得**填 `0821dbf`。
2. `kp.electric.*` 前缀已预留未注册；schema v2 spike 结论「装得下，无需改 schema」。
3. `buildBlockAtlas()` 8×8=64 瓦片上限、3 个共享材质——电力方块双态不烘焙双套纹理，须实测瓦片余量（Q-1/Q-4）。
4. 视觉回归分两类：干净世界（V0.6 canonical 锚点 `docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png`）与含电力方块新场景单独冻结。
5. DEV-604 七个 E2E 硬断言任务与 DEV-605（`version: 2` 语义已落地，后续版本号测试须用 `version: 99`）约束继续有效。

## 门禁记录

- G0 / GATE-1 / STOP GATE-1 / GATE-2：2026-11-12 全部 APPROVED（owner 签核，详见 `Castle_Academy_V0.6_Execution_Package/01_Execution/V06_Progress_Log.md`）。
- **STOP GATE-3：ACCEPT（2026-11-12 owner 签核）** —— 已完成打 tag `v0.6.0`、推送 master + tag。**V0.6 RELEASED。** 剩余手工动作：GitHub Release 页（选完整 tag `v0.6.0`；仓库中不存在 `v0.6` 标签）。
- V0.6.1 G0：发布对象确认条件已达成（基线候选 = `v0.6.0` / `0bd6e4f`），但实施仍冻结，须 owner 单独放行 V061-001。
