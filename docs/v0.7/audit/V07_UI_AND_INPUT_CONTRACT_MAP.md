# V07-001 · UI / 输入 / token 契约表（只读审计）

**状态：** 全部 FACT（除标注 INFERENCE 的推演）；行号为 2026-11-15 实际源码行号。本文件只登记事实，不含实现方案。

## 1. 任务详情面板（`src/ui/mission/MissionDetailPanel.tsx`）

| 项 | 事实 | 行 |
|---|---|---|
| 组件 / Props | `MissionDetailPanel`；11 项 props 含可选 `onSubmitEvidence?: (text:string)=>boolean`、`ageBand?` | 13-25, 32-35 |
| UI state | `revealed=0`、`note=""`、`noteSaved=false`、`lowAgePath="C1"` | 36-40 |
| 派生量 | `unavailable/completed/locked`、`showLowAgePaths`、`hints`、`isCommunication`、`isElectrical`、`knowledgePoints` | 41-52 |
| 三段分支 | `locked` / `unavailable` / 正常 `else` | 85, 96, 105 |
| 正常分支分段 | 背景 80-83、目标 107-116、进度 118-127、提示阶梯 129-164、知识点卡 166-190、**反思 192-195**、常驻安全提示 197-202、**证据区 204-230** | 80-230 |
| `reflectionPrompt` | `<p className="ca-reflection">{definition.reflectionPrompt}</p>` —— **纯只读文本**，无 input / textarea / contentEditable / onChange | 194 |
| section 标题 | 「换个思路 · 说说你的做法」 | 193 |

**全库唯一文本框 `#ca-evidence-input`：**

| 项 | 事实 | 行 |
|---|---|---|
| 元素 | `<textarea id="ca-evidence-input" class="ca-evidence-input" data-testid="evidence-input" rows={3}>` | 207-215 |
| 可见条件 | 仅 `isCommunication`（`expressionForms.includes("communication")`，:46）且在正常分支内；`locked`/`unavailable` 不渲染 | 46, 105, 204 |
| 受控 | `value={note}` / `onChange` 同时 `setNoteSaved(false)` | 213-214, 37 |
| 提交 | `data-testid="evidence-submit"`「记下我的想法」→ `submitEvidence()` → `onSubmitEvidence(note)` | 65-68, 217-224 |
| 上游接线 | `MissionExperience.tsx:274-276` → `GameCanvas.tsx:50,136` → `ThreeWorldRenderer.ts:348-349` → `MissionRuntimePlugin.submitTextEvidence()` | 见各行 |
| 状态文案 | 「已记下，内容不会被打分，也不会上传」/「至少写 12 个字；只检查长度，不评判内容」 | 225-227 |
| 提交语义 | `trim` + 非空；最短 12 字由 `evaluator.my-design-note` 判定（`extendedEvaluators.ts:158,244`），**只验长度不评内容**，不落盘 | `MissionRuntimePlugin.ts:307-319` |

**证据面板（`src/ui/mission/EvidenceRecordPanel.tsx`）：** JSDoc 明写「只读、平实语言……不显示掌握等级 / 百分比 / Tier，不判负、不排名」（11-15）；Props 仅 `records` / `missionTitleById` / `onClose`，无写回调、无编辑控件（5-9）；尾声「证据只记录你做过什么，不会打分，也不会上传。」（51）。

## 2. 样式与 token（`src/ui/mission.css` 380 行 / `src/ui/tokens.css:2-40`）

**分段（FACT）：** 通用按钮输入 5、OnboardingFlow 39、MissionSidebar 84、MissionDetailPanel 143、RewardReveal 179、V51-016 文字证据 206、媒体查询 217、知识点卡 223、锁定态 239、证据记录面板 245、迁移提示 261、`prefers-reduced-motion` 278、V0.6.1 电力 / 安全 282、低龄子路径 325、**DDR-0002 MC 方块栏 332-333**。

关键类：`.ca-reflection`(172)、`.ca-evidence-input`(207)、`.ca-evidence-actions`(214)、`.ca-evidence-status`(215)、`.ca-kp-*`(224-236)、`[data-testid="mission-locked"]`(240)、`.ca-evidence-panel`(246)、`.ca-notice*`(263-276)、`.ca-safety-*`(294-323)、`.ca-low-age-paths`(326)、`.hotbar-palette-toggle`(334)、`.block-palette*`(339-379)。

**`tokens.css` 全量 35 个 `--ca-*` token（FACT）：**

| 组 | 名称 | 行 |
|---|---|---|
| 规范颜色 10 | `--ca-navy-900/-700`、`--ca-teal-600/-100`、`--ca-gold-500`、`--ca-coral-500`、`--ca-cream-050`、`--ca-slate-600`、`--ca-green-600`、`--ca-red-600` | 4-13 |
| 中性表面 5 | `--ca-surface-white/-muted`、`--ca-border-soft`、`--ca-shadow-panel`、`--ca-backdrop` | 16-20 |
| 间距 6 | `--ca-space-1..6` | 23-24 |
| 圆角 4 | `--ca-radius-sm/-md/-lg/-pill` | 27 |
| 字体 6 | `--ca-font-heading`、`--ca-font-body`、`--ca-text-sm/-md/-lg/-xl` | 30-32 |
| 兼容桥 4 | `--ca-legacy-shell/-bar/-cream/-gold` | 36-39 |

`src/ui/tokens.test.ts:10-49` 锁 10 组颜色值、7 个 token 名、`--ca-space-1: 4px`、`mission.css` 禁硬编码色 / `rgba(`、`var(--ca-` > 80 次、`styles.css` 8 个存量 HUD 选择器、icons 纯 SVG 无 emoji。**V0.7 新 UI 必须全部复用上述 token，不改 `tokens.css` 值、不删存量 HUD 类**（`R-712`）。

`styles.css:1` 有 `@import url('https://fonts.googleapis.com/...')`（O-1 跨版本未结项，本版不修、不在本版新增外部请求）。

## 3. 快捷键与 typing guard（`src/app/App.tsx`）

| 键 | 行为 | 行 | typing guard |
|---|---|---|---|
| `Esc` | 退出 playing、关分类面板 | 145-148 | **无**（在 guard 定义之前） |
| `1`–`9` | 切快捷格 + 选中方块 | 149-154 | **无**（在 guard 定义之前） |
| — | `const typing = target.tagName === "INPUT" \| "TEXTAREA" \| isContentEditable` | **155-158** | 定义点 |
| `E` | 开关「所有方块」分类面板 | 159-162 | ✅ **唯一有 `!typing`** |
| `Tab` | 换建造工具，`preventDefault()` | 163-171 | **无** |
| `F` | 注视切换开关 / 阀门（`toggleFocusedBlock()`） | 172-177 | **无**（只判 `!event.repeat`） |
| 滚轮 | 独立 `useEffect`，`deltaY` 切格；仅判 `paletteOpen` / `deltaY===0` | 183-194 | **无关联** |
| 左键放 / 右键拆 | 在 `ThreeWorldRenderer.ts:271-272,637,645,686-687` | — | — |
| WASD / Space / Shift / 方向键 | `PlayerController.ts:45-47,92-105` | — | — |

**风险（FACT + INFERENCE，`R-711`）：** 新增文本输入后，在输入框内按 `1–9`、`F`、`Tab` 仍可能切格 / 切换开关 / 阻止焦点切换；滚轮完全不看焦点。`V07-018` 必须整体复核 guard 覆盖面并补 E2E。**本版不新增全屏模态**（沿用 V0.6.1 口径）。

**Hotbar / BlockPalette（FACT）：** `App.tsx:460-467` 给 `BlockPalette` 传 `activeSlot/assigned/onAssign/onClose`；`:471-478` 给 `Hotbar` 传 `slots/activeSlot/selected/onSelectSlot/onTogglePalette/paletteOpen`。`Hotbar.tsx:19-46` 渲染 9 格 + 1 个 `aria-label="All blocks"` 入口。

## 4. 事件名全表（FACT，供 V0.7 契约对账）

| 组 | 事件 | 定义 |
|---|---|---|
| `MISSION_EVENTS` 6 | `mission.offered` / `.activated` / `.progress.updated` / `.completed` / `.reward.granted` / `.unlocked` | `src/plugins/mission/events.ts:5-13` |
| `quest.*` 迁移 3 | `quest.updated` / `quest.completed` / `castle.quests.allCompleted` | `src/plugins/mission/evaluators.ts:80-82`（严格 `quest.` 前缀为 2 个，第 3 个按迁移组归入） |
| `electric.*` 3 | `electric.network.changed` / `.load.state.changed` / `.pump.state.changed` | `src/plugins/electrical/events.ts:12-19` |
| `learner.*` 3 | `learner.profile.created` / `.switched` / `.recovered` | `src/plugins/learner/types.ts:61-66` |

`DomainEvent<T>` 5 字段（`src/core/events/EventBus.ts:1-7`）；`emit(eventName, payload, version = 1)`（:29）；`ELECTRICAL_EVENT_VERSION = 1` 显式传入，其余用默认 1。**V0.7 若新增事件须走同一信封、版本化、结构化 payload、前缀冲突检索与契约测试，不改既有事件名。**

## 5. 5 个新组件可挂载性（INFERENCE，spike 不落盘）

`MissionDetailPanel.tsx:204-230` 的证据区已按 `isCommunication` 条件渲染；同类条件渲染可按 `expressionForms` 扩展到 Exploration / Experiment / Problem-solving / Life-simulation，全部落在 `:105` 正常分支内，不需要改导航结构、不需要改 `tokens.css`、不需要改 canvas 视口（`position:fixed` overlay 约束沿用 V0.6.1）。**未运行组件挂载实测，标 NOT RUN**，须由 `V07-013~020` 与角色 B 复核。

## 6. 视觉回归口径（FACT）

V0.6 canonical（`world-canvas-anchor-v060.png`）继续作 **3D 零容差锚点**；V0.6.1 canonical 作 HUD / 电力锚点。`scripts/v061-visual-regression.mjs:17` 仅用 `@playwright/test` 的 `chromium`，像素比较在浏览器内用 Canvas 2D 自写（`:68-147`），逐通道阈值 `>8`（`:118-121`），`yBands` 阈值 `py<76` topbar / `<580` worldUpper / `<684` hotbarBand / else footer（`:125-128`）。**V0.7 需新脚本，只写 `docs/v0.7/`，不得重截 V0.6 / V0.51 / V0.6.1 canonical**（`R-714`）。任何白名单外 HUD 差异必须 BLOCKED 或另提 DDR-0003。
