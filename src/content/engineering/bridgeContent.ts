/**
 * V0.7.1 P1 — 「修复王国旧桥」内容包（纯数据，零副作用）。
 *
 * 故事、导师提示、知识片段与分龄表达集中在此；计算引擎只返回 messageKey，
 * 由本模块映射成儿童能懂的话，避免在规则层硬编码 UI 文案。
 */
import type { AgeBand } from "../../plugins/learner/types";
import type { DesignStage } from "../../features/engineering-design/types";

export const BRIDGE_STORY = Object.freeze({
  briefing:
    "采石场通往城堡的旧桥在风暴中损坏了。运输车过不去，城堡修复也停了下来。先看看河道有多宽，再决定桥该做多长、多宽，算好材料就能亲自把它建起来。",
  mentorName: "建筑导师",
  mentorIntro: "工程师不会在没有测量的情况下开始施工。",
  siteHint: "看这里：河道从城堡东边流过，旧桥的两个桥头还在两岸。",
  safetyNote: "这是游戏里的简化建造规则，不是现实桥梁的施工方法。"
});

export const BRIDGE_STAGE_LABELS: Readonly<Record<DesignStage, string>> = Object.freeze({
  briefing: "委托",
  "site-survey": "测绘",
  "guided-design": "设计",
  "design-validation": "验证",
  construction: "建造",
  "construction-validation": "验收",
  completed: "完成"
});

/** H0–H4：先从视觉线索开始，H4 才给完整示范。 */
export const BRIDGE_HINT_LEVELS: readonly string[] = Object.freeze([
  "先自己看一看、试一试。",
  "看亮起来的河岸和桥头，它们是要对齐的地方。",
  "桥的两端除了跨过河，还要各踩到岸上一点，够不够呢？",
  "打开小图解：河宽 6 格，两岸各留 1 格，所以桥至少 8 格长。",
  "完整示范：长度调到 8、宽度调到 3，材料需要 24 块木板，然后进入施工。"
]);

export interface BridgeKnowledgeSnippet {
  readonly knowledgePointId: string;
  readonly title: string;
  readonly body: string;
  readonly visual: string;
  readonly ageVariants: Readonly<Partial<Record<AgeBand, string>>>;
}

export const BRIDGE_KNOWLEDGE_SNIPPETS: readonly BridgeKnowledgeSnippet[] = Object.freeze([
  {
    knowledgePointId: "kp.measurement.height",
    title: "量一量河有多宽",
    body: "把测量尺的两端放在河的两岸，读出中间隔了几格。知道河有多宽，才知道桥至少要多长。",
    visual: "河道网格两端亮起，中间显示「6 格」。",
    ageVariants: {
      "6-7": "一格一格数过去，数到对岸就是河宽。",
      "9-12": "测量尺给出格数，这个数会直接带进设计。",
      "13-15": "先确定有效测量端点，再比较不同量法的误差。"
    }
  },
  {
    knowledgePointId: "kp.engineering.planning",
    title: "两端要落在岸上",
    body: "桥不能刚好只碰到水边。左边和右边都要多留一格踩在岸上，这样桥才接得上路。",
    visual: "桥面两端在岸上的格子会亮成黄色。",
    ageVariants: {
      "6-7": "桥头要踩到岸上，像小手抓住两边。",
      "11-12": "河宽加上左右搭接，就是桥的最小长度。"
    }
  },
  {
    knowledgePointId: "kp.measurement.area",
    title: "桥面盖住多少格",
    body: "桥面有长也有宽。长和宽一起决定整块桥面盖住多少格，数一数高亮的格子就知道。",
    visual: "桥面按行逐格点亮，右侧同步显示「长 × 宽」。",
    ageVariants: {
      "6-7": "一排一排数，格子一共有多少。",
      "9-12": "长乘以宽，就是桥面覆盖的格数。",
      "13-15": "比较 8×3 和 9×3，看面积怎样随边长变化。"
    }
  },
  {
    knowledgePointId: "kp.arithmetic.multiplication",
    title: "几排，每排几个",
    body: "8 格长、3 格宽，就是 3 排、每排 8 格。用乘法很快能算出 24 格，再数一遍也一样。",
    visual: "网格先按排分组，再合并成一个总数。",
    ageVariants: {
      "6-7": "3 排，每排数 8 个，也可以一排一排加起来。",
      "11-12": "8 × 3 = 24，乘法是重复加法的快办法。"
    }
  },
  {
    knowledgePointId: "kp.engineering.material_count",
    title: "一格一块木板",
    body: "每盖住一格就用一块木板。桥面有多少格，就需要多少块木板；预算是 40 块。",
    visual: "每个高亮格上浮出一块木板图示，材料计数跟着变化。",
    ageVariants: {
      "6-7": "一个格子放一块，数格子就是数木板。",
      "13-15": "试试不同尺寸，看看哪种既够用又省材料。"
    }
  }
]);

/** BR-01~BR-08 的儿童友好提示，规则层只返回 key。 */
export const BRIDGE_VALIDATION_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "BR-01": "先拖动测量尺，量出河道有多宽。",
  "BR-02": "桥的两端还没有都落到岸上，试着把桥加长一点。",
  "BR-03": "运输通道还不够宽，桥面至少要做 3 格宽。",
  "BR-04": "这个长度不太合适，把桥调整到 8 到 10 格。",
  "BR-05": "宽度请选择 3 格或 4 格。",
  "BR-06": "木板不够了，试试把桥面做小一点。",
  "BR-07": "桥面蓝图里有空缺，检查亮起来的格子。",
  "BR-08": "桥面要在左右两岸各留出搭接的位置。"
});

export const BRIDGE_RESULT_MESSAGES = Object.freeze({
  designPassed: "方案通过了！桥的尺寸、搭接和材料都合适，可以去建造了。",
  designFailed: "还差一点。看看下面的提示，改一改再检查。",
  constructionDone: "桥面全都铺好了！通路恢复了，运输车又能过桥了。",
  freeBuildReminder: "这只是游戏里的建造挑战，自由建造里的方块没有变化。"
});

export const BRIDGE_NEXT_MISSION_TEASER = Object.freeze({
  title: "下一项工程：修复旧水井",
  body: "完成桥梁后解锁的「基础石砌材料包」，下次修井壁和井口时会用到。",
  rewardName: "基础石砌材料包",
  rewardId: "resourceKit.masonry_basic",
  note: "这项材料将在下一项工程中使用。这项任务还没有开放。"
});

export const BRIDGE_SITE_MAP_LABELS = Object.freeze({
  river: "河道",
  leftBank: "左岸（采石场一侧）",
  rightBank: "右岸（城堡一侧）",
  oldBridge: "旧桥位置",
  measureStart: "测量起点",
  measureEnd: "测量终点",
  designOutline: "我的桥面"
});

/** 分龄提示密度：只改变表达，不改变判定条件。 */
export function bridgeHintForAge(level: number, ageBand: AgeBand | undefined): string {
  const base = BRIDGE_HINT_LEVELS[Math.max(0, Math.min(level, BRIDGE_HINT_LEVELS.length - 1))];
  if (!ageBand) return base;
  if (ageBand === "6-7" && level >= 3) return `数一数、看一看：${base}`;
  if (ageBand === "13-15" && level >= 3) return base;
  return base;
}
