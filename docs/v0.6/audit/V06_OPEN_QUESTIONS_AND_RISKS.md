# V0.6 Phase 0 — 开放问题、风险与 schema v2 Spike

- **报告 ID：** V06_OPEN_QUESTIONS_AND_RISKS
- **Task ID：** V06-003
- **日期：** 2026-11-12 · **性质：** 契约对账结论（FACT + INFERENCE）、待签核定案、不落盘 spike
- **基线：** `768769b`

> ⚠️ **权限边界：** 本报告的「Q 定案」是 **Phase 0 契约对账形成的待签核定案**，用于填充 ADR 供 owner 在 **STOP GATE-1** 批准；**不等于 owner 已批准 ADR**。ADR 状态一律仍为 `Proposed → Finalized for approval`（见 §6），批准记录保持 PENDING。

---

## 1. Q-1 知识点 ID 命名空间（UNKNOWN → 形成定案，待签核）

**结论（写入 ADR-0008 待批版）：** 冻结 `kp.<domain>.<concept>.<aspect>`，四段点分、全小写、段内允许连字符；建议正则：

```
^kp\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$
```

- 依据（FACT）：`V06_MISSION_AND_EVALUATOR_ID_MAP.md` §4 已用 15 个任务的 `learningGoal` 原文映射出 **21 个**不同 ID，命名按学习概念（`kp.water.flow.range`）、不按年龄或学科标签，符合 PD-005 / PD-014。
- `kp.electric.*` 本版**只预留前缀、不注册具体点**；`V06-001` 已证明代码中无既有知识点实现，无命名冲突。
- 不可变性：ID 发布后只追加或标 `deprecated`，不重命名、不删除 —— 因档案里的证据会引用 ID，悬空引用不可接受（ADR-0008 §6）。
- **待 owner 确认：** 21 个 ID 的粒度与用词。这是 Phase 0 无法代替产品判断的一项；V06-004 实现前必须冻结。

**状态：** 信息层面已关闭（无 UNKNOWN），但**决策未批准**。

---

## 2. Q-2 先决条件边数量与具体链条（UNKNOWN → 形成定案，待签核）

### 2.1 硬约束（FACT，本轮新发现）

`V06_MISSION_AND_EVALUATOR_ID_MAP.md` §3 已证明：

- `mission.moat.v1` 在 **2 条 E2E** 中必须能从点击变成 `active`（`v051-mission-detail.spec.ts:51`、`v051-mission-sidebar.spec.ts:70`），在 1 条中必须能变 `completed`（`v051-content-batch1.spec.ts:71`）。
- 共 **7 个任务**被 E2E 直接按标题点击 / 断言可见。
- `src/content/missions/missions.test.ts:63` 断言 `prerequisiteMissionIds === []`，但**只遍历首批 3 个** `CASTLE_WATER_MISSIONS`（moat / well / dungeon）。
- V0.5 基线 20 条 E2E **一行不改**是红线；因此不能靠改 E2E 来让锁定态通过。

**推论（INFERENCE）：** 若给这 7 个任务中任何一个设置前置，其初始派生状态会变成 `locked`，点击后不会进入 `active`，至少 2 条 E2E 立即失败。若给 `moat / well / dungeon` 设置前置，`missions.test.ts:63` 也会失败。

### 2.2 定案提案（3 条边 / 2 条链，全部避开硬约束任务）

只把「被锁定」加在**未被 E2E 点击、且不在首批 3 个**的任务上；上游用已被点击的任务（它们保持无前置、仍 `available`）：

| 链 | 边（上游 → 下游） | 学习逻辑 | 下游 |
|---|---|---|---|
| A | `mission.water-flow.v1` → `mission.seven-steps.v1` | 先观察水向下流，再用计数验证水平扩散上限 | `seven-steps`（未被点击） |
| A | `mission.seven-steps.v1` → `mission.broken-pipe.v1` | 先建立「范围有限」直觉，再诊断管道连通断点 | `broken-pipe`（未被点击） |
| B | `mission.count-bridge.v1` → `mission.material-budget.v1` | 先练一一对应计数，再做总量拆分预算 | `material-budget`（未被点击） |

- **3 条边、2 条链、涉及 5 个任务；其余 10 个保持 `prerequisiteMissionIds: []`。** 符合 ADR-0009 §7「2~3 条真实链、不把 15 个任务串成线性关卡」与 V0.2.1 §2「自由选择、多解路径」。
- 所有上游任务（`water-flow`、`count-bridge`）保持 `[]`，初始 `available`；`CASTLE_WATER_MISSIONS` 三个全部保持 `[]`，`missions.test.ts:63` 不受影响。
- 预期拓扑序（INFERENCE，须由 V06-009 `resolveMissionGraph()` 验证）：`water-flow` → `seven-steps` → `broken-pipe`，`count-bridge` → `material-budget`；无环、无自引用、无悬空、与数组插入顺序无关。
- **待 owner 确认：** 链的选择与条数。若 owner 选择 0 条边（本版不激活任何先决条件），则 ADR-0009 的 `locked` 派生态缺少真实内容验证，需同步调整 V06-011/018 与 K3 参考图的验收口径 —— 这属于范围缩减，必须显式批准并同步到范围、任务分解、验收测试三处。

**状态：** 信息层面已关闭并给出可执行定案；**决策未批准**。此定案同时是 AC-6xx 中「V0.5 基线 20 条 E2E 一行不改」能否达成的关键，须写进 V06-007 任务报告。

---

## 3. Q-3 掌握证据在儿童界面的呈现深度（默认 → 确认）

**定案（与 V0.6 包 `SOURCE_AND_ASSUMPTION_REGISTER.md` §5 默认一致）：** 只呈现「证据记录」的平实文字（例如「已用测量工具验证过一次」），**不显示**掌握等级、百分比、Tier、难度、年级排名或按年龄贴标签；`supportLevel` 仅内部记录。对应 ADR-0010 §7/§8、K5 参考图。

**状态：** 已确认，无 UNKNOWN；随 ADR-0010 一并待签核。

---

## 4. Q-5 旧路线 V0.7 工程模拟归属（跨版本，保留 OPEN）

- FACT：旧 V0.1 路线把水压 / 流速 / 泵曲线归 V0.7；V0.2.1 路线图 V0.7 为 Interactive Learning Missions。
- PD-012 已收敛路线冲突，V0.6 执行包 `01_SCOPE/V06_SCOPE_AND_ACCEPTANCE.md` §3 把工程模拟列为 out of scope，归属「V0.7 Experiment 方向」。
- **本轮不关闭。** 该问题最终确认时点在 **V0.7 起草期**，不属于 V0.6 GATE-1 的前置条件；在此登记以免静默丢弃。Q-6（V0.6.1 包内编号）为同一事项。

---

## 5. schema v2 电力任务字段 Spike（V06-003 交付，不落盘、不写功能代码）

> 目的：验证「schema v2 装不下 V0.6.1 电力任务」这一最贵返工风险（R-605 / ADR-0009 §风险）。**本 spike 只在本报告中以假数据推演，未创建任何 `.ts` 文件、未写入 `src/`、未运行任何代码。**

### 5.1 假数据（一条电力任务，走查 v2 全部新增字段）

```ts
// 纯推演示意，非源码、未落盘
const electricMissionSpike = {
  // —— v1 既有字段（一个不改）——
  id: "mission.electric-lamp.v1",          // 匹配 ^mission\.[a-z0-9-]+\.v\d+$
  version: 1,
  title: "点亮城堡信标",
  context: "…", goal: "…", successMessage: "…",
  ageScope: "8-10",
  expressionForms: ["creation", "experiment"],
  requiredCapabilities: ["building.basic", "electric.basic"],  // 新能力，V0.6.1 注册
  hintLadder: ["…", "…", "…"],              // 3 级（V0.4 LRN-004）
  evaluatorId: "evaluator.electric-lamp",  // 匹配 ^evaluator\.[a-z0-9-]+$
  reward: { kind: "title", title: "…" },
  learningGoal: "…", reflectionPrompt: "…", accessibilityNote: "…",
  progressLanguage: "已接通 {done}/{total} 段", unavailableReason: "…",
  // —— v2 新增字段 ——
  schemaVersion: 2,
  knowledgePointIds: ["kp.electric.circuit.continuity", "kp.system.continuous_path"],
  prerequisiteMissionIds: ["mission.electric-source.v1"]
};
```

### 5.2 字段走查结论（INFERENCE）

| 检查项 | 结论 |
|---|---|
| v1 的 17 个字段能否原样承载电力任务 | ✅ 能。`expressionForms` 已含 `experiment`；`requiredCapabilities` 是字符串数组，可直接放未来的 `electric.basic`；`hintLadder` 支持 3 级提示；`evaluatorId` 正则兼容 |
| `schemaVersion: 2` | ✅ 足够，无需第三套格式 |
| `knowledgePointIds` 引用 `kp.electric.*` | ✅ 命名空间已由 Q-1 预留；多对多（一条任务挂 2 个知识点）可行。注意 `kp.system.continuous_path` 与 V0.6 水任务共用同一 ID —— 正是「同一能力被不同任务引用」的预期用法 |
| `prerequisiteMissionIds` 表达电力任务链 | ✅ 数组可表达 1~2 条链（ADR-0012 §4）；本版 `locked` 派生态可直接复用 |
| 掌握证据：通/断是离散可判定状态，评估器可由世界状态查询确定性产出 | ✅ 符合 ADR-0010「证据来源非任务完成计数、非 LLM」；`MasteryEvidenceRecord` 的 `evaluatorId` 引用 `evaluator.electric-lamp` 即可，无需扩展字段 |
| 世界存档 | ✅ 无影响。电力方块状态用两个 Block ID 表达，`WorldSnapshot v1` 零变更（V0.6.1 ADR-0011） |
| **是否需要改 schema v2** | **❌ 不需要**。本 spike 未发现 v2 装不下的字段 |

### 5.3 识别到的边界（写入 V0.6.1 交接，不属 V0.6 范围）

1. `electric.basic` 是新能力 ID，须由 V0.6.1 在 `CapabilityRegistry` 注册；V0.6 不注册，否则会出现「能力可用但玩法不存在」的 S8 误导。
2. `kp.electric.circuit.continuity` 等具体 ID 须由 V0.6.1 在 Registry **追加注册**（只追加、不重命名），V0.6 仅预留前缀。
3. 电力任务的评估器必须读「派生通电态」而非世界存档字段，否则会违反「派生态不落盘」；这是 V0.6.1 ADR-0011 的契约，不是 schema 缺陷。
4. 若 V0.6.1 未来需要「同一任务按年龄段给不同提示阶梯」，v2 的单一 `hintLadder` 不够 —— 但 PD-014 已定「年龄差异放任务形式与提示阶梯」，做法应是**拆成多个任务**而非给 schema 加年龄分支。本 spike 据此判定无需扩展。

**Spike 结论（写入 ADR-0009 批准记录）：** schema v2 可承载 V0.6.1 电力任务，**R-605 风险降级为「已有证据、无需改 schema」**；V0.6.1 任务直接按 v2 写，不造第三套内容格式。

---

## 6. 待签核 ADR 清单与批准前证据状态

| ADR | 主题 | Phase 0 已提供的证据 | 仍缺（须在后续 Task 产出，不得伪造） |
|---|---|---|---|
| **0008** 知识点 Registry | 基线 SHA `768769b`；15 任务 `learningGoal` 全文；21 个拟注册 ID 映射表；零既有实现的检索证据；与 evaluator / capability ID 命名对照；电力 spike 的 `kp.electric.*` 走查 | Registry 校验测试结果（V06-005） |
| **0009** schema v2 与任务链 | 15 任务 / evaluator ID 全表；`prerequisiteMissionIds` 占位与 15 处 `[]` 的 FACT；E2E 硬约束清单；Q-2 的 3 边 2 链定案与拓扑序；`quest.*` 双事件存在的检索证据；V0.51 canonical 10 张清单；**电力任务 spike 结论** | v1→v2 字段 diff（V06-007）、图谱单测（V06-010）、v1 兼容测试、E2E 证据（V06-024） |
| **0010** LearnerProfile v2 | `isLearnerProfileStore()` / `emptyStore()` / 容错路径复核；3 个 key 盘点；`WorldSnapshot` 零学习者字段；AI 零参与检索证据；既有 `version: 2` 单测需改写的发现 | 迁移单测（V06-016）、15 评估器证据对照、存档 JSON 抽查（V06-024） |
| 0011 / 0012 / 0013（**V0.6.1**） | 本轮**不进行 Phase 0 审计**，因 G0 BLOCKED | 全部（须以 V0.6 实际发布对象重跑） |

**批准记录状态：** 6 份 ADR 的 `Product Owner / 技术 owner / 批准基线 commit / 例外条件` 一律保持 **PENDING**。V0.6.1 三份额外禁止填入 `0821dbf`（须为 V0.6 实际发布对象）。

---

## 7. 保留的 UNKNOWN / 外部依赖（不阻塞 GATE-1）

| ID | 内容 | 处置 |
|---|---|---|
| **SRC-009 / Q-4** | 完整《Castle Academy Product Master Plan V2.0》原文仍未找到 | 保留缺失标注，**不得声称已逐字核对**；不阻塞本包 |
| **Q-5 / Q-6** | 旧路线 V0.7 工程模拟归属 | V0.7 起草时最终确认，见 §4 |
| **V0.6.1 Q-1/2/3/4/5/7** | 双态方案、泵几何、任务链、atlas 余量、发布对象、安全文案审校 | **G0 BLOCKED 实施冻结**，全部不关闭；批准基线 PENDING |
| 外部 | `gh release` 403（fine-grained PAT 缺 release 写权限） | 留 V1.0；不阻塞 V0.6 |
| O-1 | 顶栏外链字体视觉差异（本轮实测 10.206%） | 保留 canonical，留独立 DDR / V1.0 |
| **DEV-601** | `npm run verify:source` exit 1（既有遗留脚本） | 只读登记，见 `V06_TEST_AND_PERFORMANCE_BASELINE.md` §5 |

---

## 8. GATE 判定

| Gate | 条件 | 判定 |
|---|---|---|
| **G0** | 只读审计 + 基线测试完成，证据齐备 | ✅ **PASS**（本轮 6 份报告 + 9 条命令实测；1 项既有失败已登记） |
| **G1 / STOP GATE-1** | ADR-0008/0009/0010 owner 批准；UNKNOWN/CONFLICT 关闭 | ⛔ **PENDING — 未通过**。信息层面的 Q 已形成定案，但 ADR 批准记录仍 PENDING；**不得进入 V06-004** |
| G2 / G3 | 角色 B 验收 / 发布签核 | NOT STARTED |
| **V0.6.1 G0** | V0.6 发布对象已确认 | ⛔ **BLOCKED**（V0.6 未实现、未发布），实施冻结 |

**建议的下一个 Task ID：** `V06-004`（**NOT AUTO-EXECUTED**）。必须待 owner 在 STOP GATE-1 明确签核 3 份 ADR 后，方可使用 `07_CLAUDE_CODE/01_IMPLEMENTATION_EXECUTION_PROMPT.md` 进入 Phase 1。
