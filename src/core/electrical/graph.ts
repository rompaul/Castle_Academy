/**
 * V061-004 — 纯电力领域模型：确定性图算法（ADR-0011 / AC-6701~6710 的规则载体）。
 *
 * 规则（已批准的 ADR-0011 决策 1~4、9、10）：
 * 1. 只用六正交邻居 ±X/±Y/±Z 连通，禁止对角。
 * 2. 导电单元 = 电源 + 电线 + 闭合开关；电源本身是连通分量端点。
 * 3. 负载（灯 / 信标 / 水泵）**不导电**；「与已通电导体相邻即取电」，不引入终端元数据。
 * 4. 同一连通分量出现 ≥2 个电源 → source-conflict，该分量导体与相邻负载都不供电。
 * 5. 断开开关 `switch_open` 阻断路径；它造成的可修复断路优先诊断为 `switch-open`。
 * 6. 通电态 / 连通分量 / 负载状态全部是**本次重算的派生结果**，无缓存、无序列化、无事件。
 *
 * 确定性：输入先按数值坐标序排序，邻居按固定 delta 顺序，分量种子按排序后的导体序；
 * 无随机数 / 墙钟 / 渲染状态 / 异步竞态；同一方块集合的任意插入顺序产生字节等价结果。
 *
 * 有界性（AC-6710）：格子 / 边 / 操作数任一超限即安全回退「全部未通电 + unknown」，
 * 不抛异常、不部分供电、不每帧扫描。
 *
 * 本模块只依赖 `coordinates.ts` 的纯坐标工具；不 import WorldState / UI / 渲染 / 插件。
 */

import { isGridPosition, positionKey, type GridPosition } from "../world/coordinates";
import {
  DEFAULT_ELECTRICAL_SIM_LIMITS,
  ELECTRICAL_BLOCK_ROLES,
  isElectricalLikeId,
  type ElectricalComponent,
  type ElectricalLoadState,
  type ElectricalNetworkInput,
  type ElectricalNetworkResult,
  type ElectricalNetworkStats,
  type ElectricalRole,
  type ElectricalSimLimits,
} from "./types";

/** 固定邻居顺序：±X、±Y、±Z（六正交，无对角）。 */
const ORTHOGONAL_DELTAS: ReadonlyArray<readonly [number, number, number]> = Object.freeze([
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
]);

interface ClassifiedCell {
  key: string;
  position: GridPosition;
  blockId: string;
  role: ElectricalRole;
}

interface NormalizedCells {
  cells: ClassifiedCell[];
  invalidReason: string | null;
}

function comparePositions(a: GridPosition, b: GridPosition): number {
  return a.x - b.x || a.y - b.y || a.z - b.z;
}

function neighborKeys(position: GridPosition): string[] {
  return ORTHOGONAL_DELTAS.map(([dx, dy, dz]) =>
    positionKey({ x: position.x + dx, y: position.y + dy, z: position.z + dz }),
  );
}

/**
 * 规范化输入：校验坐标、拒绝重复位置、忽略无关方块、把未知电力方块标为畸形。
 * 返回按数值坐标序排序的电力格，保证插入顺序置换不改变后续任何遍历顺序。
 *
 * V061-008 修正（DEV-610）：异常不再提前 return —— 否则畸形格之后出现的负载会被丢掉，
 * 安全降级时无法把它们显式登记为 `unknown`（AC-6721）。现在异常只记 invalidReason，
 * 仍继续收集其余合法电力格；`computeElectricalNetwork()` 一律走降级分支，绝不部分供电。
 */
function normalize(input: ElectricalNetworkInput): NormalizedCells {
  const cells: ClassifiedCell[] = [];
  const seen = new Set<string>();
  let invalidReason: string | null = null;
  for (const cell of input.cells) {
    if (!cell || typeof cell.blockId !== "string" || !cell.position || !isGridPosition(cell.position)) {
      invalidReason ??= "malformed-cell";
      continue;
    }
    const position: GridPosition = {
      x: cell.position.x,
      y: cell.position.y,
      z: cell.position.z,
    };
    const key = positionKey(position);
    if (seen.has(key)) {
      invalidReason ??= `duplicate-position:${key}`;
      continue;
    }
    seen.add(key);

    const role = ELECTRICAL_BLOCK_ROLES[cell.blockId];
    if (role === undefined) {
      // 未注册但「看起来像电力方块」的畸形元数据：安全降级，绝不静默判为通电（AC-6721）。
      if (isElectricalLikeId(cell.blockId)) {
        invalidReason ??= `unknown-electrical-block:${cell.blockId}`;
      }
      continue; // 无关方块不改变电力结果（AC-6708）
    }
    cells.push({ key, position, blockId: cell.blockId, role });
  }
  cells.sort((a, b) => comparePositions(a.position, b.position));
  return { cells, invalidReason };
}

/**
 * 计算电力网络目标状态（全量、确定性、有界重算）。
 * 每次调用都从输入重建，不持有任何可变的跨次状态（AC-6707 移除方块后陈旧通电态自然失效）。
 */
export function computeElectricalNetwork(
  input: ElectricalNetworkInput,
  limits: ElectricalSimLimits = DEFAULT_ELECTRICAL_SIM_LIMITS,
): ElectricalNetworkResult {
  let operations = 0;
  let edgeCount = 0;

  const normalized = normalize(input);
  const conductors: ClassifiedCell[] = [];
  const loads: ClassifiedCell[] = [];
  const openSwitches: ClassifiedCell[] = [];
  for (const cell of normalized.cells) {
    switch (cell.role) {
      case "source":
      case "conductor":
      case "switch-closed":
        conductors.push(cell);
        break;
      case "load":
        loads.push(cell);
        break;
      case "switch-open":
        openSwitches.push(cell);
        break;
      case "valve":
        // 阀门是水侧状态，不参与电力图（Q-2 / ADR-0011 决策 5）。
        break;
    }
  }
  const cellCount = conductors.length + loads.length + openSwitches.length;

  const stats = (): ElectricalNetworkStats => ({ cellCount, edgeCount, operationCount: operations });

  /** 安全降级：全部未通电、所有负载 unknown；不抛异常、不部分供电。 */
  const degraded = (
    status: "limit-exceeded" | "invalid-input",
    reason: string,
  ): ElectricalNetworkResult => {
    const loadStates = new Map<string, ElectricalLoadState>();
    for (const load of loads) loadStates.set(load.key, "unknown");
    return Object.freeze({
      status,
      reason,
      poweredConductors: new Set<string>(),
      componentOf: new Map<string, number>(),
      components: Object.freeze([]) as readonly ElectricalComponent[],
      loadStates,
      poweredLoads: new Set<string>(),
      stats: stats(),
    });
  };

  if (normalized.invalidReason !== null) {
    return degraded("invalid-input", normalized.invalidReason);
  }
  if (cellCount > limits.maxCells) {
    return degraded("limit-exceeded", `maxCells:${cellCount}>${limits.maxCells}`);
  }

  const conductorByKey = new Map<string, ClassifiedCell>();
  const conductorKeys = new Set<string>();
  for (const conductor of conductors) {
    conductorByKey.set(conductor.key, conductor);
    conductorKeys.add(conductor.key);
  }

  /* ---------- ① 导体邻接（六正交，固定 delta 顺序） ---------- */
  const adjacency = new Map<string, readonly string[]>();
  for (const cell of conductors) {
    const neighbors: string[] = [];
    for (const [dx, dy, dz] of ORTHOGONAL_DELTAS) {
      operations++;
      if (operations > limits.maxOperations) {
        return degraded("limit-exceeded", `maxOperations>${limits.maxOperations}`);
      }
      const key = positionKey({
        x: cell.position.x + dx,
        y: cell.position.y + dy,
        z: cell.position.z + dz,
      });
      if (conductorKeys.has(key)) {
        neighbors.push(key);
        // 无向边只计一次（两端各自的 neighbors 数组仍保留双向，供 BFS 使用）。
        if (cell.key < key) edgeCount++;
      }
    }
    adjacency.set(cell.key, neighbors);
    if (edgeCount > limits.maxEdges) {
      return degraded("limit-exceeded", `maxEdges:${edgeCount}>${limits.maxEdges}`);
    }
  }

  /* ---------- ② 连通分量 BFS（种子按数值坐标序，邻居按固定 delta 序） ---------- */
  const componentOf = new Map<string, number>();
  const rawComponents: Array<{ cellKeys: string[]; sourceCount: number }> = [];
  for (const seed of conductors) {
    if (componentOf.has(seed.key)) continue;
    const id = rawComponents.length;
    componentOf.set(seed.key, id);
    const queue: string[] = [seed.key];
    const members: string[] = [];
    let sourceCount = 0;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      members.push(current);
      if (conductorByKey.get(current)!.role === "source") sourceCount++;
      for (const neighbor of adjacency.get(current) ?? []) {
        operations++;
        if (operations > limits.maxOperations) {
          return degraded("limit-exceeded", `maxOperations>${limits.maxOperations}`);
        }
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, id);
          queue.push(neighbor);
        }
      }
    }
    rawComponents.push({ cellKeys: members.sort(), sourceCount });
  }

  const components: ElectricalComponent[] = rawComponents.map((raw, id) => {
    const status: ElectricalComponent["status"] =
      raw.sourceCount >= 2 ? "source-conflict" : raw.sourceCount === 1 ? "powered" : "unpowered";
    return Object.freeze({
      id,
      cellKeys: Object.freeze(raw.cellKeys),
      sourceCount: raw.sourceCount,
      status,
      powered: status === "powered",
    });
  });

  const poweredConductors = new Set<string>();
  for (const conductor of conductors) {
    const id = componentOf.get(conductor.key);
    if (id !== undefined && components[id].powered) poweredConductors.add(conductor.key);
  }

  /* ---------- ③ 断开开关的「可修复断路」诊断 ----------
   * 若某个 switch_open 同时邻接一个已通电导体与某个未通电分量，
   * 则被它隔断的那一侧负载报 switch-open（换 switch_closed 后即通电）。 */
  const openSwitchKeys = new Set(openSwitches.map((cell) => cell.key));
  const breaks: Array<{ poweredSide: boolean; componentIds: Set<number> }> = [];
  for (const cell of openSwitches) {
    const keys = neighborKeys(cell.position);
    operations += ORTHOGONAL_DELTAS.length;
    if (operations > limits.maxOperations) {
      return degraded("limit-exceeded", `maxOperations>${limits.maxOperations}`);
    }
    const info = { poweredSide: false, componentIds: new Set<number>() };
    for (const key of keys) {
      if (poweredConductors.has(key)) info.poweredSide = true;
      const id = componentOf.get(key);
      if (id !== undefined && !components[id].powered) info.componentIds.add(id);
    }
    breaks.push(info);
  }

  /* ---------- ④ 负载取电：与已通电导体相邻即取电 ---------- */
  const loadStates = new Map<string, ElectricalLoadState>();
  for (const load of loads) {
    const keys = neighborKeys(load.position);
    operations += ORTHOGONAL_DELTAS.length;
    if (operations > limits.maxOperations) {
      return degraded("limit-exceeded", `maxOperations>${limits.maxOperations}`);
    }
    const adjacent = new Set<number>();
    let touchesPowered = false;
    let touchesConflict = false;
    let touchesOpenSwitch = false;
    for (const key of keys) {
      if (openSwitchKeys.has(key)) touchesOpenSwitch = true;
      const id = componentOf.get(key);
      if (id === undefined) continue;
      adjacent.add(id);
      if (components[id].powered) touchesPowered = true;
      else if (components[id].status === "source-conflict") touchesConflict = true;
    }

    let state: ElectricalLoadState;
    if (touchesPowered) {
      // 冻结的终端规则优先：有健康的已通电导体相邻即取电。
      state = "powered";
    } else if (touchesConflict) {
      state = "source-conflict";
    } else if (
      touchesOpenSwitch ||
      breaks.some((info) =>
        info.poweredSide && [...info.componentIds].some((id) => adjacent.has(id)),
      )
    ) {
      state = "switch-open";
    } else {
      state = "no-connection";
    }
    loadStates.set(load.key, state);
  }

  const poweredLoads = new Set<string>();
  for (const [key, state] of loadStates) {
    if (state === "powered") poweredLoads.add(key);
  }

  return Object.freeze({
    status: "ok" as const,
    reason: null,
    poweredConductors,
    componentOf,
    components: Object.freeze(components),
    loadStates,
    poweredLoads,
    stats: stats(),
  });
}
