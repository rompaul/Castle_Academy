import type { MissionDefinition } from "./types";

/**
 * V51-006 — 首批 Content Pack：V0.5 三任务无损迁移（ADR-0007）。
 *
 * 文案迁移规则（护栏，勿随意改写）：
 * - `title` / `context` / `successMessage` 与 V0.5 `QUEST_DEFINITIONS` 逐字一致；
 * - `hintLadder[0]` 与 V0.5 `hint` 逐字一致，后续为新增的渐进提示；
 * - 判定区域/阈值不在此重复定义，仍由 `evaluators.ts` 使用 `castleStage.ts` 的区域常量，
 *   避免"数据一份、判定一份"的双写漂移（PD-009）。
 * - 纯数据模块：无 import 运行时插件、无副作用、可安全被 V0.6 知识图谱消费。
 */
export const CASTLE_WATER_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "mission.moat.v1",
    version: 1,
    title: "注满护城河",
    context: "敌军压境，护城河干涸！把水引进环绕城堡的水道，充水至少九成。",
    goal: "让环绕城堡的水道九成以上都有水",
    ageScope: "8-10",
    expressionForms: ["problem-solving", "creation"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "在渠边放水源（扩散最多 7 格）——离得远的区段需要多个水源或用管道接力。",
      "先在水道的一个角落放水源，观察水最远流到哪里；数一数还差几段没水。",
      "四个方向各放一个水源，或用蓝色管道把水接到够不到的区段。"
    ],
    successMessage: "护城河碧波荡漾，敌军只能望水兴叹！",
    evaluatorId: "evaluator.moat",
    reward: { kind: "title", title: "护城河功臣" },
    learningGoal: "理解水沿地形扩散有范围上限，用多点布源/管道解决连通性问题",
    schemaVersion: 2,
    knowledgePointIds: ["kp.water.flow.range", "kp.system.continuous_path"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "你一共放了几个水源？为什么一个水源不够？",
    accessibilityNote: "进度用文字「已充水 N/40 段」与进度条同时呈现，不只靠颜色；提示用文字独立成段。",
    progressLanguage: "已充水 {done}/{total} 段",
    unavailableReason: "需要「放置方块」和「水模拟」能力，这两个能力开放后就能玩。"
  },
  {
    id: "mission.well.v1",
    version: 1,
    title: "城堡水井",
    context: "庭院水井见底，厨房马厩都在喊渴。想办法把水送进东侧石塔的井筒。",
    goal: "先量一次高差，再把井筒两格都灌满水",
    ageScope: "8-10",
    expressionForms: ["problem-solving", "creation", "experiment"],
    requiredCapabilities: ["building.basic", "water.simulation", "measurement.distance"],
    hintLadder: [
      "先用顶栏 Measure 量一次高差（解锁判定）；再在塔顶开口正上方放水源灌满井筒，或用管道从远处引水。",
      "顶栏的 Measure / Check challenge 按钮就是测量工具，先点一次再动手建。",
      "井筒在东侧石塔正中，从 y=1 到 y=-2 贯通；把水源放在开口正上方。"
    ],
    successMessage: "水井汩汩冒水，今晚大厅能炖汤了！",
    evaluatorId: "evaluator.well",
    reward: { kind: "title", title: "水井工匠" },
    learningGoal: "走完「测量 → 规划 → 建造 → 验证」的工程循环，理解水往低处流",
    schemaVersion: 2,
    knowledgePointIds: ["kp.water.gravity.downhill", "kp.engineering.design_loop"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "测量的结果改变了你的建造位置吗？说说为什么。",
    accessibilityNote: "测量门槛同时用文字与图标说明；完成状态有文字，不只靠颜色。",
    progressLanguage: "井筒已充水 {done}/{total} 格",
    unavailableReason: "需要「测量距离」能力，能力开放后就能玩。"
  },
  {
    id: "mission.dungeon.v1",
    version: 1,
    title: "地牢告急",
    context: "暴雨渗水，地牢积水，被俘的骑士团快要泡汤了！把西北角的牢房区排干。",
    goal: "用排水渠挡住渗水，让西北角牢房区保持干燥",
    ageScope: "11-12",
    expressionForms: ["exploration", "problem-solving"],
    requiredCapabilities: ["building.basic", "water.simulation", "layers.section"],
    hintLadder: [
      "用剖面视图找到地下渗水点，再在渗水点与牢房区之间横一排排水渠——渠会吸收流经的水。",
      "顶栏 Layers 打开剖面视图，能看到 y=-3 的地下水池和两处渗水源。",
      "在水池中间（z=0）横着放一排排水渠，隔开渗水源和西北角牢房区。"
    ],
    successMessage: "牢房干燥温暖，骑士团向您致敬，城堡水务大师！",
    evaluatorId: "evaluator.dungeon",
    reward: { kind: "title", title: "地牢救援者" },
    learningGoal: "通过剖面观察定位问题源，用屏障改变水流路径（因果推理）",
    schemaVersion: 2,
    knowledgePointIds: ["kp.water.barrier.redirect", "kp.reasoning.cause_effect"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "排水渠放在哪里最省力？如果放在牢房区旁边会怎样？",
    accessibilityNote: "剖面观察提供文字说明；「已排干 N/4 格」为文字进度，不依赖颜色。",
    progressLanguage: "牢房区已排干 {done}/{total} 格",
    unavailableReason: "需要「剖面视图」能力，能力开放后就能玩。"
  }
];

/** V0.5 旧 quest ID ↔ V0.51 mission ID（迁移期旧事件适配使用，一个版本后移除）。 */
export const MISSION_ID_BY_LEGACY_QUEST: Readonly<Record<string, string>> = {
  "quest-moat": "mission.moat.v1",
  "quest-well": "mission.well.v1",
  "quest-dungeon": "mission.dungeon.v1"
};

export const LEGACY_QUEST_ID_BY_MISSION: Readonly<Record<string, string>> = {
  "mission.moat.v1": "quest-moat",
  "mission.well.v1": "quest-well",
  "mission.dungeon.v1": "quest-dungeon"
};
