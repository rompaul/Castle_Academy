/**
 * V07-007 — 六个形式专属评估器（ADR-0014 决策 5 / 决策 6）。
 *
 * 纯函数：只读传入的 `EvaluatorQuery`，禁随机 / 墙钟 / 网络 / DOM / 存档；
 * `EvaluatorResult` 仍为 `{progress, complete, evidence?: {observation}}` 三字段，
 * 不返回等级 / 分数 / 正确率。完成判定只来自确定性查询，不来自点击次数、
 * 文本长度、计时或任何自动评价。
 *
 * `V07-021` 已把 6 个评估器只追加到 `createDefaultEvaluatorRegistry()` 末尾；
 * 期望值适配按 owner 已批准的完整清单逐条留痕，见
 * `docs/v0.7/V07-021_EXPECTATION_ADAPTATION.md`。既有 18 个评估器 ID 与顺序零变更。
 */
import { V07_MISSION_CONTRACTS } from "../../content/missions/v07MissionContracts";
import type { DecisionEntry, ObservationEntry, VariablePair } from "./interactionContracts";
import type { EvaluatorQuery, EvaluatorRegistry, MissionEvaluator } from "./evaluators";

/** 受控选项 ID：UI 与评估器共用，不是自由文本。 */
export const OBSERVATION_TARGETS: readonly string[] = Object.freeze([
  "water-source", "channel-end", "moat-side"
]);
export const DIAGNOSIS_HYPOTHESES: readonly string[] = Object.freeze([
  "source", "break", "valve"
]);
export const ROUTE_CHOICES: readonly string[] = Object.freeze([
  "near-stream", "save-material", "care-garden", "share-water", "steady-flow"
]);
/** 地图标记块：全部取自既有 34 个 BlockId，不新增方块 / 材质 / atlas 条目。 */
export const STORY_MAP_MARKERS: readonly string[] = Object.freeze([
  "water_source", "lamp_basic", "brick_limestone"
]);
export const ROUTE_STEP_COUNT = 3;

const MISSION = {
  findThePattern: "mission.find-the-pattern.v1",
  switchCompare: "mission.switch-compare.v1",
  whyNoWater: "mission.why-no-water-here.v1",
  chooseRoute: "mission.choose-water-route.v1",
  explainChoice: "mission.explain-my-choice.v1",
  storyMap: "mission.story-map.v1"
} as const;

interface Count {
  readonly done: number;
  readonly total: number;
}

function forMission<T extends { readonly missionId: string }>(
  list: ReadonlyArray<T> | undefined,
  missionId: string
): ReadonlyArray<T> {
  return (list ?? []).filter((entry) => entry.missionId === missionId);
}

function makeEvaluator(
  id: string,
  counter: (query: EvaluatorQuery) => Count
): MissionEvaluator {
  return {
    id,
    // 新任务没有 V0.5 迁移期旧 quest ID；旧事件单点发射按 missionId 兜底
    legacyQuestId: "",
    evaluate: (query) => {
      const { done, total } = counter(query);
      const safeDone = Math.max(0, Math.min(done, total));
      return {
        progress: total === 0 ? 0 : safeDone / total,
        complete: total > 0 && safeDone >= total,
        evidence: { observation: `${safeDone}/${total}` }
      };
    },
    describe: (query) => {
      const { done, total } = counter(query);
      return { done: Math.max(0, Math.min(done, total)), total };
    }
  };
}

/** Exploration：3 个去重后的受控观察点；不看文字内容。 */
function countObservations(query: EvaluatorQuery): Count {
  const targets = new Set(
    forMission<ObservationEntry>(query.observationLog, MISSION.findThePattern).map((o) => o.target)
  );
  return {
    done: OBSERVATION_TARGETS.filter((target) => targets.has(target)).length,
    total: OBSERVATION_TARGETS.length
  };
}

/**
 * Experiment：同一位置的两种二值状态 + 结果不同。
 * 优先读本版 `variableComparison`，同时复用 V0.6.1 `getSwitchObservations()`
 * 的同一位置成对观察（closed 灯亮 / open 灯灭）；零物理量、零数值模拟。
 */
function countSwitchComparison(query: EvaluatorQuery): Count {
  let closedSeen = false;
  let openSeen = false;
  let paired = false;

  for (const pair of forMission<VariablePair>(query.variableComparison, MISSION.switchCompare)) {
    if (pair.stateA === "closed" || pair.stateB === "closed") closedSeen = true;
    if (pair.stateA === "open" || pair.stateB === "open") openSeen = true;
    if (pair.stateA !== pair.stateB && pair.outcomeA !== pair.outcomeB) paired = true;
  }

  const groups = new Map<string, { closedPowered: boolean; openUnpowered: boolean }>();
  for (const observation of query.electrical?.getSwitchObservations() ?? []) {
    const key = `${observation.position.x},${observation.position.y},${observation.position.z}`;
    const group = groups.get(key) ?? { closedPowered: false, openUnpowered: false };
    if (observation.state === "closed" && observation.lampPowered) {
      group.closedPowered = true;
      closedSeen = true;
    }
    if (observation.state === "open" && !observation.lampPowered) {
      group.openUnpowered = true;
      openSeen = true;
    }
    groups.set(key, group);
  }
  if ([...groups.values()].some((g) => g.closedPowered && g.openUnpowered)) paired = true;

  return {
    done: Number(closedSeen) + Number(openSeen) + Number(paired),
    total: 3
  };
}

/**
 * Problem-solving：最终假设（可改，取最后一条）+ 与该假设对应的结构化验证观察
 * + `WaterQuery.isConverged()` 世界稳定门。改假设不惩罚；不读自由文本、
 * 不按失败次数降级；水查询只提供收敛门，不含任何数值工程判定。
 */
function countDiagnosis(query: EvaluatorQuery): Count {
  const choices = forMission<DecisionEntry>(query.decisionSequence, MISSION.whyNoWater)
    .filter((d) => d.step === 0 && DIAGNOSIS_HYPOTHESES.includes(d.choiceId));
  // 按确定性序号取最终假设，不依赖数组插入顺序（AC-7032 插入顺序置换结果一致）
  const latest = choices.reduce<DecisionEntry | null>(
    (acc, entry) => (acc === null || entry.sequence >= acc.sequence ? entry : acc),
    null
  );
  const hypothesis = latest?.choiceId ?? null;
  const hasHypothesis = hypothesis !== null;
  const verified = hasHypothesis
    && forMission<ObservationEntry>(query.observationLog, MISSION.whyNoWater)
      .some((o) => o.target === `check:${hypothesis}`);
  const settled = query.water.isConverged();
  return {
    done: Number(hasHypothesis) + Number(verified) + Number(settled),
    total: 3
  };
}

/** Life simulation：3 个不同步骤各留一条受控选择；只读，不写 WorldState。 */
function countRouteDecisions(query: EvaluatorQuery): Count {
  const steps = new Set(
    forMission<DecisionEntry>(query.decisionSequence, MISSION.chooseRoute)
      .filter((d) => d.step >= 1 && d.step <= ROUTE_STEP_COUNT && ROUTE_CHOICES.includes(d.choiceId))
      .map((d) => d.step)
  );
  return { done: steps.size, total: ROUTE_STEP_COUNT };
}

/** Communication：只确认「有没有留下一段话」，不读长度、不评内容、不自动判分。 */
function countExplanation(query: EvaluatorQuery): Count {
  return {
    done: query.textEvidence?.has(MISSION.explainChoice) ? 1 : 0,
    total: 1
  };
}

/** Creation：按既有 blockId 计数 3 类标记，不评价美观、不排名。 */
function countStoryMarkers(query: EvaluatorQuery): Count {
  const placed = new Set((query.world?.all() ?? []).map((cell) => cell.blockId));
  return {
    done: STORY_MAP_MARKERS.filter((id) => placed.has(id)).length,
    total: STORY_MAP_MARKERS.length
  };
}

export const INTERACTIVE_EVALUATORS: readonly MissionEvaluator[] = Object.freeze([
  makeEvaluator("evaluator.find-the-pattern", countObservations),
  makeEvaluator("evaluator.switch-compare", countSwitchComparison),
  makeEvaluator("evaluator.why-no-water-here", countDiagnosis),
  makeEvaluator("evaluator.choose-water-route", countRouteDecisions),
  makeEvaluator("evaluator.explain-my-choice", countExplanation),
  makeEvaluator("evaluator.story-map", countStoryMarkers)
]);

export function registerInteractiveEvaluators(registry: EvaluatorRegistry): void {
  for (const evaluator of INTERACTIVE_EVALUATORS) registry.register(evaluator);
}

/** 供内容与 UI 侧复用的任务 ID 常量（与冻结表同源）。 */
export const INTERACTIVE_MISSION_IDS: readonly string[] = Object.freeze(
  V07_MISSION_CONTRACTS.map((contract) => contract.id)
);
