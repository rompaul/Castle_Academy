# V061-006 开放问题、Q 定案与风险（V0.6.1 Phase 0）

**日期**：2026-11-13
**用途**：V061-003 契约对账交付；STOP GATE-1 签核材料
**基线**：tag `v0.6.0` / `0bd6e4f`

> 本文件把执行包 `09_GOVERNANCE/SOURCE_AND_ASSUMPTION_REGISTER.md` §5 的 Q-1~Q-7 逐项关闭（或显式保留为跨版本 OPEN），并登记本轮新发现。所有结论均基于 `docs/v0.6.1/audit/` 其余 5 份报告的 FACT 证据。

## 1. Q-1 通电/断电双态方案 —— ✅ 定案

**候选**（ADR-0013 决策 4）：(a) 派生 overlay 网格；(b) 通电块独立材质实例 emissive；(c) 顶点色覆盖。

**定案**：**(a) 为主 + (b) 为辅**。
- 导线 `wire_basic` 与 `switch_closed` 的**逐段点亮**用派生 overlay 网格（按连通分量生成的轻量几何，随重算重建），直接兑现风格板 §1「让电走哪条路成为可见现象」与 6–7 档可读性要求。
- `lamp_basic` / `signal_beacon` / `water_pump_basic` 的发光用**独立材质实例**的 emissive 变化，只影响该 blockId 的 mesh。
- **禁止**：修改 3 个共享材质（`ThreeWorldRenderer.ts:200-202`）、烘焙双套纹理、shader overhaul、通电态写回 `WorldState`。
- **fallback**：若 overlay 导致 draw call 超预算，退化为「形状/图标 + DOM 状态消息」（`还没接通` / `通电了` / `开关断开` / `电源冲突` / `水泵没通电` / `阀门关着`），仍满足 ADR-0013 决策 6「不只靠颜色」。
- **UNKNOWN（实现期关闭）**：draw call 实测值本轮 NOT RUN；V061-012 必须记录干净世界 draw calls 不回归（基线 **329**）、新电力场景实际值、以及 fallback 是否启用。

**结论**：GATE-1 可定案；实测证据留 V061-012，不伪造已测。

## 2. Q-2 泵进出口几何 —— ✅ 定案

见 `V061_WATER_ELECTRICAL_CONTRACT_MAP.md` §5：
- 出口 = 泵正上方相邻空格 `y+1`，作为二值虚拟水源并入 `WaterPlugin.recalculate()` 的 `sources`（唯一入口，`:125-134`）；利用「下方非空→水平扩散」既有规则。
- 「下方进」仅为儿童叙事 / 视觉方向，**不写入模拟规则**（不消耗水、不要求下方有水），否则会改 `WaterSim` 并破坏 V0.5 基线 20 条 E2E。
- 阀门阻断在 `WaterWorldQuery.blockAt()` 适配层表达，不改 `computeWater()` 规则函数。
- 不改水规则、不引入压力/流量/泵曲线（Q-6 归 V0.7）。

## 3. Q-3 电力任务数量与先决条件链 —— ✅ 定案

- **3 个电力任务**（A 点亮灯 / B 诊断断路 / C 泵+阀+水联动），与 `V061-018`「3 个电力任务」及 ADR-0012 决策 4「3~5 个」一致。
- **1 条链**：`A → B`（B 的 `prerequisiteMissionIds: ["<A>"]`）；**C 保持 `[]`**。理由：ADR-0012 决策 4「1~2 条链、锁定只作用于可选任务、不影响自由建造与基础资源」；只锁 B 一个可选任务，低龄儿童可先玩 A 或直接接触 C 的拆分版，不形成多重门禁。
- 活动 C 按执行包定案：默认 **11+**，低龄拆成单系统子任务 C1（通电让泵转）/ C2（阀门让水流），不在同一任务并列 5 种失败原因。
- 3 级提示阶梯固定「现象 → 位置 → 操作」；年龄分档 6–7 / 8–10 / 11+ 靠**任务形式与提示**，不靠改名（PD-014）。
- 新任务引用 `resolveMissionGraph()`（V0.6 纯函数），须通过环/悬空检测；**不得**把链加到 V0.5 的 7 个 E2E 硬断言任务上（DEV-604 仍有效）。

## 4. Q-4 Atlas 唯一瓦片余量 —— ✅ 定案（附偏差）

见 `V061_BLOCK_ID_AND_ATLAS_MAP.md` §3：
- 8×8 = **64** 上限；静态解析运行时等价唯一瓦片 **31**，**余量 33**。
- **DEV-607**：起草期 ADR-0013 §3 / 风格板 §2 估算「25 / 余量 39」，实际少 6 格余量。
- 定案：不扩容（改 `ATLAS_COLS/ROWS` 会改变 UV 归一化并引发全量视觉差异）；不烘焙双套纹理；新增 9 类按「每类 ≤2 个新绘制函数 + bottom 复用既有共享函数」设计，目标 ≤49 格；**V061-007 运行时实测 `next`，>64 立即 BLOCKED**。

## 5. Q-5 V0.6 发布对象（本包首要阻断项）—— ✅ 关闭

- **G0 = PASS**。发布对象 = tag **`v0.6.0`** → commit **`0bd6e4f`**（`package.json 0.6.0`；V0.6 canonical 2 张；GATE-3 ACCEPT；master + tag 已推 GitHub）。
- 本版批准基线建议填 **`v0.6.0` / `0bd6e4f`**；当前 master HEAD `1052a24` 只是发布后的 docs-only 提交。
- **禁填** V0.5.1 的 `0821dbf` 或文档基线 `768769b`。
- 仓库只有 `v0.6.0`，**没有 `v0.6`**；GitHub Release 页须选完整 tag（owner 手动，PAT 403）。

## 6. Q-6 旧路线 V0.7 工程模拟归属 —— ⏸ 跨版本 OPEN（按原定案保留）

- 水压 / 流速 / 泵曲线等工程模拟不静默丢弃，归属 **V0.7 Experiment 方向**，V0.7 起草时最终确认。
- 本版明确 **不做**：不计算压力/流量/曲线、不引入真实电气数值、不迁移现实布线步骤。
- 登记为 OPEN 而非「已关闭」，符合 V0.6 Phase 0 的 Q-5 定案口径。

## 7. Q-7 安全文案与「电」术语表 —— ✅ 文案定稿，签核时 owner 审校

三条（ADR-0013 决策 10 / R-628，替代原稿单一免责声明）：
1. **首次引导（儿童可见）**：「城堡里的电是游戏里的规则；现实里的电很危险，不要碰插座和电线。」
2. **帮助面板常驻**：同一句 + 「这里只玩通和断，不学真实接线」。
3. **家长 / 教师说明（文档与发布说明）**：明确虚构二值规则模型、不含真实电气知识、无可迁移到现实的操作步骤，建议成人陪同低龄儿童。

术语表：用「电源 / 电线 / 开关 / 灯 / 信标 / 水泵 / 阀门」；禁用「红石 / Redstone、信号强度、充能、中继、逻辑门、电压/电流/电阻数值、插座、家用布线」。内部 ID 含 `low_voltage` 可保留但**不得暴露给儿童**。
**残留待办**：owner / 家长视角审校结论在 STOP GATE-1 签核时确认；V061-022 落地三条并做禁用词扫描 0 命中。本轮全库检索 `redstone` / `signal_strength` 均 **0 命中**（FACT）。

## 8. schema v2 电力任务 spike（不落盘）

**方法**：逐字段对照 `src/content/missions/types.ts:28-62` 的 `MissionDefinition` 与 V0.6 双模校验 `validateMissionDefinition()`（v2 要求 `schemaVersion: 2` + `knowledgePointIds` 非空且每个 ID 已注册）。

| 电力任务所需字段 | v2 是否支持 | 说明 |
|---|---|---|
| `id` / `version` / `title` / `context` / `goal` | ✅ | 通用 |
| `ageScope` / `expressionForms` | ✅ | 覆盖 6–7 / 8–10 / 11+ 与 5 种表达形式 |
| `requiredCapabilities: ["electric.basic"]` | ✅ | V061-017 在既有 `CapabilityRegistry` 注册 |
| `knowledgePointIds: ["kp.electric.*"]` | ✅（注册后） | V061-017 追加注册；当前预留前缀未注册，校验会拒（V0.6 `registry.test.ts:86-89` 已断言） |
| `hintLadder`（3 级） | ✅ | 通用数组，无长度上限约束 |
| `prerequisiteMissionIds` | ✅ | V0.6 `resolveMissionGraph()` 已消费 |
| `evaluatorId`（电力评估器） | ✅ | V061-021 注册确定性评估器 |
| 掌握证据 | ✅ | 复用 `MasteryEvidenceRecord` / 档案 v2，无需迁移 |

**结论**：**装得下，无需改 schema、无需造第三套格式**（与 V0.6 Phase 0 spike 结论一致，R-605 维持降级）。**UNKNOWN**：未构造运行时对象调用 `validateMissionDefinition()`（Phase 0 只读、不落盘）；V061-018 实现时须实际通过内容校验。

## 9. 本轮新发现与偏差登记

| ID | 内容 | 影响 |
|---|---|---|
| **DEV-607** | atlas 实际 31 瓦片 / 余量 33，文档估算 25 / 39 | Q-4 收紧为 ≤2 新函数/类；V061-007 必测 |
| **DEV-608** | 视觉回归脚本硬编码 V0.51 canonical，V0.6 canonical 未被引用 | V061-025 须新增/改造脚本，否则「V0.6 锚点」无法兑现 |
| **DEV-609** | 全库 `evaluatorId` grep 得 16 个，其中 `evaluatorId: "moat"` 来自 `missions.test.ts:26` 的**非法用例**，非真实评估器 | 真实仍 15 个；报告统一写 15，避免误认为契约变更 |
| DEV-601 / DEV-602 / O-1 / D-2 / DEV-604 / DEV-605 | 既有，口径不变 | 见 `V061_TEST_AND_PERFORMANCE_BASELINE.md` §5 与 `V061_REPOSITORY_BASELINE_REPORT.md` §6 |

## 10. ADR 状态（V061-003 交付 → 2026-11-13 签核后更新）

Phase 0 交付时三份 ADR 均为 `Finalized（待签核）`、批准记录 PENDING；**2026-11-13 owner 完成 STOP GATE-1 签核**后状态如下：

| ADR | Phase 0 状态 | 当前状态 | 批准记录 |
|---|---|---|---|
| ADR-0011 电力系统 | Finalized（待签核） | **Approved（2026-11-13）** | Product Owner / 技术 owner APPROVED；批准基线 tag `v0.6.0` / `0bd6e4f` |
| ADR-0012 任务与学习 | Finalized（待签核） | **Approved（2026-11-13）** | 同上；Q-3 / Q-7 按报告照批 |
| ADR-0013 资产与安全 | Finalized（待签核） | **Approved（2026-11-13）** | 同上；Q-1 / Q-4 / Q-7 owner 审校通过 |

**口径**：Phase 0 的「定稿 ≠ 批准」已由本次签核解除 —— 三份 ADR 现为 Approved，STOP GATE-1 **PASS**；但**签核 ≠ 实现**，本轮与签核后均未写功能代码，V061-007 / 012 / 018 / 022 / 025 的实现期证据仍全部 NOT RUN。签核原文与逐项条件见 `01_Execution/V061_Progress_Log.md`「STOP GATE-1 签核记录」。

## 11. 风险登记（Phase 0 视角）

| 风险 | 等级 | 缓解 / 归属 |
|---|---|---|
| atlas 溢出（64 上限，实际余量 33） | 中 | V061-007 实测；溢出即 BLOCKED，不静默扩容 |
| 双态 overlay 破坏 3 个共享材质 / draw call 预算 | 中高 | Q-1 定案 + V061-012 实测 + fallback |
| 电↔水事件递归 / 每帧图扫描 | 高（停止条件） | 冻结单向事件顺序，V061-011/016 事件环守卫测试 |
| 含新 ID 存档在旧版本被原子拒绝 | 中（已知限制） | 写进 release notes，不改 `WorldSnapshot v1` |
| 安全文案三条缺一 / 禁用词出现 | 高（停止条件） | Q-7 owner 审校 + V061-022 扫描 0 命中 |
| 干净世界 0 像素差被新 overlay 破坏 | 高（停止条件） | V061-025 以 V0.6 canonical 为锚点（DEV-608 须先修） |
| 性能误判 | 中 | D-2 ABBA 配对，绝对阈值不适用 |
| GitHub Release 页 403 | 低（流程） | owner 手动建页，选完整 tag `v0.6.1` |

## 12. 结束条件与下一个 Task ID（2026-11-13 签核后）

- **STOP GATE-1：✅ PASS（2026-11-13）**。owner 已 ① 签核 ADR-0011/0012/0013；② 按报告照批 Q-1 / Q-3 / Q-7，其余沿用 Phase 0 定案（Q-6 跨版本 OPEN）；③ 确认批准基线 `v0.6.0` / `0bd6e4f`。
- 下一个可启动 Task ID：签核时为 **V061-004（纯电力领域模型）**，owner 于同日下达「开始 V061-004」后已完成（PASS，见 `01_Execution/V061_Progress_Log.md`）；**当前下一个可启动 Task ID = V061-005**，仍按「一次只执行一个 Task ID、不自动进入下一任务」规则等待单独口令。
- Phase 0 与本次签核均**零源码改动**；交付为 `docs/v0.6.1/audit/` 6 份报告 + 三份 ADR 定稿/批准记录 + 执行包与路线图状态同步。

## 13. STOP GATE-1 签核记录（2026-11-13）

| 项 | 内容 |
|---|---|
| owner 签核原文 | 「批准 ADR-0011/0012/0013，基线 v0.6.0/0bd6e4f；Q-1/Q-3/Q-7 按报告照批」 |
| 批准基线 | tag `v0.6.0` / `0bd6e4f`；**不是** `1052a24` / `0821dbf` / `768769b` |
| Q-1 | 派生 overlay 网格（导线逐段点亮）为主 + 独立材质实例 emissive（灯 / 信标 / 泵）为辅；不改 3 个共享材质、不烘焙双套纹理；fallback = 形状图标 + DOM 状态消息；draw call 实测留 V061-012 |
| Q-3 | 3 个电力任务 + 1 条链 `A → B`，C 保持 `[]`；活动 C 默认 11+、低龄拆 C1/C2；不得触碰 DEV-604 的 7 个 E2E 硬断言任务 |
| Q-7 | 三条安全文案与「电」术语表 owner / 家长视角审校通过；V061-022 落地并做禁用词扫描 |
| Q-2 / Q-4 / Q-5 / Q-6 | 前三项沿用 Phase 0 定案；Q-6 **维持跨版本 OPEN**（V0.7 Experiment 方向） |
| 签核时 NOT RUN | V061-007 atlas 运行时实测、V061-012 draw call 实测、V061-018 schema v2 运行时校验、V061-019 三级提示、V061-022 禁用词扫描、V061-025 V0.6 canonical 锚点（DEV-608 须先修） |
| 状态同步 | 三份 ADR、进度日志、两个 README、manifest、范围与验收 §10、基线审计指引、来源与假设登记册 §5.1、发布清单、VERSION_ROADMAP.md |
| 后续门禁 | STOP GATE-2（角色 B + E1~E9 截图）、GATE-3（发布评审 ACCEPT）仍 PENDING |
