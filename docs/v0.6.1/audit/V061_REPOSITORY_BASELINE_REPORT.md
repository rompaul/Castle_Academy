# V061-001 只读仓库基线报告（V0.6.1 电力系统）

**日期**：2026-11-13
**审计类型**：Phase 0 只读审计（V061-001~003）
**审计对象**：`Castle_Academy_V0.1_Source` @ master `1052a24`
**批准基线候选**：tag `v0.6.0` → `0bd6e4fdcd739ce61ebc8cee89c0374460f342d8`（V0.6 发布提交）

> 标注口径：**FACT** = 本轮命令/源码直接证实；**INFERENCE** = 基于 FACT 的推断；**UNKNOWN** = 本轮未验证。测试未运行一律写 NOT RUN。

## 1. G0 结论：✅ PASS（发布对象已确认）

| 项 | 结果 | 证据 |
|---|---|---|
| 工作树 | **干净**（`git status --short` 空） | FACT |
| 分支 / HEAD | `master` / `1052a24` | FACT，`git log --oneline -3` |
| 最近 3 提交 | `1052a24` docs 措辞 / `6745bd3` README→V0.6.0 / `0bd6e4f` V0.6 Phase 4 | FACT |
| tag | `v0.6.0`, `v0.5.1`, `v0.5.0`, `v0.4.0`, `v0.3.0`, `v0.2.0`；**无 `v0.6`** | FACT，`git tag -l --sort=-creatordate` |
| tag 指向 | `v0.6.0` → `0bd6e4f`；`v0.5.1` → `0821dbf` | FACT，`git rev-list -n1` |
| 远程同步 | `refs/heads/master` = `1052a24`；`refs/tags/v0.6.0^{}` = `0bd6e4f` | FACT（2026-11-13 10:2x `git ls-remote origin`） |
| `package.json` 版本 | `0.6.0` | FACT |
| V0.6 canonical | `docs/v0.6/screenshots/canonical/world-canvas-anchor-v060.png`、`world-main-v060.png` | FACT |
| V0.6 发布记录 | `docs/v0.6/V060_Release_Notes.md`，GATE-3 已 ACCEPT | FACT |
| V0.6 报告 | `docs/v0.6/audit/` 6 份；GATE-2 截图 `docs/v0.6/screenshots/gate2/` K1~K6 | FACT |

**FACT 结论**：V0.6 已实现并发布，发布对象为 tag `v0.6.0` / commit `0bd6e4f`。G0 的「V0.6 发布对象确认」条件达成。
**INFERENCE（口径建议）**：本版批准基线应填 **tag `v0.6.0` / `0bd6e4f`**，不是当前 master HEAD `1052a24`（后两者为发布后的 docs-only 提交，不含功能变更）。V0.5.1 的 `0821dbf` / 文档基线 `768769b` 只作历史追溯，**不得**当批准基线。
**G0 = PASS**；但本轮 Phase 0 结束即停在 **STOP GATE-1**，V061-004 及任何功能代码须 owner 签核三份 ADR 后才启动。

## 2. 仓库结构事实

| 项 | 值 | 证据 |
|---|---|---|
| package scripts | `dev` / `build` / `preview` / `test` / `test:watch` / `test:e2e` / `typecheck` / `verify:source` | FACT，`package.json` |
| 单测 | vitest run；30 文件 / **256 测试** | FACT，`npm test -- --no-file-parallelism` |
| E2E | playwright test；13 个 spec / **47 测试** | FACT，`npx playwright test --workers=1` |
| 视觉脚本 | `scripts/v051-visual-regression.mjs`（硬编码 `docs/v0.51/screenshots/canonical`） | FACT，脚本第 15–16 行 |
| 性能脚本 | `scripts/v051-perf.mjs`、`scripts/v042-perf.mjs` | FACT |
| GATE-2 截图脚本 | `scripts/v06-gate2-screenshots.mjs` | FACT |
| 世界方块 | 25 个 Block ID | FACT，`src/core/world/blocks.ts` |
| 任务 / 评估器 | 15 个 `mission.*` / 15 个 `evaluator.*` | FACT（第 16 个 `evaluatorId: "moat"` 来自 `missions.test.ts:26` 的非法用例，非真实评估器） |
| localStorage | 3 个 key：`castle-academy-world-v1` / `castle-academy-view-v1` / `castle.academy.learner` | FACT |
| AI / LLM 依赖 | **0 项** | FACT，package.json 依赖名正则检索 |
| 设计系统 | `src/ui/tokens.css`（DDR-0001 唯一真源） | FACT |
| 测试桥 | `window.__CASTLE_TEST__` 仅 DEV 暴露（`ThreeWorldRenderer.ts:245`、`:671`） | FACT |

## 3. 电力关键词全库检索（I-3：不得假定不存在）

命令：`grep -rniE "\b<kw>\b|<kw>_" src/ e2e/ scripts/ --include="*.ts" --include="*.tsx" --include="*.mjs"`

| 关键词 | 命中数 | 逐项结论 |
|---|---|---|
| `electrical` | 0 | 无既有实现 |
| `power` | 0 | 无电源实现（`power_source_low_voltage` 为 V0.6.1 候选 ID） |
| `pump` | 0 | **水泵无等价实现**，无需复用既有 ID |
| `valve` | 0 | **阀门无等价实现**，无需复用既有 ID |
| `redstone` | 0 | 禁用词 0 命中 |
| `signal_strength` | 0 | 禁用词 0 命中 |
| `electric` | 10 | 全部来自 V0.6 的 `kp.electric.*` **预留前缀**：`registry.ts:10,40,277`、`registry.test.ts:86-89,120`、`missions.test.ts:144-145`；无电力运行时代码 |
| `wire` | 4 | 3 处英文注释 "No external dependencies to wire up."（`BlueprintPlugin.ts:47`、`BuildingToolsPlugin.ts:31`、`MeasurementPlugin.ts:38`、`PersistencePlugin.ts:47`）+ 1 处截图名 `s3-profile-switch`；无关 |
| `switch` | 4 | 3 处 JS `switch (mode.type)` 语法 / 测试注释 + 1 处截图名；无关 |
| `circuit` | 3 | 全部在 `kp.electric.circuit.closed` 预留 ID 的测试/注释里 |

**FACT 结论**：V0.6 交付的是「知识点前缀预留 + schema v2 容器」，**没有任何电力机制实现**；阀门 / 泵无既有等价物，9 个候选 ID 必须新建。I-3 的「无等价实现」假设成立。

## 4. 目标领域 ↔ 现有模块差异表

| 目标领域 | 现有模块 | 结论 |
|---|---|---|
| 电路图算法（六邻接 / 连通分量 / 二值 / 多源冲突） | 无；`WaterSim.ts` 的 BFS 可作**算法风格**参考，不可直接复用 | **必须新建**（纯函数，不 import WorldState/UI） |
| 通电派生态 | 无；可参照 `WaterPlugin` 的 `applied` / `target` 派生模式 | **必须新建**（`ElectricalPlugin`） |
| 世界方块 | `src/core/world/blocks.ts` 25 ID + `BlockDefinition` | **需扩展**（只追加 9 个 ID） |
| 16×16 纹理 / 图集 | `src/rendering/textureGenerator.ts` `GENERATORS` / `buildBlockAtlas()` | **需扩展**（新键；不改共享材质、不扩容） |
| 渲染与双态 | `ThreeWorldRenderer.ts` 3 个共享材质 + geometry 缓存 | **需扩展**（派生 overlay，见 Q-1） |
| 水格与传播 | `WaterPlugin` / `WaterSim` | **需扩展**（窄端口注入虚拟水源，水侧独占传播） |
| 任务定义 | `MissionDefinition` schema v2（`src/content/missions/types.ts:28-62`） | **可直接复用**（spike 结论见 `V061_OPEN_QUESTIONS_AND_RISKS.md` §8） |
| 知识点 | `src/content/knowledge/registry.ts` | **需扩展**（追加 `kp.electric.*`，不重命名） |
| 先决条件图 | `resolveMissionGraph()` | **可直接复用** |
| 任务运行 / 奖励 / 档案 | `MissionRuntimePlugin` / `RewardPlugin` / `LearnerProfilePlugin` v2 | **可直接复用**（不新建第二套引擎） |
| 评估器 | `evaluators.ts` / `extendedEvaluators.ts` 注册表 | **需扩展**（追加电力评估器，判定保持确定性） |
| 能力 | `CapabilityRegistry` | **需扩展**（注册 `electric.basic`） |
| UI | `src/ui/mission/` + `tokens.css` | **需扩展**（状态消息 / 热栏分组，轻量 DOM overlay） |
| 存档 | `WorldState.serialize()` / `PersistencePlugin` | **零变更** |

## 5. 待批 ADR 决策清单（STOP GATE-1 用；以下为 Phase 0 交付时状态）

- ADR-0011（电力系统）：14 项待批准决策已在 V061-003 逐项填实，状态 `Finalized（待签核）`。
- ADR-0012（任务与学习）：3 任务 / 1 条链、3 级提示、年龄分档、禁用词。
- ADR-0013（资产与安全）：atlas 实测口径、Q-1 双态方案、安全文案三条、术语表。
- 三份 ADR 的 **批准记录全部 PENDING**，批准基线建议 `v0.6.0` / `0bd6e4f`。

> **2026-11-13 签核后更新（保留上方历史记录）：** owner 签核「批准 ADR-0011/0012/0013，基线 v0.6.0/0bd6e4f；Q-1/Q-3/Q-7 按报告照批」→ 三份 ADR 改为 **Approved**、批准记录回填，STOP GATE-1 **PASS**；批准基线确认为 tag `v0.6.0` / `0bd6e4f`。签核时刻 V061-004 尚未启动；同日稍后 V061-004 已完成（纯电力领域模型 `src/core/electrical/`，见进度日志），实现期证据仍全部 NOT RUN。详见 `01_Execution/V061_Progress_Log.md`。

## 6. 已知偏差 / 风险（本轮新发现）

| ID | 性质 | 内容 |
|---|---|---|
| DEV-607 | 文档估算偏差 | ADR-0013 §3 与风格板 §2 写「现有唯一瓦片约 25 / 余量约 39」；静态解析实际 **31 / 余量 33**。见 `V061_BLOCK_ID_AND_ATLAS_MAP.md`。 |
| DEV-608 | 基线脚本口径 | `scripts/v051-visual-regression.mjs` 硬编码 `docs/v0.51/screenshots/canonical` 与 `docs/v0.5/screenshots/quest_panel_stage.png`；V0.6 canonical 已产出但**未被脚本引用**。V061-025 须新增/改造脚本，否则「以 V0.6 canonical 为锚点」无法兑现。 |
| DEV-601 | 既有 | `npm run verify:source` exit 1（`scripts/v05-quest-screenshots.mjs:5` 未声明 `playwright`）；只读登记，不阻塞。 |
| DEV-602 | 既有 | 视觉回归完整模式重截 S1~S8 canonical 且有延迟二次写入；本轮已备份→运行→恢复，SHA 与 HEAD 一致。 |
| O-1 | 既有 | 顶栏外链字体造成 topbar 10.226% / footer 2.91% 视觉噪声；worldCanvas 0 像素差。 |
| D-2 | 既有机口 | 性能按同机同脚本 ABBA 配对，不套绝对阈值。 |

## 7. 本轮零改动声明

- 源码 / 配置 / 资产 / 测试 / lockfile：**零改动**。
- 测试产物 `dist/`、`test-results/` 已移出仓库；`docs/v0.51/screenshots/{canonical,diffs}` 已逐字节恢复（锚点 SHA `53b02a9b5493ccfc` 与 HEAD 一致，`visual-regression.json` date 回到 `2026-11-10T11:36:23.138Z`）。
- 唯一新增：`docs/v0.6.1/audit/` 下 6 份 docs-only 报告（沿用 V0.6 Phase 0 已批准的交付方式）。

## 8. 下一个 Task ID

**V061-004（纯电力领域模型）** —— 但被 **STOP GATE-1 阻断**：须 owner 签核 ADR-0011/0012/0013 并确认 Q-1~Q-7 定案后才可以启动。本轮 Phase 0 结束即停。
