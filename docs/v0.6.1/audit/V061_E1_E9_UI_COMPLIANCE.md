# V061-023 — E1~E9 参考图对照与 Phase 3 UI 证据

**日期：** 2026-11-13
**状态：** V061-023 交付；截图材料已产出，**STOP GATE-2 的角色 B 独立验收与 owner 签核仍待进行**。
**参考图：** `Castle_Academy_V0.6.1_Execution_Package/03_UI/references/e1~e9*.svg`、`03_UI/V061_Block_Style_Board.md`
**截图：** `docs/v0.6.1/screenshots/gate2/`（6 张，脚本 `scripts/v061-phase3-screenshots.mjs`，exit 0，pageErrors 0）
**截图命令：** dev server `npx vite . --port 5173 --host 127.0.0.1 --strictPort` + `node scripts/v061-phase3-screenshots.mjs`

## 1. 逐图对照

| 图 | 参考图要点 | 实现位置 | 本轮截图 | 对照结论 |
|---|---|---|---|---|
| **E1** 热栏电力组 | 9 类方块、中文可见名、分组：供电/导电·控制·负载·水联动；只追加 ID；选中框用 `--ca-teal-600` + `--ca-teal-100`；不挤压 canvas | `src/core/world/blocks.ts`（9 个 ID 追加在既有 25 个之后，`name` 为「电源/电线/开关（断开）/开关（合上）/灯/信标/水泵/阀门（开）/阀门（闭）」）；`src/ui/Hotbar.tsx` 按 `BLOCKS` 顺序渲染，`block-swatch` 用 `block.swatch` | `e1-help-safety-and-hotbar.png` | ✅ 9 类齐全、ID 只追加、中文名一致、热栏不新增 DOM 层级。**⚠ 差异**：参考图把 9 块画成独立分组槽，实现是追加到既有 34 槽热栏末尾（未改 `Hotbar.tsx` 结构），以免破坏 V0.5 基线 E2E 的槽位断言；见 §3 待确认项 |
| **E2** 电路连通 | 电源 → 电线 → 闭合开关 → 灯；导线逐段点亮；状态「● 通电了」图标 + 文字；通电态是派生、不写回 | Phase 2 `src/rendering/ThreeWorldRenderer.ts` overlay；本轮 `ElectricalStatusBar.tsx` + `src/content/electrical/status.ts` | `e2-circuit-connected.png`（状态条实测 `●通电了`，`getLoadState(4,2,0) = "powered"`） | ✅ 结构与状态一致；overlay 只按 `poweredConductorKeys` 派生，`WorldSnapshot v1` 零变更 |
| **E3** 断路缺口 | 虚线 + 灰文字、不用错误红；「○ 还没接通」；3 级提示一次展开一级 | `status.ts` `no-connection`；`electricalMissions.ts` A 的 3 级提示；`MissionDetailPanel.tsx` 提示阶梯 | `e3-circuit-gap.png`（移除一段电线后状态条 `○还没接通`，`loadState = "no-connection"`）+ `e7-three-level-hints.png` | ✅ 状态与提示层级一致；状态条用 token 描边、不以颜色单独传达 |
| **E4** 开关两态 | 断开 / 合上不同 blockId + 形状；「○ 开关断开 / ● 通电了」；双态可逆 | V061-008 `electricalBlockState.ts`；Phase 2 `V061_PHASE2_IMPLEMENTATION_EVIDENCE.md`（断开开关后只剩 2 段点亮、灯报 `switch-open`，合上恢复） | 未单独拍（Phase 2 视觉脚本 `scripts/v061-electrical-visual.mjs` 已实测双态可逆） | ✅ 行为一致；**截图缺口**见 §3 |
| **E5** 电源冲突 | 同分量 ≥2 电源不供电；「◈ 电源冲突」 | `src/core/electrical/graph.ts`（`source-conflict`）、`rules.acceptance.test.ts` AC-6706、`glossary.ts`/`status.ts` 优先级第一 | 未单独拍 | ✅ 规则与消息一致；缺场景截图 |
| **E6** 泵水联动 | 通电泵在批准出口（正上方）成为虚拟水源；阀门开/闭；「水泵没通电 / 阀门关着」 | Phase 2 `WaterPlugin.ts` + `electricalWater.integration.test.ts`（AC-6723~6730）；`status.ts` 两类诊断 | 未单独拍 | ✅ 集成测试覆盖；缺场景截图 |
| **E7** 3 级提示 + 安全 | 详情层级；已展开 2/3 示例；锁定链「先完成〈…〉」；安全提示（帮助面板常驻） | `MissionDetailPanel.tsx`（提示阶梯 + `isElectrical` 常驻安全条目）、`MissionExperience.tsx`（首次引导 + 锁定态来自 V0.6 `locked` 派生）、`HelpPanel.tsx` | `e7-first-safety-guide.png`、`e7-three-level-hints.png`、`e7-prerequisite-locked.png`、`e1-help-safety-and-hotbar.png` | ✅ 层级、3 级文案、锁定文案、三条安全文案位置一致 |
| **E8** 剖面与跨层电线 | 六正交含 ±Y；剖面只改可见性；热栏/选中/测量/蓝图/存档兼容 | Phase 2 V061-013（`applySectionToMesh` 覆盖 overlay）+ 视觉脚本 `sectioned` 实测（drawCalls / overlaySegments 无异常） | 未单独拍 | ✅ 行为一致；缺场景截图 |
| **E9** 双态风格板 | 9 类 16×16 纹理、通电/断电双态形状 + 亮度同时变化；不烘焙第二套纹理、atlas ≤64 | V061-007 `textureGenerator.ts` 9 类专属绘制函数 + `docs/v0.6.1/audit/V061_ATLAS_RUNTIME_MEASUREMENT.md`（**49/64**，31 基线 + 18 电力）；Phase 2 overlay 独立材质实例 | `e2` / `e3` 间接展示 | ✅ 容量与「不烘焙第二套」一致；风格板本身是设计规格图，未做像素级逐格对照（属角色 B 评审项） |

## 2. UI 硬约束核验（AC-6752/6753/6754）

- **只用 token**：新增样式集中在 `src/ui/mission.css` 末尾，全部使用 `--ca-*` 变量；`HelpPanel.tsx` 只加一个 `className`，未改 `styles.css` 的存量硬编码 HUD 规则；新增硬编码颜色 **0 处**。
- **overlay 不改视口**：`.ca-electrical-status` / `.ca-safety-guide` 均 `position: fixed`，无全屏模态、无 dashboard、无 canvas 尺寸变更；`getByTestId` 钩子齐备（`electrical-status` / `electrical-safety-guide` / `electrical-safety-dismiss` / `electrical-safety-notes` / `help-safety-note`）。
- **无电力方块时状态条为 null**：`deriveElectricalStatus({loadStates: [], blocks: []})` 返回 `null`，干净世界 HUD 不出现新状态条（AC-6750 的 worldCanvas 区域不受影响）。
- **键盘可达 / 对比度 / 不只靠颜色**：状态消息图标（● ○ ◐ ◈ ◇ ▣）+ 文字并置；引导卡用既有 `.ca-btn` 的 `:focus-visible` token 描边；安全条目用 token 的浅色文字与金色图标；`prefers-reduced-motion` 规则保持（新组件无新增动画）。
- **首次引导不新增存储**：会话内一次的标记是模块级变量（`MissionExperience.tsx`），localStorage 仍为 3 个 key（AC-6760）。

## 3. 待 owner / 角色 B 在 STOP GATE-2 确认的差异与缺口

1. **E1 分组呈现差异**：实现保持既有 34 槽热栏、电力 9 块追加在末尾，未做参考图中的独立分组 UI。理由：改 `Hotbar.tsx` DOM 结构会动到 V0.5 基线槽位断言；裁定 A 要求基线 20 条一行不改。请确认「点击可达即满足 AC-6715」，或要求 V0.7 单独做分组。
2. **键盘快捷方式覆盖**：`App.tsx` 数字键 `1–9` 仍只映射 `BLOCKS[0..8]`，电力方块需点击热栏选中。属既有键盘契约，本轮未改（改动会影响 V0.5 基线）。
3. **E4/E5/E6/E8 场景截图缺口**：本轮 6 张截图覆盖 E1/E2/E3/E7 与安全引导；其余 4 图由 Phase 2 视觉脚本与集成测试覆盖，但无独立截图。若 STOP GATE-2 要求「E1~E9 逐图截图」，需补拍后再签核。
4. **HUD 风险（V061-025）**：帮助面板新增一条常驻安全文案会改变帮助面板高度；V0.6 canonical 的 `worldCanvas` 区域不受影响，但 HUD ≤0.5% 判定与 DEV-608（`v051-visual-regression.mjs` 硬编码 V0.51 canonical）须在 V061-025 改造脚本后实测，本轮 NOT RUN。
5. **截图中的 draw calls = 334**：该值来自「侧栏 + 帮助面板同时打开」的截图脚本，视锥裁剪与 Phase 2 无 UI 面板的通电实测 338 不可直接比较；干净世界基线仍是 329，正式配对判定归 V061-026。

## 4. 本轮实测命令与结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm test -- --no-file-parallelism` | **326/326 PASS**（39 文件，2026-11-13）；**2026-11-14 裁定后 332/332 PASS（41 文件）** |
| `npx playwright test --workers=1` | **47/47 PASS**（V0.5 基线 20 条一行未改） |
| `node scripts/v061-phase3-screenshots.mjs` | exit 0，6 张截图，pageErrors `[]`；通电 `●通电了` / `powered`，断线 `○还没接通` / `no-connection` |

## 附录 — 2026-11-14 owner 裁定后新增 / 变更的 UI（需重拍 GATE-2 截图）

| 参考图 | 变更 | 影响 |
|---|---|---|
| E1（帮助面板 + 热栏） | `HelpPanel.tsx` 新增 `F` 控制行「Press the switch or valve you are looking at (on / off)」 | 帮助面板打开态 HUD 高度再增一行；**必须与常驻安全条目一并纳入 V061-025 的 DDR / 豁免** |
| E7（任务详情常驻安全提示） | `MissionDetailPanel.tsx` 电力任务新增 `electrical-toggle-hint`：「看着开关按 F，它会合上；再按一次又断开。左键照旧放方块。」 | 电力任务详情多一行；非电力任务零变化 |
| E7 / §8（低龄路径） | 6-7 档查看活动 C 时新增 `low-age-paths` 两个按钮（C1 / C2）与 `.ca-low-age-paths`（纯 token） | 需补一张 6-7 档活动 C 截图；其余年龄带零变化 |
| E2（电路通电 / 断开） | 新增 `F` 键切换交互，开关两态可逆；状态条与 overlay 逻辑未改 | 双态截图仍有效；建议补一张「按 F 之后」以证明可达 |

> **2026-11-14 已重拍全部 6 张 GATE-2 截图，并新增 2 张**：`e10-low-age-c1-c2.png`（6-7 档 C1/C2）、`e11-switch-open-paired-observation.png`（按一下开关后的断开态与成对观察）。截图脚本 `scripts/v061-phase3-screenshots.mjs` exit 0、`pageErrors []`；`docs/v0.6.1/screenshots/gate2/` 现共 8 张。
>
> 上述 4 处均为**有意变更**，尚未由 owner 在 STOP GATE-2 签核；在 DDR / 书面豁免确定前，V061-025 的 V0.6 canonical HUD ≤0.5% 判定仍应判 BLOCKED。

## 附录 B — 2026-11-14 第三轮 owner 裁定：E1 分组差异已消除

owner 对「按 MC 的方式处理方块」选择 **「本版就改成 MC 那样」**，§3 的第 1 / 2 项不再是待确认差异：

- **E1 分组**：`Hotbar.tsx` 改为 9 格快捷栏 + 分类入口，`BlockPalette.tsx` 按 7 类分组浏览 34 个方块；电力 9 块按参考图 E1 的四组呈现（供电与导电 / 控制 / 负载 / 水联动）。`blockCategories.ts` 为纯分组数据，单测覆盖「34 个 ID 全覆盖且仅一次、顺序与 BLOCKS 一致、电力四组与 E1 一致」。
- **键盘覆盖**：数字键 `1–9` 与滚轮切快捷格，`E` 打开分类面板；点面板里的方块即放进当前格并立即选中。**AC-6715 的「点击可达」已满足，且新增键盘 / 滚轮可达**。
- **V0.5 基线**：默认 9 格 = `BLOCKS[0..8]`，`Select Dirt` / `Select Brick` 按钮名与 `aria-pressed` 语义不变，20 条基线 spec 逐字节零改动；快捷格内容不落盘，localStorage 仍 3 个 key。
- **帮助面板**：新增 `WHEEL` / `E` 两行，`1 — 9` 文案改为「Choose a quick slot」。
- **HUD 归因**：本附录 A+B 涉及的全部有意变更统一由 `02_ARCHITECTURE/DDR-0002_MC_STYLE_BLOCK_BAR.md` §3 白名单登记；V061-025 改为分区判定（3D 世界区域 0 像素差 / HUD 区域按新 canonical 比对）。**DDR-0002 已于 2026-11-14 由 owner 在 STOP GATE-2 签核为 Approved**；DEV-608 已由 V061-025 新增 `scripts/v061-visual-regression.mjs` 修复并显式引用 V0.6 canonical，V061-025/026/027 全部 PASS（3D 世界 0 像素差、HUD 差异 99.84% 落在热栏带、ABBA 帧时间 +1.01%）；详见 `docs/v0.6.1/V061_PHASE4_VERIFICATION_REPORT.md`。
- **截图证据**：原 8 张按新 HUD 重拍，新增 `e12-mc-block-palette.png`（9 格快捷栏 + 分类面板打开态）与 `e13-mc-electric-groups.png`（面板滚动到底部的电力四组）；分类面板为可滚动容器，7 组标题与 34 个条目由脚本只读诊断确认（`groupLabels` 7 项、`paletteItems` 34）。`docs/v0.6.1/screenshots/gate2/` 现共 **10 张**，脚本 exit 0、`pageErrors []`。
