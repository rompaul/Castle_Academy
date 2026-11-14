import type { MissionDefinition } from "./types";

/**
 * V061-018/019/020 — 电力任务 Content Pack（ADR-0012 Q-3 批准范围，schema v2）。
 *
 * 纯数据模块：零副作用、不 import 插件运行时 / 渲染 / WorldState。
 * 3 个普通 `MissionDefinition`（全部 `schemaVersion: 2`），不引入第三套格式、
 * 不新建任务类型、不新建活动引擎；判定由 `src/plugins/mission/electricalEvaluators.ts`
 * 的确定性评估器查询 `ElectricalQuery` / `WaterQuery` 产出。
 *
 * 文案约束（ADR-0013 / LEARNING_ACTIVITIES_SPEC §2/§3）：
 * - 儿童可见文案统一「电源 / 电线 / 开关 / 灯 / 信标 / 水泵 / 阀门」；
 * - 0 处真实布线步骤、0 处电气数值、0 处等级 / 难度 / 年级 / 百分比标签；
 * - 3 级提示固定「① 现象 → ② 位置 → ③ 操作」，逐字取自规格 §6/§7/§8。
 *
 * 顺序约定：只追加到 `ALL_MISSIONS` 末尾，不插入既有 15 个任务之间（DEV-613 裁定 A）。
 */
export const ELECTRICAL_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "mission.electric-light-beacon.v1",
    version: 1,
    title: "点亮信标",
    context: "城堡顶上的信标还没亮。电源已经在了，电线中间少了一格。",
    goal: "让信标通上电，亮起来",
    ageScope: "6-7",
    expressionForms: ["exploration"],
    requiredCapabilities: ["building.basic", "electric.basic"],
    hintLadder: [
      "信标还没亮，电还没走到它那里。",
      "沿着电线从电源慢慢看过去，中间有一处没接上。",
      "选中电线，把缺口那格补上，再看看信标。"
    ],
    successMessage: "通电了，信标亮了！",
    evaluatorId: "evaluator.electric-light-beacon",
    reward: { kind: "title", title: "点亮信标的人" },
    learningGoal: "看见「一路连起来才会通」，用补上缺口的办法让电走到信标",
    schemaVersion: 2,
    knowledgePointIds: ["kp.system.continuous_path", "kp.electric.circuit.closed"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "补上那一格以后，电线发生了什么变化？指给旁边的人看看。",
    accessibilityNote: "通电路径逐段变亮，同时用文字「通电了 / 还没接通」说明；不只靠颜色。",
    progressLanguage: "已接通 {done}/{total} 处",
    unavailableReason: "需要「放置方块」和「电的基础玩法」能力，开放后就能玩。"
  },
  {
    id: "mission.electric-switch-magic.v1",
    version: 1,
    title: "开关的魔法",
    context: "走廊的灯忽明忽暗，工匠说秘密就在路中间那个开关上。",
    goal: "把开关合上、再断开，各看一次灯的样子",
    ageScope: "8-10",
    expressionForms: ["creation", "problem-solving"],
    requiredCapabilities: ["building.basic", "electric.basic"],
    hintLadder: [
      "灯现在是灭的。",
      "看看路径上的开关，它现在是断开的样子。",
      "点一下开关让它合上，再看看灯。"
    ],
    successMessage: "合上亮、断开灭，你把这个变化看清楚了！",
    evaluatorId: "evaluator.electric-switch-magic",
    reward: { kind: "title", title: "开关观察家" },
    learningGoal: "用「合上 / 断开」两态对照，看见一个动作带来一个变化",
    schemaVersion: 2,
    knowledgePointIds: ["kp.causality.switch_effect", "kp.electric.switch.effect"],
    prerequisiteMissionIds: ["mission.electric-light-beacon.v1"],
    reflectionPrompt: "合上和断开的时候，电线亮起来的地方一样多吗？",
    accessibilityNote: "开关两态用不同形状与文字「开关断开 / 通电了」同时表达；进度为文字计数。",
    progressLanguage: "两态都看过 {done}/{total} 次",
    unavailableReason: "需要「放置方块」和「电的基础玩法」能力，开放后就能玩。"
  },
  {
    id: "mission.electric-power-pump.v1",
    version: 1,
    title: "给水泵通电",
    context: "花园的水渠干了。水泵、电线、阀门都在，先让电走到水泵那里吧。",
    goal: "让水泵通上电，把阀门开好，看见出水点有水",
    ageScope: "11-12",
    expressionForms: ["experiment"],
    requiredCapabilities: ["building.basic", "electric.basic", "water.simulation"],
    hintLadder: [
      "出水点还没有水。",
      "先看看泵有没有通电，再看阀门是不是开着。",
      "把断开的开关合上，或者把阀门切换成开，然后重新看水。"
    ],
    successMessage: "通电了，水来了！",
    evaluatorId: "evaluator.electric-power-pump",
    reward: { kind: "title", title: "水电联动师" },
    learningGoal: "把「电 → 泵 → 阀 → 水」几步连起来想，一次只改一处看结果",
    schemaVersion: 2,
    knowledgePointIds: ["kp.system.dependency", "kp.electric.load.pump", "kp.water.flow.range"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "如果只合上开关、阀门还关着，水会来吗？为什么先改一处更好判断？",
    accessibilityNote: "状态消息一次只指向一个最可能原因，用图标与文字并置；进度为文字计数。",
    progressLanguage: "已做到 {done}/{total} 步",
    unavailableReason: "需要「放置方块」「电的基础玩法」和「水模拟」能力，开放后就能玩。"
  }
];

/**
 * V061-019（AC-6743）：活动 C 的低龄替代 —— **单系统子路径**，不是额外任务。
 *
 * Q-3 只批准 3 个电力任务 + 1 条链（15→18，DEV-613 裁定 A），因此 C1/C2
 * 以「同一任务内的引导路径」实现，不新增第 4/5 个任务 ID、不并列 5 种失败原因。
 * 每条路径仍是 3 级提示（现象 → 位置 → 操作），且只涉及一个系统。
 */
export const ELECTRICAL_LOW_AGE_PATHS = Object.freeze({
  C1: Object.freeze({
    title: "让水泵转起来",
    system: "electric",
    hintLadder: Object.freeze([
      "水泵还没动。",
      "看看电线有没有一路连到水泵。",
      "把缺的电线补上，或者把断开的开关合上，再看看水泵。"
    ])
  }),
  C2: Object.freeze({
    title: "让水流过去",
    system: "water",
    hintLadder: Object.freeze([
      "出水点还没有水。",
      "看看水路上的阀门，它现在是关着的样子。",
      "把阀门切换成开，再看看出水点。"
    ])
  })
} as const);
