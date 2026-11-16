# V0.7.1 Release Candidate 复验报告

**日期：** 2026-11-16 · **基线：** `v0.7.0` / `96e34fe`
**状态：** 功能与测试已完成，等待 owner 决定是否提交 / 发布。当前**未**改版本号、**未**打 tag、**未**提交 git。

## 1. 交付内容

- 1 条新任务：`mission.bridge-repair.v1`（修复王国旧桥），任务 24→25、评估器 24→25。
- 3 个 append-only 知识点（面积 / 乘法 / 材料数量），知识点 24→27（owner D3）。
- 1 个新 localStorage key `castle.academy.v071.progress`（owner D2），白名单 3→4。
- 场景化设计工作台 + 局部地图 + 测量 + 实时面积/材料 + 分级提示 + 知识卡。
- 动态河道 / ghost 蓝图 / 手动施工 / 确定性施工评估器 / 幂等材料包解锁 / 旧水井预告。

## 2. 复验结果

| 项 | 结果 |
|---|---|
| typecheck | 0 |
| build | 0（既有 chunk-size 警告） |
| 单元测试 | **59 文件 / 427 用例全绿** |
| E2E | 见 §3 |
| `git diff --check` | 0（仅有已知 `core.autocrlf` LF→CRLF 提示） |
| 3D 锚点 | **0 像素差**（V0.6 canonical `world-canvas-anchor-v060.png`） |
| 安全抽查 | 禁用词 0 命中；4 key 白名单；第 4 key 只含任务/奖励 ID；pageErrors [] |
| 性能 ABBA | 干净世界 A1/A2 均 **329 dc**，不回归；施工态 B 397 dc，单独归因 |
| 外部请求 | 仅 O-1 Google Fonts 既有外链；零 LLM / 云账户代码路径 |

## 3. E2E

- 新增 `e2e/v071-bridge-design.spec.ts`：2 条全绿（主流程 + 失败路径）。
- 首轮全量 `--workers=1`：**48 passed / 1 failed**；唯一失败为 `water-quests.spec.ts` 的 `page.goto` 30s 超时，页面快照未渲染，属软件渲染 / 遗留 server 等待（与 V0.6.1 / V0.7 已登记现象同型）。单 spec 重跑 **3/3 PASS**。
- 最终干净全量复跑：见下方「最终全量复跑」小节。

### 最终全量复跑

**`npx playwright test --workers=1`：49/49 一次全绿（5.3m）。** 首轮单条 `page.goto` 超时已按同型环境等待登记，最终干净复跑无失败。

## 4. 证据文件

- `V071_EXPECTATION_ADAPTATION.md`：19 条单测 + 3 条 E2E 期望值适配清单。
- `V071_4KEY_SECURITY_UPDATE.md`：第 4 key 的 schema / 隐私 / 白名单说明。
- `V071_PHASE1_PHASE6_REPORT.md`：P1~P6 实现摘要。
- `V071_Safety_Spotcheck.json`、`V071_Performance_Paired.json`。
- `screenshots/canonical/`：V0.7.1 锚点 + 设计工作台 + 施工态新截图。

## 5. 未做的事（需 owner 决定）

1. 是否本地提交并推送 git。
2. 是否把版本从 `0.7.0` 升到 `0.7.1`、改应用内文案、打 tag 并做正式发布。
3. 是否更新 README / 路线图 / 产品文档（历史版本报告按先例不改）。
4. 真实儿童可用性观察（规格 §15）尚需 owner 安排；本报告只覆盖技术验收。
