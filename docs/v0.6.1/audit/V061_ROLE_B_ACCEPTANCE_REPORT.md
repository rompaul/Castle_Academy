# V061 角色 B 独立验收报告（V061-024 · 2026-11-13）

- 验收者：角色 B 独立验收 Agent（只读复核，未跑 build / 测试 / 截图，未修改任何文件）
- 复核对象：Phase 3（V061-017~023）全部新增内容与 DEV-613 裁定执行情况
- 方法：只读 `git status/diff/log` + Grep + Read；源码 HEAD `1052a24`，V0.6.1 全部改动在工作树未提交

## 总判定

**不能判 `FULLY SATISFIED`**。静态复核 15 项中 11 项 PASS，2 项 CONCERN，运行时证据按验收纪律全部 NOT RUN。按 `ACCEPTANCE_TEST_PLAN.md`「未执行一律 NOT RUN，绝不写 PASS」执行。

## 逐项结论（摘要）

| # | 核查项 | 结论 |
|---|---|---|
| 1 | AC-6739 普通 schema v2、无第三套格式 | PASS |
| 2 | AC-6740 知识点已注册、未注册被拦截 | PASS |
| 3 | AC-6741 恰 3 级提示、逐字对齐规格 §6/§7/§8 | PASS |
| 4 | AC-6742/6743 年龄分档 + C1/C2 | **CONCERN**（C1/C2 是孤儿常量，未接入 UI/运行时） |
| 5 | AC-6744 恰 1 条链 A→B、无环无悬空、既有 3 边保留 | PASS |
| 6 | AC-6745/6747 禁用词 0 命中（含豁免） | PASS |
| 7 | AC-6746 三条安全文案齐备、逐字一致 | PASS（release notes 落地点 NOT RUN，归 V061-029） |
| 8 | AC-6748 electric.basic 注册、0 等级标签 | PASS |
| 9 | AC-6711~6714 评估器纯函数/证据/幂等 | **CONCERN**（活动 B 证据口径偏离 ADR-0012 决策 5） |
| 10 | AC-6736 6 类状态消息齐全互斥 | PASS |
| 11 | AC-6752/6753 tokens / overlay / 无全屏模态 | PASS |
| 12 | AC-6760 localStorage 3 key、快照 0 学习者字段 | PASS（静态；运行时抽查 NOT RUN） |
| 13 | DEV-613 裁定核验 | PASS（附追认 CONCERN） |
| 14 | 稳定契约（WorldState/WaterSim/25 Block ID/事件名） | PASS |
| 15 | 风险清单 | 见下 |

## CONCERN 详情

### C-1（中）：C1/C2 低龄路径未接入 UI/运行时
- `src/content/missions/electricalMissions.ts:106-125` 定义了 C1/C2（各 3 级提示、单系统），全库唯一产品外引用是 `glossary.test.ts:117-124`；`MissionDetailPanel` / `MissionExperience` / `MissionRuntimePlugin` 零引用。
- 低龄（6-7）儿童进入活动 C 仍看到完整版第 2/3 级（并列泵/阀/开关多因），与 AC-6743「低龄替代为 C1/C2 单系统子任务」、R-630 缓解措施不符。数据层本身满足「不新增任务 ID、不并列 5 因」。

### C-2（中高）：活动 B 证据口径偏离已批准 ADR-0012 决策 5
- 规格要求「同一电路在开/合两态分别产出未通电/通电，两次评估器结果成对出现」。
- 实现（`electricalEvaluators.ts:8-10,78-80`）改为「世界快照同时存在 `switch_open` + `switch_closed` 两个 BlockId + 一盏通电灯」（两态确实是两个独立 BlockId，见 `blocks.ts:216-223`）。
- 不违反纯函数红线，但属证据语义偏差，需 owner 在 GATE-2 书面接受或要求改回。

### C-3（中）：DEV-613 两处超字面适配，建议 owner 追认
- `e2e/v051-content-batch2.spec.ts:47,49` `slice(9)→slice(9,15)`（保持「批次 2 六个」原语义）；
- `registry.test.ts` / `missions.test.ts` 的 `kp.electric.*`「未注册→已注册」断言语义反转。
- 均已在 `V061_DEV613_EXPECTATION_ADAPTATION.md` 登记、未放松任何断言，但严格讲超出「只改数字期望」字面。

## 风险清单（面向 STOP GATE-2 / V061-025 / V061-027）

| 序 | 严重度 | 风险 |
|---|---|---|
| 1 | 高 | **DEV-608 未修复**：`v051-visual-regression.mjs` 仍硬编码 V0.51 canonical；无 `v061-visual-regression.mjs`。V061-025 不改造脚本则 AC-6750/6751 判据无效 |
| 2 | 高 | **帮助面板常驻安全条目无条件渲染，必然改变 V0.6 canonical HUD 像素**；需 DDR 声明有意变更或 owner 豁免该区域 |
| 3 | 中高 | 活动 B 证据口径（= C-2） |
| 4 | 中 | C1/C2 孤儿常量（= C-1） |
| 5 | 中 | `isAllCompleted()` 覆盖 18 任务改变 `castle.quests.allCompleted` 触发条件（E2E 基线不受影响，V061-027 须验证旧 `quest.updated` 仍是 3 个水任务） |
| 6 | 中 | 低龄任务 A（6-7）挂 `kp.electric.circuit.closed` 与 ADR-0012 决策 3「11+ 才挂抽象电路点」有张力，规格 §6 斜杠口径歧义，需 owner 澄清 |
| 7 | 中 | 「插座」豁免未登记在 `V061_Tester_B_Instructions.md` §4，GATE-2 报告须显式声明 |
| 8 | 中 | 家长/教师说明的 release notes 落地点归 V061-029，NOT RUN |
| 9 | 低 | Phase 1/2 既有改动（WaterPlugin +55 / textureGenerator +195 / ThreeWorldRenderer +151）进入 V061-027 全量回归，需实测归因 |
| 10 | 低 | 3D overlay 颜色常量 `ELECTRICAL_LIT_COLOR` 非 CSS token，按 ADR-0013 决策 7 不属违规，视觉证据须单独归因 |

## 已确认的硬约束核验

- V0.5 基线 6 个 spec 文件（diagnose / diagnose-underground / first-playable / layer-section / persistence / water-quests）**逐字节零改动**（相对 `v0.5.0`/`v0.5.1` tag 亦空）。
- `WorldState.ts` / `WaterSim.ts` tracked diff 为空；既有 25 个 Block ID 与顺序零变更；既有事件名未改。
- 实际被改既有测试 = 3 个 E2E + 10 个单测，性质全部为期望值适配 + 新增负例，未放松任何断言。
- `git diff --check` 空。

（本报告由角色 B 生成于 2026-11-13，静态复核；运行时证据待 V061-025/027。）

## 附录 — 2026-11-14 owner 对 CONCERN 的裁定与处理

全文见 `V061_STOP_GATE2_OWNER_RULINGS_2026_11_14.md`。owner 原话：「回到『生活中的开关』模型；DEV-616选A，617选A」。

| 原结论 | 裁定 | 处理 | 状态 |
|---|---|---|---|
| C-2 / 风险 3（DEV-615 活动 B 证据口径） | **不接受偏差，改回体验视角** | 评估器改 `switchPair()` + `ElectricalQuery.getSwitchObservations()`；同一位置两态配对才完成；补 `F` 键切换交互（DEV-618） | 已改代码 + 单测 / 集成测试 22/22 |
| C-1 / 风险 4（DEV-616 C1/C2 孤儿常量） | **选 A：GATE-2 前补接** | `lowAgeHints.ts` 纯函数 + `MissionDetailPanel` 按 `ageBand` 呈现 C1/C2 | 已接入 + 单测 |
| 风险 6（DEV-617 低龄挂抽象知识点） | **选 A：书面澄清** | 澄清「11+」约束的是儿童可见文案，内部关联因果闭环点合法；ADR-0012 附录 A + 规格 §12 | 已登记，零代码改动 |
| 风险 7（「插座」豁免未登记在角色 B 指令） | 未裁定 | GATE-2 报告显式声明豁免（本文件 §6 已声明） | 保持登记 |
| 风险 1 / 2（DEV-608、帮助面板 HUD） | **未裁定** | 帮助面板本轮又新增 `F` 控制行，HUD 变化范围扩大 | **仍阻断 V061-025** |
| 风险 5 / 8 / 9 / 10 | 未裁定 / 未执行 | 归 V061-025/027/029 | 保持 |

**本复核的总判定不变**：仍**不能判 `FULLY SATISFIED`**——运行时证据（V061-025/026/027、E1~E9 截图评审）依旧 NOT RUN，且 2 项高风险待 owner 裁定、GATE-2 未获 owner 单独签核。
