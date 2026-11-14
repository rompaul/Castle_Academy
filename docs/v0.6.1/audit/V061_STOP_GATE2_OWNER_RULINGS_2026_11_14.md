# STOP GATE-2 owner 裁定记录（2026-11-14）

- 触发：`docs/v0.6.1/audit/V061_ROLE_B_ACCEPTANCE_REPORT.md` 未判 `FULLY SATISFIED`，列出 DEV-615/616/617 与 2 项高风险。
- owner 原话：「回到『生活中的开关』模型；DEV-616选A，617选A」。
- 前置问题：owner 问「为什么不是一个方块，就像我们生活中的开关一样，按一下开，再按一下关」。
- 回答口径：`WorldSnapshot v1` 每块只有 `x/y/z/blockId`，无状态 / 朝向字段；两态只能由 `switch_open` / `switch_closed` 两个 Block ID 表达。**存储层是两块，体验层与学习证据层必须是一个开关**。

## 裁定 1 — DEV-615：回到「生活中的开关」模型（改代码，不书面接受偏差）

**采用**：把活动 B 的完成证据从「世界里同时存在两个开关方块」改为「**同一开关位置先后出现开 / 合两态，两次评估器结果成对出现**」，逐字回到 `ADR-0012` 决策 5 与 `LEARNING_ACTIVITIES_SPEC.md` §7。

| 层 | 落地 |
|---|---|
| 只读契约 | `src/plugins/electrical/query.ts` 新增 `SwitchObservation`（position / state / lampPowered / sequence）与 `ElectricalQuery.getSwitchObservations()` |
| 派生态 | `ElectricalPlugin` 维护**有界运行时观察日志**（`MAX_SWITCH_OBSERVATIONS = 128`），key = `位置:状态`，逐条冻结、确定性排序；切换走 remove + place 常被合并成一次重算，因此除当前态外还补记变化前的旧态及旧灯态。`refresh()` / `dispose()` 清空，读档不跨世界保留 |
| 评估器 | `electricalEvaluators.ts` 活动 B 改为纯函数 `switchPair()`：按位置聚合观察，只有「同一位置既见过断开且灯灭、又见过合上且灯亮」才完成；不同位置的两个开关**不再构成配对** |
| 红线 | 评估器零历史 / 零落盘 / 零新 localStorage key；观察日志不写 `WorldSnapshot`、不进学习者档案；`WorldSnapshot v1` 零变更 |
| 测试 | `electricalEvaluators.test.ts` 重写活动 B 用例（含旧口径漏洞封堵、观察与因果不符降级）；新增 `switchObservation.integration.test.ts` 用真实 `WorldState + BuildingPlugin + ElectricalPlugin` 验证「按一下开、再按一下关」成对、可逆、读档清空、快照零派生字段 |

### 附带发现并修复的缺口（DEV-618）

只读核对发现：`src/core/world/electricalBlockState.ts` 的 `toggleElectricalState()` 是原子切换函数，但**全库没有任何产品代码调用它**——玩家此前只能热栏选另一个方块 + 手动拆放，上一轮回复里「点击开关即切换」的描述不成立，特此更正。裁定落地时补齐：

- `ThreeWorldRenderer.toggleFocusedBlock()`：注视开关 / 阀门时切换两态，走既有 `removeBlock`/`addBlock` 公共 API（各发一次事件，由插件合并重算并登记成对观察），失败回滚原方块。
- `App.tsx`：新增 `F` 键触发，**不占用左键（相邻格放置）与右键（拆除）**，V0.5 基线键位零变化；`Tab` / 数字键 / WASD 均未改。
- `HelpPanel.tsx`：新增 `F` 控制行；`MissionDetailPanel.tsx`：电力任务详情常驻一句儿童可见提示「看着开关按 F，它会合上；再按一次又断开」。
- 设计取舍：**没有**把左键改成「点开关切换」，因为在体素建造里点击方块表面是「在相邻格放置」的主要手势，劫持后无法从开关表面继续接电线；也**没有**改右键删除语义。

## 裁定 2 — DEV-616 选 A：C1/C2 接入 UI（不再登记为遗留）

- 新增纯函数模块 `src/content/electrical/lowAgeHints.ts`：`isLowAgeElectricalMission()` / `resolveHintLadder()` / `getLowAgePathTitle()`，把「按档案年龄带选哪套 3 级提示」与 React 解耦，便于单测。
- `MissionDetailPanel` 新增可选 `ageBand` prop（由 `MissionExperience` 从 `profile.ageBand` 传入）：**仅 6-7 档查看活动 C** 时显示 C1「让水泵转起来」/ C2「让水流过去」两个单系统子路径按钮，切换即重置已展开提示；其余年龄带与其余任务逐字使用原 `hintLadder`，零 UI 变化。
- 不新增任务 ID、不改 schema、不改任务定义文案（AC-6741 仍逐字对齐规格）；`.ca-low-age-paths` 只用 `tokens.css` 变量，0 硬编码颜色。
- 新增 `lowAgeHints.test.ts`（3 条）覆盖 6-7 判定、C1/C2 各 3 级单系统、非低龄零变化。

## 裁定 3 — DEV-617 选 A：书面澄清低龄知识点挂载

**澄清口径（owner 批准，不改代码）**：`ADR-0012` 决策 3 与 `LEARNING_ACTIVITIES_SPEC.md` §9 中「11+ 才挂抽象电路点」指的是**儿童可见文案不得出现抽象电路术语、电气数值与学科标签**，不是禁止低龄任务在**内部知识点关联**上挂载 `kp.electric.circuit.closed`。

- 任务 A（`ageScope: "6-7"`）挂 `kp.system.continuous_path` + `kp.electric.circuit.closed` 合法：后者在本游戏中作为「一路连起来才会通」的**因果闭环点**使用，label / summary 均为儿童可懂的平实语言，无等级 / 难度 / 年级标签。
- 规格 §6「知识点：`kp.system.continuous_path`（低龄）/ `kp.electric.circuit.closed`（11+）」的斜杠是**按年龄分列示例**，不是互斥约束；本裁定消解该歧义，不再要求改挂知识点。
- `ADR-0012` 决策 3 原文不改（已批准），澄清以本文件 + ADR 附录形式留痕；`V061_ROLE_B_ACCEPTANCE_REPORT.md` 风险 6 关闭。

## 仍未裁定 / 未执行（STOP GATE-2 未通过）

1. **帮助面板 HUD 像素变化（高风险）**：常驻安全条目 + 本轮新增 `F` 控制行 / 电力详情提示，均会改变 V0.6 canonical 的 HUD 区域。需 owner 选 A「开 DDR 声明有意变更」或 B「书面豁免该区域」，否则 V061-025 的 HUD ≤0.5% 判定必然判 BLOCKED。
2. **DEV-608（高风险）**：`scripts/v051-visual-regression.mjs` 仍硬编码 V0.51 canonical；V061-025 必须改造出使用 V0.6 canonical 的 `v061-visual-regression.mjs`。属已批准范围内工作，无需额外裁定，但**不得在 GATE-2 签核前启动**。
3. **DEV-614**：E1 参考图分组槽 / 数字键 1–9 覆盖差异待 owner 确认「点击热栏可达即满足 AC-6715」。
4. 角色 B 报告中的运行时 NOT RUN 项（V061-025 视觉回归、V061-026 性能配对、V061-027 全量回归、release notes 归 V061-029）保持 NOT RUN，不因本轮裁定代填 PASS。
5. **owner 未签核 `FULLY SATISFIED`**；`V061-025` 不启动。

## 本轮验证

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| DEV-615/616 窄测试 | 22/22（4 文件） |
| 全量单测 | **332/332**（41 文件，新增 6 条：DEV-615 集成 3 条 + DEV-616 3 条；`ElectricalPlugin.test.ts` 源码扫描用例因注释出现 `localStorage` 字面量首次 FAIL，已改写注释后全绿） |
| 全量 E2E | **47/47**（V0.5 基线 20 条一行未改） |
| build | 0 |
| 浏览器实测（截图脚本 exit 0、pageErrors `[]`） | E2 通电 `●通电了` / E3 缺口 `○还没接通`；E11 按一下开关后 `◐开关断开`，`switchObservations` = 同一位置 `[2,2,0]` 的 `closed(lampPowered=true)` + `open(lampPowered=false)`；E10 6-7 档 `pathButtons` = [「让水泵转起来」,「让水流过去」]、`hasFullVersionHint=false` |
| GATE-2 截图 | **8 张**（原 6 张重拍 + 新增 `e10-low-age-c1-c2.png`、`e11-switch-open-paired-observation.png`） |
| `WorldSnapshot v1` / 既有 25 Block ID / 既有事件名 | 零变更 |
| localStorage key 数 | 3（无第 4 个） |
| git | 未提交；未改版本号 / tag |

## 第二轮 owner 裁定（2026-11-14 20:00，选项式）

| # | owner 选择 | 落地口径 |
|---|---|---|
| 1 | **写正式变更说明**（原 A：开 DDR） | 帮助面板常驻安全条目 + `F` 控制行 + 电力详情提示属**有意设计变更**，以独立 DDR 声明并重拍 V0.6 canonical 的 HUD 区域；不采用「书面豁免该区域」。DDR 草案待第 3 项定案后一次性起草，避免范围返工。 |
| 2 | **签核后再改** | `v061-visual-regression.mjs`（DEV-608 改造）保持排队；STOP GATE-2 签核且 owner 判 `FULLY SATISFIED` 后才启动。本轮不改脚本、不启动 V061-025。 |
| 3 | **「最好按照 MC 的方式处理方块」**（owner 自由文本，未选给定选项） | 作为新设计方向登记；AC-6715 判据与 `Hotbar.tsx` 是否改动，待 owner 在「本版完整改造 / 本版只做分组 / 留到 V0.7」中选定。本轮不改 `Hotbar.tsx`。 |

> 第 3 项事实核验：`e2e/first-playable.spec.ts:53` 的 V0.5 基线断言为「按 `2` → `Select Dirt` 选中」+「点击 `Select Brick` → 选中」；`Hotbar.tsx` 目前把 `BLOCKS`（34 个）全部平铺为按钮、编号 1..34，`App.tsx` 数字键 1–9 只映射 `BLOCKS[0..8]`。若改 MC 式（分类页 + 9 格快捷栏），须保证默认前 9 格方块不变、按钮 `aria-label` 全局唯一，否则基线 20 条会被破坏。
>
> STOP GATE-2 仍未通过：owner 未签 `FULLY SATISFIED`，V061-025/026/027 仍 NOT RUN。

## 第三轮 owner 裁定（2026-11-14 20:00 之后）

owner 同时确立沟通偏好：**凡需要他做决定，直接给选项；选项用常规语言解释；几个决定就几组选项；推荐项排第一**（已写入用户级与项目级 MEMORY.md）。

| # | owner 选择 | 落地 |
|---|---|---|
| 1（HUD） | 写正式变更说明 | 已产出 `02_ARCHITECTURE/DDR-0002_MC_STYLE_BLOCK_BAR.md`（**Proposed**，待 GATE-2 签核），一次性覆盖帮助面板 + 热栏共 5 处有意变更；不采用豁免。 |
| 2（DEV-608） | 签核后再改 | 保持排队；本轮未改 `v051-visual-regression.mjs`，V061-025 未启动。 |
| 3（DEV-614 / E1） | 「最好按照 MC 的方式处理方块」→ 追问一组选项后选 **「本版就改成 MC 那样」** | 已实现，见下。 |

### 实现清单

- 新增 `src/core/world/blockCategories.ts`：7 类分组覆盖 34 个 BlockId（电力 9 块按 E1 四组）、`QUICK_SLOT_COUNT = 9`、`DEFAULT_QUICK_SLOTS = BLOCKS[0..8]`、纯函数 `assignToSlot()`（重复则交换，保证 9 格唯一）。
- 新增 `src/ui/BlockPalette.tsx`：分类面板，按钮 `Assign <name> to slot <n>`，与快捷格 `Select <name>` 不产生同名冲突。
- 改 `src/ui/Hotbar.tsx`：34 格平铺 → 9 格 + `All blocks` 入口；`aria-pressed` 语义保持不变。
- 改 `src/app/App.tsx`：快捷格 state（仅运行时内存）、数字键 `1–9` / 滚轮切格、`E` 开关面板（输入框 typing guard）、`Escape` 关面板。
- 改 `src/ui/HelpPanel.tsx`：新增 `WHEEL` / `E` 两行，`1 — 9` 文案改「Choose a quick slot」。
- 改 `src/ui/mission.css`：新增纯 token 样式，未动 `styles.css` 存量硬编码 HUD 规则。
- 新增 `src/core/world/blockCategories.test.ts`（7 条）。

### 本轮实测

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| 全量单测 | **339/339**（42 文件；原 332 + 新增 7） |
| 全量 E2E | **47/47**（`--workers=2`；V0.5 基线 20 条逐字节零改动）。首轮默认 7 workers 出现 20 条 `Test timeout 30000ms exceeded`，全部为 `page.goto` / `evaluate` / `screenshot` 的资源等待，**无一条断言失败**；降并发后全绿，属软件渲染环境噪声，本版 E2E 一律低并发。 |
| `npm run build` | 0（chunk >500kB 为既有告警） |
| GATE-2 截图 | **10 张**（原 8 张按新 HUD 重拍 + 新增 `e12-mc-block-palette.png`、`e13-mc-electric-groups.png` 展示可滚动面板的电力四组）；脚本 exit 0、`pageErrors []`。`mcBar` 只读诊断：9 个快捷格 = `BLOCKS[0..8]`、7 个分组标题、34 个方块条目；E2 `●通电了` / E3 `○还没接通` / E10 C1/C2 / E11 同位置成对观察均保持不变。 |
| git | 未提交；未改版本号 / tag |

### STOP GATE-2 状态

**本节记录当时状态；后续见第四节**。角色 B 独立报告未改动其原判定。

## 第四节 — STOP GATE-2 签核与 Phase 4 实测（2026-11-14 晚）

owner 在选项「**签核，开始跑实测（推荐）**」中一次性批准：`DDR-0002` 由 Proposed 转 **Approved**、判定 **`FULLY SATISFIED`**、E1~E9 / GATE-2 截图（10 张）评审通过、授权启动 V061-025~027。角色 B 报告原判定不改写，其风险 1（DEV-608）与风险 2（帮助面板 HUD）的关闭路径分别由 V061-025 新增脚本与 DDR-0002 §3 白名单兑现，由 owner 签核确认闭环。

| 任务 | 结果 |
|---|---|
| V061-025 | **PASS** — 新增 `scripts/v061-visual-regression.mjs` 引用 V0.6 canonical（DEV-608 修复，不重截旧 canonical）；干净世界 3D 区域 **0 像素差**；全屏差异 7.623% 中 **99.84% 落在底部热栏带**（`worldUpper = 0`），按 DDR-0002 白名单归因；电力新场景 `electrical-scene-v061.png` 单独冻结（`powered` / 338 dc）。详见 `docs/v0.6.1/V061_PHASE4_VERIFICATION_REPORT.md` |
| V061-026 | **PASS** — ABBA 同机同脚本：干净世界 329 dc / 45.52ms，通电 338 dc / 45.98ms，帧时间差 **+1.01%**（小于轮内波动，无显著回归）；`V061_Performance_Paired.json` |
| V061-027 | **PASS** — typecheck 0 / 339 单测 / 47 E2E（V0.5 基线 20 条一行未改）/ build 0 / `git diff --check` 0 |

**剩余**：V061-028 安全抽查、V061-029 发布评审、V061-030 V0.7 交接 NOT STARTED；GitHub Release 页待 owner 手动创建（PAT 403）；git 未提交、版本号 / tag 未动。GATE-3 放行需 owner 另行决定。
