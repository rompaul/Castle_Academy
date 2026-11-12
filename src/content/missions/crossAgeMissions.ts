import type { MissionDefinition } from "./types";

/**
 * V51-016 — 任务批次 2：跨年龄带 6 个（学习体验规格 §2.3）。
 *
 * 纯数据 Content Pack；判定见 `src/plugins/mission/extendedEvaluators.ts`。
 * 「我的设计说明」是唯一的交流类任务：证据为学习者自己写下的文字，
 * 评估器只校验非空与最短长度，不评判表达质量（AC-232）。
 */
export const CROSS_AGE_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "mission.count-bridge.v1",
    version: 1,
    title: "计数建桥",
    context: "护城河上架桥的工程开始了，工匠长请你先数清楚要几块砖。",
    goal: "用六块砖搭出一段桥面，一边搭一边数",
    ageScope: "6-7",
    expressionForms: ["creation", "problem-solving"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "选红砖，在同一层一块挨一块地放；每放一块就数一声。",
      "六块就是六个格子，别把重复的那一格算两遍。",
      "搭完可以从头再数一次，检查一下有没有漏掉。"
    ],
    successMessage: "六块砖，一段桥！你是靠自己数出来的。",
    evaluatorId: "evaluator.count-bridge",
    reward: { kind: "title", title: "数砖小工匠" },
    learningGoal: "一一对应地计数，把「需要多少材料」变成可核对的数字",
    schemaVersion: 2,
    knowledgePointIds: ["kp.measurement.counting"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "你是怎么确认正好六块的？换一种数法会一样吗？",
    accessibilityNote: "进度为文字「桥面已有 {done}/{total} 块砖」；计数不依赖颜色或图形提示。",
    progressLanguage: "桥面已有 {done}/{total} 块砖",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  },
  {
    id: "mission.symmetric-gate.v1",
    version: 1,
    title: "对称的城堡门",
    context: "城门要左右一模一样才稳，石匠说这叫对称。你来试试摆出门的两边。",
    goal: "造出至少三对左右对称的砖块，当城门的两侧",
    ageScope: "8-10",
    expressionForms: ["creation", "exploration"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "以中间那条线为准：左边放一块，右边同一高度、同样远近也放一块。",
      "左右两块要高度相同、离中线一样远，才算一对。",
      "先摆三对试试：可以一层一层往上，也可以排成一排。"
    ],
    successMessage: "三对，左右齐整！城门看起来又稳又好看。",
    evaluatorId: "evaluator.symmetric-gate",
    reward: { kind: "title", title: "对称门匠" },
    learningGoal: "用镜像位置理解轴对称，把「形状规则」变成可摆出来的结构",
    schemaVersion: 2,
    knowledgePointIds: ["kp.geometry.axis_symmetry"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "如果把一边的砖往上挪一格，还对称吗？为什么？",
    accessibilityNote: "对称规则在提示里用文字说明；进度「配好 {done}/{total} 对」为文字计数，不只靠左右视觉。",
    progressLanguage: "配好 {done}/{total} 对",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  },
  {
    id: "mission.measure-tower.v1",
    version: 1,
    title: "测量塔高",
    context: "瞭望塔要盖五层，水务长让你先量一次，再按层数往上搭。",
    goal: "先使用测量工具，再把同一列的砖塔搭到五层",
    ageScope: "8-10",
    expressionForms: ["problem-solving", "creation"],
    requiredCapabilities: ["building.basic", "measurement.distance"],
    hintLadder: [
      "先用顶栏 Measure 量一次高差，量过之后塔的层数才会被记下来。",
      "选好一个格子，从第一层到第五层，一层一块往上叠。",
      "别把砖分散在不同列；同一列叠满五块才算一座塔。"
    ],
    successMessage: "五层塔立起来了！先量后搭，你的层数一点没错。",
    evaluatorId: "evaluator.measure-tower",
    reward: { kind: "title", title: "量塔师傅" },
    learningGoal: "走完「测量 → 规划 → 按数建造 → 验证」的循环，理解垂直层数",
    schemaVersion: 2,
    knowledgePointIds: ["kp.measurement.height", "kp.engineering.design_loop"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "测量的结果帮了你什么？不量直接搭会有什么麻烦？",
    accessibilityNote: "测量门槛与层数都用文字提示；进度「塔搭到 {done}/{total} 层」为文字计数。",
    progressLanguage: "塔搭到 {done}/{total} 层",
    unavailableReason: "需要「放置方块」和「测量距离」能力，能力开放后就能玩。"
  },
  {
    id: "mission.section-detective.v1",
    version: 1,
    title: "剖面侦探",
    context: "地下总是有水声，可地面上什么也看不见。打开剖面，去下面做几个标记吧。",
    goal: "打开剖面视图，在地下放三块标记砖",
    ageScope: "11-12",
    expressionForms: ["exploration", "problem-solving"],
    requiredCapabilities: ["building.basic", "layers.section"],
    hintLadder: [
      "顶栏 Layers 里有剖面视图，打开后能看到地下的空间。",
      "剖面只改变你看的方式，方块还是照常放在世界里。",
      "把三块红砖放在地下层，当作你找到位置的标记。"
    ],
    successMessage: "三处标记都放好了！地面看不见的地方，也能被找到。",
    evaluatorId: "evaluator.section-detective",
    reward: { kind: "title", title: "剖面侦探" },
    learningGoal: "用剖面视图建立地下空间方位感，区分「看不见」与「不存在」",
    schemaVersion: 2,
    knowledgePointIds: ["kp.spatial.section_view", "kp.spatial.underground"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "剖面帮你看清了什么？关掉剖面后，标记还在吗？",
    accessibilityNote: "剖面开关与地下位置均有文字说明；进度「地下标记 {done}/{total} 块」为文字计数。",
    progressLanguage: "地下标记 {done}/{total} 块",
    unavailableReason: "需要「放置方块」和「剖面视图」能力，能力开放后就能玩。"
  },
  {
    id: "mission.material-budget.v1",
    version: 1,
    title: "材料预算",
    context: "管家只批了十份砖：八份砌墙身，两份留给高处的窗台。别超支哦。",
    goal: "用八块砖做主体，再拿两块放到高处，凑齐十份材料",
    ageScope: "11-12",
    expressionForms: ["problem-solving", "creation"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "先数八块砖砌在低处，再留两块放到第三层以上。",
      "高处那两块要真的在三层或更高，放在地面不算。",
      "一份材料就是一块砖；边放边数，凑够十份就完成。"
    ],
    successMessage: "十份材料，八下两上，预算刚好用完！",
    evaluatorId: "evaluator.material-budget",
    reward: { kind: "title", title: "预算管家" },
    learningGoal: "把总量拆成两部分做预算，练习加法与按计划分配材料",
    schemaVersion: 2,
    knowledgePointIds: ["kp.arithmetic.partition", "kp.engineering.planning"],
    prerequisiteMissionIds: ["mission.count-bridge.v1"],
    reflectionPrompt: "如果窗台要三块砖，总预算还是十份，墙身该留几块？",
    accessibilityNote: "预算拆分用文字说明（「八块主体 + 两块高处」）；进度「用上 {done}/{total} 份材料」为文字计数。",
    progressLanguage: "用上 {done}/{total} 份材料",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  },
  {
    id: "mission.my-design-note.v1",
    version: 1,
    title: "我的设计说明",
    context: "城堡里你最喜欢的那处工程，值得写下来给下一位工程师看。",
    goal: "写下至少十二个字，说说你做了什么、为什么这样设计",
    ageScope: "13-15",
    expressionForms: ["communication", "creation"],
    requiredCapabilities: ["building.basic"],
    hintLadder: [
      "不用写得多漂亮：说清楚「我做了什么」和「为什么这样做」就好。",
      "可以写你先铺地板再放水源的顺序，也可以写你改过的一次设计。",
      "写完点「记下我的想法」；内容不会被打分，也不会被传到别处。"
    ],
    successMessage: "你的设计说明记下了！把做法讲清楚，也是一种建造。",
    evaluatorId: "evaluator.my-design-note",
    reward: { kind: "title", title: "设计记录者" },
    learningGoal: "用文字外化设计过程，练习「做法 + 理由」的表达（只到 Exposure/Guided Practice）",
    schemaVersion: 2,
    knowledgePointIds: ["kp.communication.explain_reason"],
    prerequisiteMissionIds: [],
    reflectionPrompt: "如果重做一次，你会改哪一步？为什么？",
    accessibilityNote: "输入框有文字标签与明确按钮；进度「写下 {done}/{total} 个字」为文字计数；内容只保存在本次运行内存中。",
    progressLanguage: "写下 {done}/{total} 个字",
    unavailableReason: "需要「放置方块」能力，能力开放后就能玩。"
  }
];
