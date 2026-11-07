import { positionKey, type GridPosition } from "../../core/world/coordinates";

/**
 * V05-005 — WaterSim：水域规则验证级纯逻辑模块（ADR-0005）。
 *
 * 设计约束：
 * - 无 DOM / Three.js / 随机数 / 墙钟 / 隐藏全局状态：同一输入永远得到同一输出（重放即重算）。
 * - 水格只有"有水/无水"两态（规则验证级，无水位分级）。
 * - 全量 BFS 重算：从全部水源出发，确定性遍历（键序排序保证可重放）。
 * - 世界边界由调用方的查询回调保证（WaterSim 不感知 WORLD_BOUNDS）。
 *
 * 规则（执行包 V0.5_Implementation_Plan §2.2，owner 已批准）：
 * 1. 水只存在于空格（无方块的位置）。
 * 2. 向下：正下方为空格 → 流向正下方（水平计数清零），一路到底。
 * 3. 水平：当前格正下方非空（被方块/水支撑）→ 向四邻空格扩散，
 *    水平步数 ≤ config.horizontalSpreadLimit。
 * 4. 排水渠：水流尝试进入 drain_channel 所在格即被吸收（终止，不穿透）。
 * 5. 管道：与水源正交连通的管道链 = flowing；链上任一管道的正交空格为出水口
 *    （视为被支撑的源头，水平计数清零）。
 */

export interface WaterSimConfig {
  /** 水平扩散上限（格） */
  horizontalSpreadLimit: number;
  /** 模拟 tick 周期（毫秒）——由 WaterPlugin 用于分批应用 */
  tickIntervalMs: number;
  /** 单 tick 应用格子上限（分批应用，不阻塞渲染帧） */
  maxCellsPerTick: number;
}

export const DEFAULT_WATER_SIM_CONFIG: WaterSimConfig = {
  horizontalSpreadLimit: 7,
  tickIntervalMs: 150,
  maxCellsPerTick: 512,
};

/** 方块类型查询回调（由 WaterPlugin 从 WorldState 提供） */
export interface WaterWorldQuery {
  /** 该格是否有任意方块（含水源/渠/管道） */
  hasBlock(position: GridPosition): boolean;
  /** 该格的 blockId（无方块返回 undefined） */
  blockAt(position: GridPosition): string | undefined;
}

export interface WaterSimInput {
  world: WaterWorldQuery;
  /** 全部水源方块位置 */
  sources: Iterable<GridPosition>;
  /** 世界垂直下边界：水不会流动到 y < minY 的格子（真实世界传 WORLD_BOUNDS.minY） */
  minY: number;
}

export interface WaterSimResult {
  /** 有水空格：positionKey → 位置 */
  water: Map<string, GridPosition>;
  /** 通水管道：positionKey 集合 */
  flowingPipes: Set<string>;
  /** 已吸收水的排水渠：positionKey 集合（诊断/未来湿润效果用） */
  wetDrains: Set<string>;
}

const HORIZONTAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** 确定性遍历辅助：按 positionKey 排序 */
function sortedByPositionKey<T extends GridPosition>(items: Iterable<T>): T[] {
  return [...items].sort((a, b) => positionKey(a).localeCompare(positionKey(b)));
}

function parseKey(key: string): GridPosition {
  const [x, y, z] = key.split(",").map(Number) as [number, number, number];
  return { x, y, z };
}

/**
 * 计算水域目标状态（全量重算）。
 * 阶段：① 管道连通 BFS → ② 水 BFS（水源 + 通水管道出水口为种子）。
 */
export function computeWater(input: WaterSimInput, config: WaterSimConfig = DEFAULT_WATER_SIM_CONFIG): WaterSimResult {
  const { world } = input;
  const water = new Map<string, GridPosition>();
  const flowingPipes = new Set<string>();
  const wetDrains = new Set<string>();

  const isDrain = (position: GridPosition): boolean => world.blockAt(position) === "drain_channel";
  const isPipe = (position: GridPosition): boolean => world.blockAt(position) === "water_pipe_blue";

  /* ---------- ① 管道连通 BFS：与水源正交连通的管道链 ---------- */
  const pipeQueue: GridPosition[] = [];
  const pipeSeen = new Set<string>();
  const enqueueAdjacentPipes = (origin: GridPosition): void => {
    for (const [dx, dz] of HORIZONTAL_DELTAS) {
      const neighbor = { x: origin.x + dx, y: origin.y, z: origin.z + dz };
      const key = positionKey(neighbor);
      if (isPipe(neighbor) && !pipeSeen.has(key)) {
        pipeSeen.add(key);
        pipeQueue.push(neighbor);
      }
    }
  };
  for (const source of sortedByPositionKey(input.sources)) {
    enqueueAdjacentPipes(source);
  }
  while (pipeQueue.length > 0) {
    const pipe = pipeQueue.shift()!;
    flowingPipes.add(positionKey(pipe));
    enqueueAdjacentPipes(pipe);
    // 垂直相邻管道也连通（立管）
    for (const dy of [-1, 1]) {
      const neighbor = { x: pipe.x, y: pipe.y + dy, z: pipe.z };
      const key = positionKey(neighbor);
      if (isPipe(neighbor) && !pipeSeen.has(key)) {
        pipeSeen.add(key);
        pipeQueue.push(neighbor);
      }
    }
  }

  /* ---------- ② 水 BFS ---------- */
  const queue: Array<{ position: GridPosition; hDist: number }> = [];

  /** 尝试让水流向某格：空格才进水；渠吸收；管道格不进水。返回是否成功进水。 */
  const flowInto = (position: GridPosition, hDist: number): boolean => {
    const key = positionKey(position);
    if (water.has(key)) return false;
    if (world.hasBlock(position)) {
      if (isDrain(position)) wetDrains.add(key);
      return false;
    }
    water.set(key, position);
    queue.push({ position, hDist });
    return true;
  };

  /** 从一个出水点引水。水源需下方有支撑才水平出水；管道承压始终水平出水；两者均向下优先。 */
  const outflowFrom = (origin: GridPosition, horizontalAllowed: boolean): void => {
    if (horizontalAllowed) {
      for (const [dx, dz] of HORIZONTAL_DELTAS) {
        const neighbor = { x: origin.x + dx, y: origin.y, z: origin.z + dz };
        if (flowingPipes.has(positionKey(neighbor))) continue;
        flowInto(neighbor, 1);
      }
    }
    // 向下优先（不越过世界下边界）
    if (origin.y - 1 >= input.minY) {
      flowInto({ x: origin.x, y: origin.y - 1, z: origin.z }, 0);
    }
  };

  const seeds: GridPosition[] = sortedByPositionKey(input.sources);
  for (const key of [...flowingPipes].sort()) {
    seeds.push(parseKey(key));
  }
  for (const origin of seeds) {
    // 管道（被占据的格）承压出水；水源仅在其下方有支撑时水平出水
    const belowOrigin = { x: origin.x, y: origin.y - 1, z: origin.z };
    const supported = world.hasBlock(belowOrigin);
    outflowFrom(origin, supported);
  }

  while (queue.length > 0) {
    const cell = queue.shift()!;
    const below = { x: cell.position.x, y: cell.position.y - 1, z: cell.position.z };
    const belowKey = positionKey(below);
    if (world.hasBlock(below)) {
      if (isDrain(below)) wetDrains.add(belowKey);
      // 被支撑：向四邻水平扩散（受上限约束）
      if (cell.hDist + 1 <= config.horizontalSpreadLimit) {
        for (const [dx, dz] of HORIZONTAL_DELTAS) {
          const neighbor = { x: cell.position.x + dx, y: cell.position.y, z: cell.position.z + dz };
          flowInto(neighbor, cell.hDist + 1);
        }
      }
    } else if (!water.has(belowKey) && below.y >= input.minY) {
      // 正下方为空且未越出世界下边界：向下流，水平计数清零
      water.set(belowKey, below);
      queue.push({ position: below, hDist: 0 });
    }
  }

  return { water, flowingPipes, wetDrains };
}
