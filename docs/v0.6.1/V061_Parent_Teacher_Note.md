# V0.6.1 家长 / 教师说明（Electricity content）

> 本文件是 ADR-0013 决策 10 与 `LEARNING_ACTIVITIES_SPEC.md` §3 要求的**家长 / 教师说明**落地件；
> 文案经 owner（家长视角）于 2026-11-13 STOP GATE-1 审校通过（Q-7 照批），逐字不得改写。
> V0.6.1 尚未发布；本文随实现推进，供发布说明（V061-029）直接引用。

## 说明原文

> **本产品为虚构二值规则模型，不含真实电气知识，也不含任何可迁移到现实的操作步骤。建议成人陪同低龄儿童使用。**

## 儿童界面里的两条对应文案

| 位置 | 文案 | 行为 |
|---|---|---|
| 首次引导（儿童可见，会话内一次） | 「城堡里的电是游戏里的规则；现实里的电很危险，不要碰插座和电线。」 | 首次进入电力任务时显示一次，可关闭，非模态、不恐吓；不新增 localStorage key |
| 帮助面板 / 电力任务详情（常驻） | 「城堡里的电只玩通和断，不学真实接线。现实里的电很危险，不要碰插座和电线。」 | 常驻条目，不随任务进度消失 |

## 界面设计如何承担安全责任

- **统一用「电」命名**（PD-013）：电源 / 电线 / 开关 / 灯 / 信标 / 水泵 / 阀门；不靠虚构名词降低风险，也不按年龄改名。
- **年龄差异只放在任务形式与提示阶梯**（PD-014）：6–7 观察「开关 → 灯亮/灭」，8–10 补齐缺口与两态对照，11+ 才做「电 → 泵 → 阀 → 水」多步联动；活动 C 的低龄路径拆成单系统 C1 / C2，不并列 5 种失败原因。
- **0 处真实布线步骤、0 处电压 / 电流 / 电阻数值、0 处真实插座 / 家用布线图形**；儿童界面不显示等级、难度、百分比、年级或掌握状态。
- **禁用词表**（`src/content/electrical/glossary.ts`）：红石 / Redstone / 信号强度 / 充能 / 中继 / 逻辑门 / 电压 / 电流 / 电阻 / 短路 / 串联 / 并联 / 衰减 / 家用布线 / 能量石 / 导能管 / 信号石等，在任务文案、状态消息、术语表中零命中；三条安全文案因必须逐字警示「插座和电线」而单独豁免。
- 通电 / 断电是**游戏内的二值派生规则**，不写回世界存档；`WorldSnapshot v1` 零变更。

## 实现与验收对应

| 要求 | 落地位置 | 验收 |
|---|---|---|
| 三条文案齐备 | `src/content/electrical/glossary.ts` `ELECTRICAL_SAFETY_TEXTS`；`src/ui/mission/ElectricalSafetyGuide.tsx`；`src/ui/HelpPanel.tsx`；`src/ui/mission/MissionDetailPanel.tsx` | AC-6746；`glossary.test.ts` 逐字断言 |
| 禁用词 0 命中 | `glossary.test.ts` 扫描全部儿童可见文案 | AC-6745 / 6747 |
| 3 级提示与年龄分档 | `src/content/missions/electricalMissions.ts`（含 `ELECTRICAL_LOW_AGE_PATHS`） | AC-6741 / 6742 / 6743 |
| 术语表与能力注册 | `glossary.ts` / `CapabilityRegistry.ts` `electric.basic` | AC-6748 |
| 掌握证据不含等级 | `MissionRuntimePlugin` 沿用 V0.6 的确定性证据路径 | AC-6713 |
