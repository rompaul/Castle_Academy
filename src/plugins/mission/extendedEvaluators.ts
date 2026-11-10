/**
 * V51-015 / V51-016 — 新增任务批次的确定性评估器。
 *
 * 红线（AC-212）：本文件所有评估器都是纯函数——同输入同输出，
 * 不读时钟、不取随机数、不访问 DOM / 网络 / localStorage / WorldSnapshot。
 * 只读传入的 `EvaluatorQuery`（水域查询 + 世界方块只读快照 + 学习者文字证据）。
 *
 * 设计约束：
 * - 新任务一律不复用/不改写 V0.5 的 `evaluateQuests()`；迁移三任务的判定保持单一真源。
 * - 判定条件必须要求「玩家真实动作」留下的痕迹，种子世界与 V0.5 护城河完成动作
 *   （在 (±5,1,0)/(0,1,±5) 放 4 个水源）都不能让任何新任务自动完成，
 *   否则会与 V0.5 完成反馈 / 奖励 E2E 冲突。
 */
import type { GridPosition } from "../../core/world/coordinates";
import type { EvaluatorQuery, EvaluatorRegistry, MissionEvaluator } from "./evaluators";

/** 内院范围（半径 4 石墙以内）：水需要玩家自建地板才能停留，V0.5 护城河水源到不了。 */
const innerCourtyard = (cell: GridPosition): boolean =>
  Math.abs(cell.x) <= 3 && Math.abs(cell.z) <= 3;

/** 世界方块只读快照降级：未注入 world 时返回空数组，评估器只会给出 0 进度。 */
function blocks(query: EvaluatorQuery): ReadonlyArray<{ position: GridPosition; blockId: string }> {
  return query.world?.all() ?? [];
}

function countBlocks(
  query: EvaluatorQuery,
  blockId: string,
  predicate: (position: GridPosition) => boolean = () => true
): number {
  return blocks(query).filter((block) => block.blockId === blockId && predicate(block.position)).length;
}

function wetCells(query: EvaluatorQuery, predicate: (cell: GridPosition) => boolean): number {
  return query.water.getWaterCells().filter(predicate).length;
}

/** 平实语言计数：done 上限即 total，不显示百分比。 */
function result(done: number, total: number) {
  const clamped = Math.max(0, Math.min(done, total));
  return clamped >= total
    ? { progress: 1, complete: true }
    : { progress: clamped / total, complete: false };
}

function describe(done: number, total: number) {
  return { done: Math.max(0, Math.min(done, total)), total };
}

/**
 * 结构性门槛：水格可能由 V0.5 舞台的高处水源「掉落」到内院（WaterSim 每下落一格都记水格），
 * 因此凡是用内院水格计数的评估器，都要求玩家先造出对应的地板 / 水源。
 * 这样「种子世界」与「V0.5 护城河完成动作 + 追加 (5,2,0) 水源」都不会误完成。
 */
const innerFloor = (query: EvaluatorQuery, y: number, minimum: number): boolean =>
  countBlocks(query, "stone", (p) => p.y === y && innerCourtyard(p)) >= minimum;

const innerSource = (query: EvaluatorQuery): boolean =>
  countBlocks(query, "water_source", (p) => p.y === 1 && innerCourtyard(p)) > 0;

/* ==================== V51-015 批次 1：水主题延伸（6 个） ==================== */

/** 水往哪里流：在高处放水源，观察水落到低处（两步观察证据）。 */
const waterFlow: MissionEvaluator = {
  id: "evaluator.water-flow",
  legacyQuestId: "",
  evaluate: (query) => {
    const highSource = countBlocks(query, "water_source", (p) => p.y >= 3) > 0;
    const lowWater = wetCells(query, (c) => c.y <= -1) > 0;
    return result(highSource ? 1 + (lowWater ? 1 : 0) : 0, 2);
  },
  describe: (query) => {
    const highSource = countBlocks(query, "water_source", (p) => p.y >= 3) > 0;
    const lowWater = wetCells(query, (c) => c.y <= -1) > 0;
    return describe(highSource ? 1 + (lowWater ? 1 : 0) : 0, 2);
  }
};

/** 七步之约：先铺内院地板，再数出 7 格横向扩散的水（水平上限 7 格）。 */
const sevenSteps: MissionEvaluator = {
  id: "evaluator.seven-steps",
  legacyQuestId: "",
  evaluate: (query) => innerFloor(query, 0, 6)
    ? result(wetCells(query, (c) => c.y === 1 && innerCourtyard(c)), 7)
    : { progress: 0, complete: false },
  describe: (query) => describe(
    innerFloor(query, 0, 6) ? wetCells(query, (c) => c.y === 1 && innerCourtyard(c)) : 0,
    7
  )
};

/** 渠与坝的选择：各造一种结构，比较水被引走与被挡住的结果。 */
const channelDam: MissionEvaluator = {
  id: "evaluator.channel-dam",
  legacyQuestId: "",
  evaluate: (query) => result(
    (countBlocks(query, "drain_channel") > 0 ? 1 : 0)
      + (countBlocks(query, "brick") >= 3 ? 1 : 0),
    2
  ),
  describe: (query) => describe(
    (countBlocks(query, "drain_channel") > 0 ? 1 : 0)
      + (countBlocks(query, "brick") >= 3 ? 1 : 0),
    2
  )
};

/** 给花园浇水：把水源放进内院，并让内院至少 3 格有水。 */
const gardenWater: MissionEvaluator = {
  id: "evaluator.garden-water",
  legacyQuestId: "",
  evaluate: (query) => innerSource(query)
    ? result(wetCells(query, (c) => c.y === 1 && innerCourtyard(c)), 3)
    : { progress: 0, complete: false },
  describe: (query) => describe(
    innerSource(query) ? wetCells(query, (c) => c.y === 1 && innerCourtyard(c)) : 0,
    3
  )
};

/** 断水的管道：铺 3 段以上蓝色管道，并让其中至少一段真正通水。 */
const brokenPipe: MissionEvaluator = {
  id: "evaluator.broken-pipe",
  legacyQuestId: "",
  evaluate: (query) => {
    const pipes = blocks(query).filter((block) => block.blockId === "water_pipe_blue");
    const flowing = pipes.filter((pipe) => query.water.isPipeFlowing(pipe.position)).length;
    return result(Math.min(pipes.length, 3) + (flowing > 0 ? 1 : 0), 4);
  },
  describe: (query) => {
    const pipes = blocks(query).filter((block) => block.blockId === "water_pipe_blue");
    const flowing = pipes.filter((pipe) => query.water.isPipeFlowing(pipe.position)).length;
    return describe(Math.min(pipes.length, 3) + (flowing > 0 ? 1 : 0), 4);
  }
};

/** 蓄水池容量：在 y=2 的内院平台上蓄出 12 格水（数格子估容量）。 */
const reservoir: MissionEvaluator = {
  id: "evaluator.reservoir",
  legacyQuestId: "",
  evaluate: (query) => innerFloor(query, 1, 8)
    ? result(wetCells(query, (c) => c.y === 2 && innerCourtyard(c)), 12)
    : { progress: 0, complete: false },
  describe: (query) => describe(
    innerFloor(query, 1, 8) ? wetCells(query, (c) => c.y === 2 && innerCourtyard(c)) : 0,
    12
  )
};

export const WATER_EXTENSION_EVALUATORS: readonly MissionEvaluator[] = [
  waterFlow, sevenSteps, channelDam, gardenWater, brokenPipe, reservoir
];

/**
 * 注册本版全部新增评估器。V51-016 的跨年龄带评估器在此追加，
 * 保持 `createDefaultEvaluatorRegistry()` 为产品唯一注册表入口。
 */
export function registerExtendedEvaluators(registry: EvaluatorRegistry): void {
  for (const evaluator of WATER_EXTENSION_EVALUATORS) registry.register(evaluator);
}
