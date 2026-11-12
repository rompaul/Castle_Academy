# V0.6 Phase 0 — 任务与评估器 ID 映射表

- **报告 ID：** V06_MISSION_AND_EVALUATOR_ID_MAP
- **日期：** 2026-11-12 · **性质：** FACT 清单 + 提案（明确标注）
- **基线：** `768769b`

---

## 1. 15 个任务 ID 与 15 个 evaluator ID（FACT，一一对应）

提取命令：

```
grep -rhoE 'id: "mission\.[a-zA-Z0-9.-]+"' src/content/missions/ | sort
grep -rhoE 'evaluatorId: "[a-zA-Z0-9.:_-]+"' src/content/missions/ | sort
```

| # | 任务 ID | evaluatorId | 标题 | learningGoal（原文） | 源文件 |
|---|---|---|---|---|---|
| 1 | `mission.moat.v1` | `evaluator.moat` | 注满护城河 | 理解水沿地形扩散有范围上限，用多点布源/管道解决连通性问题 | `castleWaterMissions.ts:15` |
| 2 | `mission.well.v1` | `evaluator.well` | 城堡水井 | 走完「测量 → 规划 → 建造 → 验证」的工程循环，理解水往低处流 | `castleWaterMissions.ts:39` |
| 3 | `mission.dungeon.v1` | `evaluator.dungeon` | 地牢告急 | 通过剖面观察定位问题源，用屏障改变水流路径（因果推理） | `castleWaterMissions.ts:63` |
| 4 | `mission.water-flow.v1` | `evaluator.water-flow` | 水往哪里流 | 通过放置与观察，发现水沿重力向下流、遇到支撑才水平扩散 | `waterExtensionMissions.ts:12` |
| 5 | `mission.seven-steps.v1` | `evaluator.seven-steps` | 七步之约 | 用计数验证水平扩散上限，建立「范围有限」的因果直觉 | `waterExtensionMissions.ts:36` |
| 6 | `mission.channel-dam.v1` | `evaluator.channel-dam` | 渠与坝的选择 | 通过对照实验区分「吸收」与「阻挡」两种改变水流的方式 | `waterExtensionMissions.ts:60` |
| 7 | `mission.garden-water.v1` | `evaluator.garden-water` | 给花园浇水 | 先规划支撑面再引水，理解「地形决定水停在哪里」 | `waterExtensionMissions.ts:84` |
| 8 | `mission.broken-pipe.v1` | `evaluator.broken-pipe` | 断水的管道 | 用连通性诊断断点，理解管道链与水源正交相邻才通水 | `waterExtensionMissions.ts:108` |
| 9 | `mission.reservoir.v1` | `evaluator.reservoir` | 蓄水池容量 | 用格数估算容积，把「容量」变成可数的单位 | `waterExtensionMissions.ts:132` |
| 10 | `mission.count-bridge.v1` | `evaluator.count-bridge` | 计数建桥 | 一一对应地计数，把「需要多少材料」变成可核对的数字 | `crossAgeMissions.ts:12` |
| 11 | `mission.symmetric-gate.v1` | `evaluator.symmetric-gate` | 对称的城堡门 | 用镜像位置理解轴对称，把「形状规则」变成可摆出来的结构 | `crossAgeMissions.ts:36` |
| 12 | `mission.measure-tower.v1` | `evaluator.measure-tower` | 测量塔高 | 走完「测量 → 规划 → 按数建造 → 验证」的循环，理解垂直层数 | `crossAgeMissions.ts:60` |
| 13 | `mission.section-detective.v1` | `evaluator.section-detective` | 剖面侦探 | 用剖面视图建立地下空间方位感，区分「看不见」与「不存在」 | `crossAgeMissions.ts:84` |
| 14 | `mission.material-budget.v1` | `evaluator.material-budget` | 材料预算 | 把总量拆成两部分做预算，练习加法与按计划分配材料 | `crossAgeMissions.ts:108` |
| 15 | `mission.my-design-note.v1` | `evaluator.my-design-note` | 我的设计说明 | 用文字外化设计过程，练习「做法 + 理由」的表达 | `crossAgeMissions.ts:132` |

**FACT：** 数量 15 + 15，ID 一一对应，无重复、无悬空；与 V0.6 执行包登记一致。`grep` 额外命中 `evaluatorId: "moat"` 一处，来自 `src/content/missions/missions.test.ts:26` 的**非法值测试用例**（`{ ...base, evaluatorId: "moat" }`），不是第 16 个评估器。

顺序约束（FACT）：`e2e/v051-content-batch1.spec.ts:43` 断言 `definitions.slice(0,3).map(id)` 等于 `[moat, well, dungeon]`；`v051-content-batch2.spec.ts:47` 断言最后 6 个 ID 等于 `CROSS_AGE_IDS`。**迁移不得改变 15 个任务的数组顺序。**

---

## 2. `MissionDefinition` 字段契约（FACT，`src/content/missions/types.ts` L27–56）

```
id, version, title, context, goal, ageScope, expressionForms,
requiredCapabilities, hintLadder, successMessage, evaluatorId,
reward?, learningGoal, prerequisiteMissionIds, reflectionPrompt,
accessibilityNote, progressLanguage, unavailableReason
```

`validateMissionDefinition()`（L76–120）现有规则：

| 规则 | 位置 |
|---|---|
| 11 个必填字符串非空 | `REQUIRED_STRING_FIELDS` L70–73 |
| `version` 正整数 | L86–88 |
| `id` 匹配 `^mission\.[a-z0-9-]+\.v\d+$` | L89–91 |
| `evaluatorId` 匹配 `^evaluator\.[a-z0-9-]+$` | L92–94 |
| `ageScope` ∈ 4 档 | L95 |
| `expressionForms` 至少一个且合法（6 类） | L96–99, 类型 L10–20 |
| `hintLadder` 至少一条非空 | L100–103 |
| `requiredCapabilities` 字符串数组 | L104–107 |
| `prerequisiteMissionIds` **仅检查是数组，不检查内容** | **L108** |
| `reward` 形如 `{kind:'title', title}` | L109–115 |
| `progressLanguage` 含 `{done}` | L116–118 |

**关键留白（FACT）：** L48–49 注释原文「仅数据占位，V0.6 任务链消费；V0.51 运行时不解析」。3 个内容文件共 15 处全部为 `prerequisiteMissionIds: []`。

**INFERENCE：** v2 的双模校验落点就是 L76–120 与 L108；现有 L108 只验数组类型，因此加边不会触发现有校验失败 —— 校验器本身需要按 ADR-0009 新增 v2 分支（引用存在、非自引用、无环、知识点已注册）。

`MissionSummary.status`（L59–68）已含 `"unavailable"` 视图态；持久化 `MissionStatus`（learner/types.ts L12）仍只有 `available | active | completed` 三态，与 ADR-0009「locked/unavailable 为派生视图态、不落盘」一致。

---

## 3. E2E 硬约束清单（FACT，Q-2 定案的输入）

| 约束 | 位置 | 要求 |
|---|---|---|
| `mission.moat.v1` 点击后必须 `active` | `e2e/v051-mission-detail.spec.ts:51`、`v051-mission-sidebar.spec.ts:70` | moat **不得**被锁定 |
| `mission.moat.v1` 完成动作后必须 `completed` | `e2e/v051-content-batch1.spec.ts:71` | moat 的完成判定不得改 |
| 前 3 个 ID 顺序 | `v051-content-batch1.spec.ts:43` | 保持 moat/well/dungeon |
| 后 6 个 ID 顺序 | `v051-content-batch2.spec.ts:47` | 保持 CROSS_AGE_IDS |
| 15 个任务、字段齐全、种子世界不伪完成 | batch1:18 / batch2:32 | 新增字段不得破坏 |
| `prerequisiteMissionIds === []` | `src/content/missions/missions.test.ts:63` | **仅遍历 `CASTLE_WATER_MISSIONS`（首批 3 个）** |
| 4 个年龄带、5 种表达形式、1 个 communication | batch2:54–57 | 迁移不得改 `ageScope` / `expressionForms` |

被 E2E 直接按标题点击 / 断言可见的 7 个任务（FACT）：

```
moat（注满护城河）、well（城堡水井）、dungeon（地牢告急）、
measure-tower（测量塔高）、section-detective（剖面侦探）、
my-design-note（我的设计说明）、channel-dam（渠与坝的选择）
```

**INFERENCE（重要）：** 若把这 7 个中的任一个设为「有前置 → 初始 locked」，点击卡片不会进入 `active`，至少 2 条 E2E 立即失败。V0.5 基线 20 条 E2E 一行不改是红线，因此 Q-2 只能把这 7 个任务**作为链的上游（无前置）**，或干脆不纳入链。详见 `V06_OPEN_QUESTIONS_AND_RISKS.md` §2。

---

## 4. 知识点 ID 映射提案（INFERENCE / PROPOSAL，未落盘、未经 ADR 批准）

> 这是 ADR-0008「批准前必须提供的证据」中「拟注册知识点 ID 与任务映射表」的 Phase 0 提案，**不是 Registry 实现**，也未写入任何代码。Registry 与校验测试属 V06-004/005（STOP GATE-1 之后）。

命名规则（Q-1 定案，见报告 6 §1）：`kp.<domain>.<concept>.<aspect>`，全小写点分段、段内连字符；本版只注册 15 个任务实际用到的点，`kp.electric.*` 仅预留。

| 任务 ID | 拟注册知识点 ID |
|---|---|
| `mission.moat.v1` | `kp.water.flow.range`、`kp.system.continuous_path` |
| `mission.well.v1` | `kp.water.gravity.downhill`、`kp.engineering.design_loop` |
| `mission.dungeon.v1` | `kp.water.barrier.redirect`、`kp.reasoning.cause_effect` |
| `mission.water-flow.v1` | `kp.water.gravity.downhill`、`kp.water.surface.support` |
| `mission.seven-steps.v1` | `kp.water.flow.range`、`kp.measurement.counting` |
| `mission.channel-dam.v1` | `kp.water.channel.absorb`、`kp.experiment.control` |
| `mission.garden-water.v1` | `kp.water.surface.support`、`kp.engineering.planning` |
| `mission.broken-pipe.v1` | `kp.system.continuous_path`、`kp.reasoning.diagnosis` |
| `mission.reservoir.v1` | `kp.measurement.volume_units`、`kp.measurement.counting` |
| `mission.count-bridge.v1` | `kp.measurement.counting` |
| `mission.symmetric-gate.v1` | `kp.geometry.axis_symmetry` |
| `mission.measure-tower.v1` | `kp.measurement.height`、`kp.engineering.design_loop` |
| `mission.section-detective.v1` | `kp.spatial.section_view`、`kp.spatial.underground` |
| `mission.material-budget.v1` | `kp.arithmetic.partition`、`kp.engineering.planning` |
| `mission.my-design-note.v1` | `kp.communication.explain_reason` |

合计 **21 个**不同知识点 ID（多对多复用，符合 V0.2.1 `LEARNING_MODEL.md` §6）。`kp.electric.circuit.*` 等电力命名空间本版不注册，仅预留字符串前缀。

**INFERENCE：** 21 个 ID 相对 15 个任务不算膨胀，符合 ADR-0008「只注册实际用到的点、不为未来铺满」；但**最终粒度与命名须在 STOP GATE-1 签核时由 owner 确认**，因为 ID 发布后冻结，改名成本极高。
