/**
 * V07-008 — 六个形式专属任务内容（Content Pack，纯数据、零副作用）。
 *
 * 全部 `schemaVersion: 2`、知识点引用来自 `v07MissionContracts.ts` 冻结表，
 * `evaluatorId` 与 `interactiveEvaluators.ts` 的 6 个纯函数评估器 1:1。
 * 只使用既有 20 字段，不改 `types.ts` / `validateMissionDefinition()` / 既有 18 个任务：
 * 主形式由 `expressionForms[0]` 表达，受控选项由评估器模块共享常量提供，无需新字段。
 *
 * `V07-021` 已把这 6 个任务**只追加**到 `ALL_MISSIONS` 末尾（18 → 24），既有 18 个
 * ID 与顺序零变更；数字 / 集合断言按 owner 批准的完整清单逐条留痕，见
 * `docs/v0.7/V07-021_EXPECTATION_ADAPTATION.md`。
 */
import type { MissionDefinition } from "./types";
import { V07_MISSION_CONTRACTS } from "./v07MissionContracts";

export const V07_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "mission.find-the-pattern.v1",
    version: 1,
    title: "水在哪里出现",
    context: "带上小本子，在城堡里找一找：水会出现在哪些地方？",
    goal: "记下三处不同的地方，看看水都在哪里出现",
    ageScope: "6-7",
    expressionForms: ["exploration", "problem-solving"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "有些地方有水，有些地方没有，先别急着下结论。",
      "看看水源旁边、水沟尽头和护城河边上。",
      "走到亮起来的观察点，按「记下我看到」把三处都记下来。"
    ],
    successMessage: "三处都记下了！把看到的地方放在一起，规律就冒出来了。",
    evaluatorId: "evaluator.find-the-pattern",
    reward: { kind: "title", title: "细心观察员" },
    learningGoal: "逐点观察并归纳水出现的位置，练习从现象里找规律",
    schemaVersion: 2,
    knowledgePointIds: ["kp.water.flow.range", "kp.reasoning.cause_effect"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "这三处有什么一样的地方？想说一句也可以，不写也没关系。",
    accessibilityNote: "观察清单用文字标签与选中状态同时呈现，不只靠颜色；每条都能用键盘选中，图标配文字说明。",
    progressLanguage: "记下 {done}/{total} 处",
    unavailableReason: "需要「放置方块」和「水模拟」能力，这两个能力开放后就能玩。"
  },
  {
    id: "mission.switch-compare.v1",
    version: 1,
    title: "同一个开关，按两下",
    context: "城堡走廊有一盏灯。同一个开关，按一下和再按一下，灯会有什么不一样？",
    goal: "盯着同一个开关，分别看一次合上和断开时灯的样子",
    ageScope: "8-10",
    expressionForms: ["experiment", "exploration"],
    requiredCapabilities: ["building.basic", "electric.basic"],
    hintLadder: [
      "灯有时候亮，有时候不亮，变化就发生在按开关之后。",
      "盯住同一个开关，别换到别的位置去。",
      "用 F 键在同一个位置按两下，把两次看到的样子比一比。"
    ],
    successMessage: "两种样子都看到了！同一个地方只改一件事，结果就跟着变。",
    evaluatorId: "evaluator.switch-compare",
    reward: { kind: "title", title: "对照小实验家" },
    learningGoal: "在同一位置只改一个条件，比较两种结果，理解对照的想法",
    schemaVersion: 2,
    knowledgePointIds: ["kp.electric.switch.effect", "kp.experiment.control"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "按两下以后，你发现什么变了？说说你先看到哪一边。",
    accessibilityNote: "两态对照卡同时用文字「合上／断开」与图形区分，不只靠颜色；用键盘也能逐项切换查看。",
    progressLanguage: "看过 {done}/{total} 项变化",
    unavailableReason: "需要「放置方块」和「电」能力，这两个能力开放后就能玩。"
  },
  {
    id: "mission.why-no-water-here.v1",
    version: 1,
    title: "花园为什么没水",
    context: "城堡的小花园一直没水。先猜一个原因，再顺着水路去找证据。",
    goal: "选一个猜想，查一遍水路，确认它是不是真正的原因",
    ageScope: "8-10",
    expressionForms: ["problem-solving", "exploration"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "水没走到花园，说明中间有一处和想的不一样。",
      "从水源开始顺着管道往回看，留意哪里断开了。",
      "选一个猜想去查；不对就换一个再查，怎么改都没关系。"
    ],
    successMessage: "猜想和查到的对上了！先猜再查，是个好办法。",
    evaluatorId: "evaluator.why-no-water-here",
    reward: { kind: "title", title: "水路小侦探" },
    learningGoal: "先提出假设再用只读观察验证，允许改假设，练习按证据修正想法",
    schemaVersion: 2,
    knowledgePointIds: ["kp.reasoning.diagnosis", "kp.system.continuous_path"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "你换过猜想吗？是哪一处让你改了主意？",
    accessibilityNote: "三个猜想是带文字的大按钮，键盘可选；验证结果用文字与符号同时表示，不只看颜色。",
    progressLanguage: "查明 {done}/{total} 步",
    unavailableReason: "需要「放置方块」和「水模拟」能力，这两个能力开放后就能玩。"
  },
  {
    id: "mission.choose-water-route.v1",
    version: 1,
    title: "给城堡选一条水路",
    context: "城堡要送水，条件一直在变：下雨了、材料要省着用、花园也想分到水。",
    goal: "按顺序做三个选择，再回头看看每次带来了什么",
    ageScope: "11-12",
    expressionForms: ["life-simulation", "problem-solving"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "不同走法各有好处，没有哪条路样样都占先。",
      "留意每一步里条件怎么变，别只看第一步。",
      "按顺序做完三个选择，再点开回看，想改可以改一次。"
    ],
    successMessage: "三个选择都做完了！回看一遍，你会发现每次取舍都有理由。",
    evaluatorId: "evaluator.choose-water-route",
    reward: { kind: "title", title: "城堡规划员" },
    learningGoal: "在会变化的情境里做一串选择并回看后果，理解决策要跟着条件走",
    schemaVersion: 2,
    knowledgePointIds: ["kp.water.barrier.redirect", "kp.water.channel.absorb"],
    prerequisiteMissionIds: ["mission.find-the-pattern.v1"],
    reflectionPrompt: "如果条件再变一次，你会改哪个选择？为什么？",
    accessibilityNote: "每一步的选项与结果都是文字卡片，可用键盘逐个浏览；回看区用序号标明顺序，不只靠颜色。",
    progressLanguage: "做完 {done}/{total} 个选择",
    unavailableReason: "需要「放置方块」和「水模拟」能力，这两个能力开放后就能玩。"
  },
  {
    id: "mission.explain-my-choice.v1",
    version: 1,
    title: "把我的理由说清楚",
    context: "刚才为城堡做了几个选择，把「为什么这样选」讲给未来的自己听。",
    goal: "留下一段自己的解释，随时可以改，也可以跳过",
    ageScope: "13-15",
    expressionForms: ["communication", "exploration"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "先说说你最先注意到的是什么。",
      "再说说你放弃了哪条路、当时在想什么。",
      "最后写一句「所以我就……」；想跳过也完全可以。"
    ],
    successMessage: "你的理由记下了。写下来的想法，以后还能回来看。",
    evaluatorId: "evaluator.explain-my-choice",
    reward: { kind: "title", title: "会讲理由的人" },
    learningGoal: "用文字把做法与理由连起来，练习向他人解释自己的选择",
    schemaVersion: 2,
    knowledgePointIds: ["kp.communication.explain_reason", "kp.reasoning.cause_effect"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "这段解释里，哪一句最想留给以后的自己？",
    accessibilityNote: "输入框有文字标签与明确按钮，写完只给中性确认；文字只在这次游戏里保留，读档或刷新就没了。",
    progressLanguage: "记下 {done}/{total} 段想法",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  },
  {
    id: "mission.story-map.v1",
    version: 1,
    title: "城堡里的一天",
    context: "用方块做一张小地图，标出早上、中午、晚上待的地方。",
    goal: "在地图里放进三种不同的标记方块，再回看自己的作品",
    ageScope: "6-7",
    expressionForms: ["creation", "exploration"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "一张地图里要有三个不一样的地方。",
      "想想早上、中午、晚上你分别会在哪儿。",
      "给每个地方各放一个标记方块，再退远一点看看整张地图。"
    ],
    successMessage: "三个地方都标好了！这张地图讲的是你自己的城堡故事。",
    evaluatorId: "evaluator.story-map",
    reward: { kind: "title", title: "故事地图师" },
    learningGoal: "用建造把一天的顺序表达出来，练习先想好再动手安排",
    schemaVersion: 2,
    knowledgePointIds: ["kp.engineering.planning", "kp.system.dependency"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "你的地图里，哪个地方最热闹？想说一句也可以。",
    accessibilityNote: "三种标记在分类面板里有文字名称；进度用文字与图形同时显示，不只靠颜色。",
    progressLanguage: "放好 {done}/{total} 种标记",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  }
];

/** 与冻结表顺序一致，供测试与 UI 侧消费，避免两处各写一份。 */
export const V07_MISSION_COUNT = V07_MISSIONS.length;
export const V07_FROZEN_CONTRACT_COUNT = V07_MISSION_CONTRACTS.length;
