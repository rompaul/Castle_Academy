# V0.7.0 Release Notes — Interactive Learning Missions

**发布日期：** 2026-11-16 · **tag：** `v0.7.0` · **基线：** `tag v0.6.1` / `f0980b8`
**版本口径：** `package.json` / lock `0.7.0`；应用内 topbar / footer 文案 `V0.7.0`；master 可带后续 docs-only 提交。

## What's new

V0.7 把「六类任务形式」从数据标签做成真玩法，全部落在既有确定性判定链上：

1. **六类形式六条真流程**：观察清单（去重位置记录）、同一位置两态对照（合上/断开 × 灯亮/灯灭）、可改假设的诊断（改猜想不惩罚）、三步情境决策（可改一次、可回看、不写世界状态）、本地解释卡、创造任务。`life-simulation` 从 0 → 1。
2. **三个新的可选只读评估通道**：`observationLog` / `variableComparison` / `decisionSequence`，每通道上限 128、溢出策略冻结 `drop-oldest`、只在运行时内存、读档 / 重置 / 换档 / 卸载全清空。完成判定仍只由注册的纯函数评估器产出。
3. **任务 18 → 24、评估器 18 → 24**：6 个 schema-v2 新任务只追加到末尾，既有 18 个 ID / 文案 / 顺序零变更；知识点引用全部命中已注册 24 个 ID；先决链净增 1 条且无环。
4. **可选反思、零持久化**：「说一说（可以不写）」不进判定、不产生掌握证据、不解除档案切换抑制，只存在运行时内存。
5. **本地证据面板**：「给大人看」只读面板列计数与文本，无百分比 / 等级 / Tier / 分数 / 对错；句子化证据仍在既有 V0.6 证据面板。
6. **输入保护**：typing guard 覆盖全部新文本输入，输入时数字键 / `E` / `F` / `Tab` / 滚轮不误触发。
7. **顺手修掉一个真实缺陷**：新建档案后 `completionSuppressed` 只被水 / 测量事件解除，六类新任务的会话证据永远无法完成任务（GATE-2 截图评审时发现）；现在会话证据动作与真实世界变化都会解除，反思仍永远不会。

**范围裁定（Q-6 收口）**：工程模拟（水压 / 流速 / 泵曲线）不进本版；Experiment 复用既有二值规则做变量对照。

## Intentional design changes

- 应用内版本文案 `V0.6.1` → `V0.7.0`（topbar + footer）；按 V0.51 / V0.6.1 先例只重截本版 canonical，前后对比留档 `docs/v0.7/screenshots/canonical/visual-regression.json`。
- E2E 期望值适配：3 个 `v051-*` spec 共 8 行（18→24、5→6 形式、communication 1→2），按 GATE-1 批准的完整清单逐条留痕 `docs/v0.7/V07-021_EXPECTATION_ADAPTATION.md`；V0.5 基线 6 spec / 20 条逐字节零改动。
- 无新增 HUD / 3D 变化：全屏对 V0.6.1 main 差异仅 136 px（topbar 76 + footer 60 的版本字样），`worldCanvas` / `worldUpper` / questPanel 全 0。

## Release verification

| Check | Result |
|---|---|
| typecheck / build / `git diff --check` | exit 0 / exit 0 / 0 |
| Unit tests | 408/408（55 文件） |
| E2E | 47/47（`--workers=1`；V0.5 基线 20 条逐字节零改动） |
| 3D 视觉回归 | 对 V0.6 canonical anchor **0 像素差**；全屏对 V0.6.1 main 136 px（纯版本字样，已归因） |
| D-2 ABBA | 干净世界 329 dc / 44.62 ms（= 基线不回归）；侧栏打开 329 dc / 46.20 ms（+3.54%，归因 24 卡 DOM overlay） |
| AI / 外联 | 全库 0 真实 AI / LLM / SDK / 云调用；外部请求仅既有 O-1 Google Fonts |
| 儿童 / 数据安全 | 禁用词 0 命中（12 条表源 / 否定式豁免逐条登记）；3 个 localStorage key 零新增；反思零落盘运行时验证；3 级提示完整；`pageErrors []` |
| 角色 B 独立验收 | **FULLY SATISFIED**（STOP GATE-2 PASSED 2026-11-16；CHK-701~710 / 713 PASS，711 / 712 / 714 由 V07-024 / 025 / 028 闭环） |

门禁链：G0 PASS → STOP GATE-1（2026-11-15 18:47）→ `V07-004~022` → **STOP GATE-2（2026-11-16，角色 B FULLY SATISFIED）** → `V07-024~028` 全 PASS → **STOP GATE-3（本发布，owner 2026-11-16 签核 ACCEPT）**。

## Known limitations（延续 + 新增说明）

- **DEV-601**（既有）：`verify:source` exit 1，不属发布门禁。
- **O-1**（既有）：外链字体回归噪声；`worldCanvas` 区域 0 像素差不受影响。
- **D-2 性能判定**：只认同机同脚本 ABBA 配对；绝对阈值无效。
- **E2E 偶发超时**（既有）：软件渲染 / 冷编译所致，低并发重跑通过。
- **迁移窗口**：旧 `quest-panel` / `quest.*` 再次顺延到 V0.7 之后，清理需 owner 授权并重评 E2E 口径。
- **无新增已知限制**：V0.7 未引入新的未解决问题；`completionSuppressed` 修复属缺陷关闭，不列为限制。

## Upgrade notes

- 旧世界存档 / 学习者档案（v2）零迁移即可加载：`WorldSnapshot v1`、3 个 localStorage key、34 个方块 ID 全部未变。
- 刷新页面后，本次会话的反思与本地证据清空（设计如此，零持久化）。
- GitHub Release 页面仍需 owner 手动创建（fine-grained PAT 无 release 写权限，勿重试 `gh release create`）。
