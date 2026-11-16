# V07-023 — 角色 B 独立验收报告（STOP GATE-2）

**Verdict: FULLY SATISFIED**（范围裁定见 §0）
**Baseline: tag v0.6.1 / f0980b8d3174ca819a961738fe6dd14264290b09（verified: yes）**
**日期：** 2026-11-16
**放行依据：** owner 2026-11-16 口令「放行，开始验收（推荐）」+「git 先不提交，等验收之后」；本报告为 owner 允许的 docs-only 输出。
**独立性声明：** 本验收全程只读——零源码改动、零 git 提交、零版本 / tag 变更；发现的问题仅做重跑复核，未改任何代码或测试。

---

## 0. 判定范围裁定（供 owner 复核，可推翻）

角色 B 指令要求「全部阻断项关闭且证据可复核」才可写 `FULLY SATISFIED`。但 `TASK_BREAKDOWN.md` 明确 `V07-024`（canonical / 像素差）、`V07-025`（ABBA）、`V07-028`（运行时安全抽查）**排在 V07-023 之后**（`024 依赖 023`）。因此本报告按执行包内在流程把 CHK-711 / 712 / 714 的**运行时证据**记为 NOT RUN——它们是 G2 之后任务的待产证据，不是本阶段阻断项；**G3 前必须全部闭环**。若 owner 不认可此裁定，本 verdict 应改读为「范围内 FULLY SATISFIED、待 V07-024~028 产出后重验」。

## 1. CHK-701~714 逐项结论

| # | 结论 | FACT 证据 |
|---|---|---|
| CHK-701 | **PASS** | `git rev-list -n1 v0.6.1` = `f0980b8d…b09`；HEAD `4f18102`（docs-only）未被当基线，全部 diff 以 `v0.6.1` 对照 |
| CHK-702 | **PASS** | ADR-0014/0015/0016 三份状态行均 `Approved（口径照批 + 完整期望值适配清单补批，owner 2026-11-15）· STOP GATE-1 PASSED`；G2 未越界：canonical / ABBA / 版本号 / tag 零动作，本次仅 docs-only 报告 |
| CHK-703 | **PASS** | 全库 `schemaVersion: 3` 仅 1 处命中且为**负向断言**（`missions.test.ts:156` 验证 v3 被拒）；`LearnerProfileStore.version` 仍只接受 `1\|2`；无第三套任务格式、无新任务类型 |
| CHK-704 | **PASS** | `gate2-diagnostics.json`：`totalMissions 24`、六形式集合齐全；`life-simulation` = 1（`mission.choose-water-route.v1`）；六形式各有专属组件（`V07FormInteractions.tsx` 按 form 分支）与专属纯函数评估器（`interactiveEvaluators.ts`），UI→运行时→评估器判定链由 `v07FormWiring.test.ts` 4 条全绿证明 |
| CHK-705 | **PASS** | 禁串扫描（`Math.random` / `Date.now` / `new Date(` / `fetch(` / `localStorage` / `window.` / `document.` / 计时器）在实现文件 `interactiveEvaluators.ts` / `interactionRecords.ts` / `interactionContracts.ts` **零命中**；禁串断言自身存在于 `interactiveEvaluators.test.ts:193-206` 等 3 个测试；完成判定只由注册评估器只读查询产出 |
| CHK-706 | **PASS** | `MissionRuntimePlugin.ts:399-406`：`submitReflection()` 只写 `interaction.reflections`，不 `evaluate()`、不进 `baseQuery()`、不标记 `freshSessionEvidence`；`interactionRecords.ts` 文件头与实现明确反思不进 `snapshot()`；本地证据面板只列计数与文本 |
| CHK-707 | **PASS** | localStorage 恒 3 个 key（`castle-academy-world-v1` / `castle-academy-view-v1` / `castle.academy.learner`），零新增；`MasteryEvidenceRecord` 5 字段不变；世界存档 0 学习者字段、档案 0 世界字段 |
| CHK-708 | **PASS** | `src/` 全库 `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `axios` / openai / anthropic / supabase / firebase 零实际命中（命中均为注释或 `generateTextureSet` 函数名）；`package.json` 无 AI / SDK 依赖；唯一外部请求为 `src/ui/styles.css:1` O-1 Google Fonts（既有跨版本登记项） |
| CHK-709 | **PASS** | `git diff --name-only v0.6.1 -- src/core src/world src/rendering src/plugins/electrical src/plugins/water src/content/knowledgePoints.ts` 仅 `GameCanvas.tsx`（新增只读 `getElectricalQuery` 暴露，非世界结构变更）；34 BlockId / `WorldSnapshot v1` / 24 知识点 ID / 既有 18 任务 + 18 评估器 ID / 既有事件名零改动（既有 4 个任务内容文件不在 diff 中） |
| CHK-710 | **PASS** | V0.5 基线 6 spec / 20 条 E2E：`git diff --name-only v0.6.1 -- e2e/diagnose.spec.ts …water-quests.spec.ts` 输出为空（逐字节零改动）；适配仅 3 个 `v051-*` spec 共 8 行，逐条留痕 `docs/v0.7/V07-021_EXPECTATION_ADAPTATION.md`，完整清单 owner 已于 GATE-1 批准 |
| CHK-711 | **NOT RUN** | `scripts/v07-visual-regression.mjs` 未创建 / 未运行（属 `V07-024`）；本验收不做像素判定；旧 canonical（V0.6 / V0.51 / V0.6.1）零改动（工作树无 canonical 变更，`V07-022` 报告 §8 边界声明） |
| CHK-712 | **NOT RUN（运行时抽查）** | 运行时安全抽查 JSON 属 `V07-028`。静态部分已 PASS：儿童可见文案禁用词扫描（等级 / 难度 / 年级 / Tier / 掌握度 / 百分比 / 红石 / 星级 / 扣分）**0 命中**（命中均为注释、测试断言、CSS 宽度值、禁用词表本身）；三条安全文案在 `glossary.ts` / `OnboardingFlow.tsx`；6 个新任务 `hintCount` 各 3 |
| CHK-713 | **PASS** | typing guard `isTypingTarget` 覆盖 `App.tsx` 数字键 / `E` / `F` / `Tab` / 滚轮，静态断言（`v07UiTokens.test.ts`）+ 全量单测全绿；5 类新增 CSS 对比度 5.47~14.51 全 ≥4.5:1（`gate2-diagnostics.json`）；S9 截图复核 focus-visible 焦点环可见；`prefers-reduced-motion` 存在于 `v07Forms.css` |
| CHK-714 | **NOT RUN（ABBA / 运行时实测）** | ABBA 配对属 `V07-025`。有界性（三通道 128 / `drop-oldest`）与生命周期（档案切换 `:186-189`、`dispose()` `:206-207`、重置 `:322-328` 全清空）有单测覆盖；重复挂载 / 每帧扫描的运行时实测未做 |

## 2. Reference figures M1~M8 逐图结论

判定口径：结构 / 层级 / 配色 / 文案逐项核对；允许布局微调，不允许功能越界。

| 图 | 对照截图 | 结论 | 要点 |
|---|---|---|---|
| M1 六形式等权 | S2+S3+S11+S12 | 一致（含 1 项已登记差异） | 无独立看板页，以侧栏末尾六条任务代替——符合形式板 §1「不新增全屏模态 / 大 dashboard」红线，**判定可接受** |
| M2 观察清单 | S4+S14 | 一致 | 无文字对错评分；「记下的是地方，不用写句子」 |
| M3 两态对照 | S5 | **一致（红线重点）** | 独立复核截图：无任何物理量 / 数值单位，反向写明「不提任何数值」；「合上·灯亮 / 断开·灯不亮」文字标签不只靠颜色；安全文案「不要碰插座和电线」常驻 |
| M4 假设切换 | S6 | 一致 | 「改错猜想没关系」替代参考图「改了不扣分」，避免反向评分词，符合儿童文案口径 |
| M5 情境决策 | S7 | 一致 | 无真实工程结论、不改 WorldState；截图为第 2 步态（证明可改选与回看），已登记 |
| M6 本地解释卡 | S8 | **一致（红线重点）** | 独立复核截图：「只在本机看」「不上传、不打分」；**零**分享 / 链接 / 上传 / 发给同学 / 评分 / 星级 / 对错 |
| M7 反思输入 | S9+S14 | **一致（红线重点）** | 独立复核截图：零分数 / 星级 / 等级 / 强制填写；「不写也没关系，不影响任务」「不会保存、不会打分、不会上传」 |
| M8 证据面板 | S10+附加 | **一致（红线重点）** | 独立复核截图：计数清单 +「系统不判断写得好不好」；零百分比 / 等级 / Tier / 掌握度 / 排名 |

**4 条红线（M3 物理量、M6 分享外链、M7 分数星级、M8 百分比）独立复核 0 命中。** 6 项已登记差异（`V07-022` §6）均属布局 / 呈现微调，无功能越界。

## 3. Screenshots reviewed

15 张：`docs/v0.7/screenshots/gate2/*.png`（14 张 S1~S14 + 附加掌握证据面板），md5 两两不重复；`gate2-diagnostics.json`：`pageErrors []` / `stepFailures []`。角色 B 独立复看 4 张红线重点图（S5 / S8 / S9 / S10）+ 参考图 8 张文字提取；其余以 V07-022 逐图登记 + 诊断数值交叉验证。

## 4. 角色 B 独立复跑的实跑记录（2026-11-16）

| 命令 | 实测 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test -- --no-file-parallelism` | **55 文件 / 408 用例全绿**（13.2s） |
| `npx playwright test --workers=1`（第 1 轮） | **46/47**——1 条 `v051-mission-sidebar.spec.ts:22` `page.goto` 30s 超时；页面快照显示应用已完整渲染（V0.6.1 顶栏 / HUD 齐全），属软件渲染资源等待，与 V0.6.1 发布时已登记现象同型；该 spec 代码零改动 |
| 同 spec 单独重跑 | **5/5 PASS**（19.8s） |
| `npx playwright test --workers=1`（第 2 轮全量） | **47/47 PASS**（2.4m） |
| `git diff --check` | 0 |
| `test-results/` / `dist/` | 已清理（mv 出工作树） |

## 5. Evidence gaps（逐条，含 NOT RUN 项）

1. **CHK-711 视觉回归 / canonical / 3D 0 像素差** — 待 `V07-024`；G3 前必须闭环。
2. **CHK-712 运行时安全抽查 JSON**（静态部分本报告已 PASS）— 待 `V07-028`。
3. **CHK-714 ABBA 性能配对 JSON / 挂载卸载运行时实测** — 待 `V07-025`。
4. **E2E 首轮 1 条环境型 goto 超时** — 已按重跑协议复核（单 spec 5/5 + 全量 47/47），`V07-026` 正式重跑再记一次。

## 6. Known limitations (accepted)

- V0.5 迁移窗口（`quest-panel` / `quest.*` / 15 旧任务 ID）按 owner 决定保留到本版之后。
- O-1 Google Fonts 外链（`styles.css:1`，既有跨版本登记项）。
- `DEV-601`（`verify:source` exit 1）只读登记，不阻塞。
- 应用内版本文案仍 `V0.6.1`（GATE-3 前口径，截图 footer 可见，符合预期）。
- 零 git 提交（owner 2026-11-16 明确「等验收之后」）；工作树 41 个变动，HEAD `4f18102`。

## 7. Blocking items

none（判定范围内无阻断项；§5 的 NOT RUN 项为 G2 后阶段任务）。

## 8. Recommendation

**放行进入 `V07-024`（视觉回归与 canonical 冻结）。**

`V07-024~028` 完成后，须以本报告 §5 缺口闭环情况重验 G2 附条件，方可进入 `V07-029` 发布评审（STOP GATE-3 仍须 owner 签核）。
