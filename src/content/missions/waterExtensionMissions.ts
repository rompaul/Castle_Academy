import type { MissionDefinition } from "./types";

/**
 * V51-015 — 任务批次 1：水主题延伸 6 个（学习体验规格 §2.2）。
 *
 * Content Pack 是纯数据：不含世界查询、不含判定逻辑、不 import 插件运行时。
 * 每个 `evaluatorId` 对应 `src/plugins/mission/extendedEvaluators.ts` 的确定性评估器；
 * 判定条件与「种子世界 / V0.5 护城河完成动作都不自动完成」的约束见该文件注释。
 */
export const WATER_EXTENSION_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "mission.water-flow.v1",
    version: 1,
    title: "水往哪里流",
    context: "城堡后山刚下过雨，小小工程师想弄明白：水到底会往哪儿去？",
    goal: "在高处放一个水源，再去低处找一找水留下的痕迹",
    ageScope: "6-7",
    expressionForms: ["exploration", "experiment"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "把水源放在比城墙还高的格子上，数一数它往下走了几层。",
      "水源本身是方块，水会从它旁边的空格开始流；旁边没有地板时，水就一直往下落。",
      "用 Layers 看地下，或者放一块石头当地板，水就会停在那儿，更容易数。"
    ],
    successMessage: "你找到了！水总是先往低处走，遇到地板才向四周铺开。",
    evaluatorId: "evaluator.water-flow",
    reward: { kind: "title", title: "追水小侦探" },
    learningGoal: "通过放置与观察，发现水沿重力向下流、遇到支撑才水平扩散",
    prerequisiteMissionIds: [],
    reflectionPrompt: "水源放在高处和低处，水走过的路有什么不一样？",
    accessibilityNote: "进度用文字「已完成 N/2 步观察」呈现；高低与方向都有文字说明，不只靠颜色或画面。",
    progressLanguage: "已完成 {done}/{total} 步观察",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  },
  {
    id: "mission.seven-steps.v1",
    version: 1,
    title: "七步之约",
    context: "石匠师傅说，水在平地上最多只能走七格。真的吗？数一数就知道了。",
    goal: "在院子里铺出地板，数出七格连在一起的水",
    ageScope: "6-7",
    expressionForms: ["experiment", "problem-solving"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "先在空地上铺一排石头当底板，再把水源放在底板上方。",
      "一格一格数水铺到了哪里；数到第七格时，看看第八格是不是干的。",
      "想让水走得更远，可以再放一个水源，或试试蓝色管道。"
    ],
    successMessage: "七格，一格不多！你亲手量出了水在平地上走路的规矩。",
    evaluatorId: "evaluator.seven-steps",
    reward: { kind: "title", title: "数格子的石匠" },
    learningGoal: "用计数验证水平扩散上限，建立「范围有限」的因果直觉",
    prerequisiteMissionIds: [],
    reflectionPrompt: "水为什么停在第七格？如果再加一个水源会怎样？",
    accessibilityNote: "进度为「院子有水 {done}/{total} 格」的文字计数，配合进度条；不依赖颜色单一通道。",
    progressLanguage: "院子有水 {done}/{total} 格",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  },
  {
    id: "mission.channel-dam.v1",
    version: 1,
    title: "渠与坝的选择",
    context: "庭院总是积水，管家拿来两样东西：排水渠和砖墙。哪一种能挡住水，哪一种能把水带走？",
    goal: "各造一段排水渠和一道砖坝，比较水流的结果",
    ageScope: "8-10",
    expressionForms: ["experiment", "creation"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "在材料栏里找灰色的排水渠和红砖；先各放一段，再放水源看看。",
      "排水渠会吃掉流进来的水，砖块只会把水挡在旁边——两种结果不一样。",
      "把渠放在水的必经之路上，把砖坝横在水前面，对比一下水位停在哪。"
    ],
    successMessage: "渠把水带走，坝把水挡住，你用同一个水源做出了两种结果！",
    evaluatorId: "evaluator.channel-dam",
    reward: { kind: "title", title: "渠坝试验师" },
    learningGoal: "通过对照实验区分「吸收」与「阻挡」两种改变水流的方式",
    prerequisiteMissionIds: [],
    reflectionPrompt: "什么时候该用渠，什么时候该用坝？说说你看到的差别。",
    accessibilityNote: "两步条件都用文字「造好 {done}/{total} 种结构」表达；渠与坝的名称在提示里明文给出。",
    progressLanguage: "造好 {done}/{total} 种结构",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  },
  {
    id: "mission.garden-water.v1",
    version: 1,
    title: "给花园浇水",
    context: "城堡的小花园晒得发蔫，园丁请你把水引到围墙里面的空地上。",
    goal: "在院子里放一个水源，让至少三格地面有水",
    ageScope: "6-7",
    expressionForms: ["creation", "exploration"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "围墙里的空地没有地板，先铺一层石头，水才不会一路掉到地下。",
      "把水源放在铺好的地板上方一格，水会沿着地板向四周走。",
      "数一数院子里有几格湿了；不够三格就把地板铺宽一点。"
    ],
    successMessage: "花园喝到水了！你先规划了地板，再把水请了进来。",
    evaluatorId: "evaluator.garden-water",
    reward: { kind: "title", title: "花园园丁" },
    learningGoal: "先规划支撑面再引水，理解「地形决定水停在哪里」",
    prerequisiteMissionIds: [],
    reflectionPrompt: "如果先放水再铺地板，会发生什么？",
    accessibilityNote: "目标与进度均为文字（「院子有水 {done}/{total} 格」）；区域用「围墙里面」文字描述。",
    progressLanguage: "院子有水 {done}/{total} 格",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  },
  {
    id: "mission.broken-pipe.v1",
    version: 1,
    title: "断水的管道",
    context: "东塔的蓝色管道突然不出水了，水务长怀疑中间有一段没接上。",
    goal: "接出至少三段蓝色管道，并让其中一段真正通水",
    ageScope: "11-12",
    expressionForms: ["problem-solving", "exploration"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "蓝色管道要和水源正交相连，中间不能断开；先沿一条直线铺三段。",
      "管道亮起来（通水）说明链路接上了；没亮的那一段就是断点。",
      "把管道贴着水源的上下左右摆，别斜着放；出水口在管道旁边的空格。"
    ],
    successMessage: "管道重新通水了！你用连通性找出了断在哪一段。",
    evaluatorId: "evaluator.broken-pipe",
    reward: { kind: "title", title: "管道诊断师" },
    learningGoal: "用连通性诊断断点，理解管道链与水源正交相邻才通水",
    prerequisiteMissionIds: [],
    reflectionPrompt: "为什么斜着放的管道接不上？你怎样确认哪一段断了？",
    accessibilityNote: "通水状态同时以文字「接通 {done}/{total} 段」与图标呈现；提示明文写出正交相邻规则。",
    progressLanguage: "接通 {done}/{total} 段",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  },
  {
    id: "mission.reservoir.v1",
    version: 1,
    title: "蓄水池容量",
    context: "冬天要储水，工匠长让你先造一个小池子，并算出它能装多少格水。",
    goal: "在院子上方搭出平台，蓄出十二格水",
    ageScope: "11-12",
    expressionForms: ["experiment", "problem-solving"],
    requiredCapabilities: ["building.basic", "water.simulation"],
    hintLadder: [
      "先在院子里铺一层平台，四周用砖围一圈，水才不会从边上流走。",
      "在平台上方放水源，一格一格数平台上有水的格子。",
      "数到十二格就够啦；想更大就再扩一圈围边，容量会跟着变。"
    ],
    successMessage: "十二格，一格不差！池子能装多少，是你数出来的。",
    evaluatorId: "evaluator.reservoir",
    reward: { kind: "title", title: "蓄水计量师" },
    learningGoal: "用格数估算容积，把「容量」变成可数的单位",
    prerequisiteMissionIds: [],
    reflectionPrompt: "如果把池子扩成两倍大，容量会变成多少？你怎么算的？",
    accessibilityNote: "容量用「蓄到 {done}/{total} 格」文字计数；平台与围边在提示里用文字描述。",
    progressLanguage: "蓄到 {done}/{total} 格",
    unavailableReason: "需要「放置方块」和「水模拟」能力，能力开放后就能玩。"
  }
];
