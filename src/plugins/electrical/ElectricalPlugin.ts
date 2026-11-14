/**
 * V061-009/010/011/014 — ElectricalPlugin（ADR-0011，架构契约 §2/§5/§6）。
 *
 * 所有权：通电网络 / 负载状态 / 泵输出的唯一 owner。
 * - 只订阅 `world.block.placed` / `world.block.removed` / `world.blueprint.placed`；
 *   无关方块变更直接忽略（AC-6708），绝不订阅 `water.*`（事件环硬约束）。
 * - 同 tick 变更合并为一次重算（microtask），有界、可重入保护、无每帧扫描、无定时器。
 * - 重算完成后才发布不可变查询与 `electric.*` 事件；`WaterPlugin` 通过窄端口读取。
 * - 通电态 / 连通分量 / pumpActive 全部从 `WorldState` 每次重建，不写回、不序列化。
 *
 * 不 import WaterPlugin / Three.js / React / DOM；不新建第二套 EventBus 或持久化。
 */

import {
  computeElectricalNetwork,
  ELECTRICAL_BLOCK_ROLES,
  type ElectricalLoadState,
  type ElectricalNetworkResult,
} from "../../core/electrical";
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import type { BlockId } from "../../core/world/blocks";
import type { WorldState } from "../../core/world/WorldState";
import type { EventBus } from "../../core/events/EventBus";
import {
  ELECTRICAL_EVENT_VERSION,
  ELECTRICAL_EVENTS,
  type ElectricalNetworkChangedPayload,
  type ElectricalPumpStateChangedPayload,
  type ElectricalLoadStateChangedPayload,
} from "./events";
import type { ElectricalQuery, ElectricalLoadSnapshot, SwitchObservation } from "./query";
import { DEFAULT_ELECTRICAL_SIM_LIMITS, type ElectricalSimLimits } from "../../core/electrical";

/** 单次任务内允许的连续合并重算上限（防病态事件环，AC-6710 / AC-6730）。 */
export const MAX_MERGED_RECOMPUTES = 16;

/** DEV-615：运行时观察日志上限（每位置每态一条；超限淘汰最旧，绝不落盘）。 */
export const MAX_SWITCH_OBSERVATIONS = 128;

const EMPTY_RESULT: ElectricalNetworkResult = Object.freeze({
  status: "invalid-input" as const,
  reason: "not-computed",
  poweredConductors: new Set<string>(),
  componentOf: new Map<string, number>(),
  components: Object.freeze([]),
  loadStates: new Map<string, ElectricalLoadState>(),
  poweredLoads: new Set<string>(),
  stats: { cellCount: 0, edgeCount: 0, operationCount: 0 },
});

function parseKey(key: string): GridPosition {
  const [x, y, z] = key.split(",").map(Number) as [number, number, number];
  return { x, y, z };
}

export interface ElectricalPluginOptions {
  limits?: ElectricalSimLimits;
  /** 测试可注入同步合并策略；生产走 queueMicrotask。 */
  schedule?: (task: () => void) => void;
}

export class ElectricalPlugin {
  private readonly world: WorldState;
  private readonly events: EventBus;
  private readonly limits: ElectricalSimLimits;
  private readonly schedule: (task: () => void) => void;
  private readonly unsubscribe: Array<() => void> = [];

  private active = false;
  private dirty = false;
  private scheduled = false;
  private recomputing = false;
  private mergedRecomputes = 0;
  private sequence = 0;
  private result: ElectricalNetworkResult = EMPTY_RESULT;

  /** 上一次发布的负载 / 泵状态，用于事件 diff（不参与判定）。 */
  private lastLoadStates = new Map<string, ElectricalLoadState>();
  private lastPumpActive = new Set<string>();
  /** 上次重算中出现的电力格，用于判断 removed 是否相关。 */
  private lastRelevantKeys = new Set<string>();

  /**
   * DEV-615：「同一个开关按一下开、再按一下关」的成对观察。
   * key = `${positionKey}:${state}`，同一位置同一态只保留最新一次重算的观察。
   * 纯运行时派生：不写 WorldSnapshot、不进任何持久化存储、不随读档保留。
   */
  private readonly switchObservations = new Map<string, SwitchObservation>();
  private lastSwitchStates = new Map<string, "open" | "closed">();
  private lastLampPowered = false;

  constructor(world: WorldState, events: EventBus, options: ElectricalPluginOptions = {}) {
    this.world = world;
    this.events = events;
    this.limits = options.limits ?? DEFAULT_ELECTRICAL_SIM_LIMITS;
    this.schedule = options.schedule ?? ((task) => queueMicrotask(task));
  }

  /** 生命周期（V061-009）：注册 / 释放成对，重复 activate 不重复监听。 */
  activate(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe.push(
      this.events.on<{ position: GridPosition; blockId: BlockId }>("world.block.placed", (event) => {
        if (ELECTRICAL_BLOCK_ROLES[event.payload.blockId] !== undefined) this.markDirty("block-change");
      }),
      this.events.on<{ position: GridPosition }>("world.block.removed", (event) => {
        if (this.lastRelevantKeys.has(positionKey(event.payload.position))) this.markDirty("block-change");
      }),
      this.events.on("world.blueprint.placed", () => this.markDirty("merged-batch"))
    );
    this.recompute("activate");
  }

  dispose(): void {
    this.active = false;
    this.dirty = false;
    while (this.unsubscribe.length > 0) this.unsubscribe.pop()?.();
    this.lastLoadStates.clear();
    this.lastPumpActive.clear();
    this.lastRelevantKeys.clear();
    this.switchObservations.clear();
    this.lastSwitchStates.clear();
    this.lastLampPowered = false;
    this.result = EMPTY_RESULT;
  }

  /** 世界被整体替换（读档 / 重置 / 蓝图）后立即同步重算；观察历史不跨世界保留。 */
  refresh(): void {
    this.mergedRecomputes = 0;
    this.dirty = false;
    this.switchObservations.clear();
    this.lastSwitchStates.clear();
    this.lastLampPowered = false;
    this.recompute("refresh");
  }

  get isActive(): boolean {
    return this.active;
  }

  getRecomputeCount(): number {
    return this.sequence;
  }

  /** 只读查询（V061-010）：每次调用返回新对象，内部状态不可写回。 */
  getQuery(): ElectricalQuery {
    const world = this.world;
    const self = this;
    return {
      isPowered: (position) => self.result.poweredLoads.has(positionKey(position)),
      getLoadState: (position) => self.result.loadStates.get(positionKey(position)) ?? null,
      isConductorPowered: (position) => self.result.poweredConductors.has(positionKey(position)),
      isPumpOutputActive: (position) =>
        world.get(position)?.blockId === "water_pump_basic" &&
        self.result.poweredLoads.has(positionKey(position)),
      getPoweredConductors: () =>
        Object.freeze([...self.result.poweredConductors].sort().map((key) => Object.freeze(parseKey(key)))),
      getLoadStates: () =>
        Object.freeze(
          [...self.result.loadStates.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, state]): ElectricalLoadSnapshot =>
              Object.freeze({ position: Object.freeze(parseKey(key)), state })
            )
        ),
      getStatus: () => self.result.status,
      getStats: () => Object.freeze({ ...self.result.stats }),
      getSwitchObservations: () => self.getSwitchObservations(),
      getRecomputeCount: () => self.sequence,
    };
  }

  /** 只读观察快照：按 (sequence, 位置, 状态) 确定性排序，逐条冻结。 */
  private getSwitchObservations(): readonly SwitchObservation[] {
    return Object.freeze(
      [...this.switchObservations.values()]
        .sort((a, b) =>
          a.sequence - b.sequence
          || positionKey(a.position).localeCompare(positionKey(b.position))
          || a.state.localeCompare(b.state))
        .map((observation) => Object.freeze({
          position: Object.freeze({ ...observation.position }),
          state: observation.state,
          lampPowered: observation.lampPowered,
          sequence: observation.sequence,
        }))
    );
  }

  /* ---------- 内部：合并 / 有界重算 / 事件 diff（V061-011） ---------- */

  private markDirty(cause: "block-change" | "merged-batch"): void {
    if (!this.active) return;
    this.dirty = true;
    if (this.scheduled) return;
    this.scheduled = true;
    this.schedule(() => this.flush(cause));
  }

  private flush(cause: "block-change" | "merged-batch"): void {
    this.scheduled = false;
    if (!this.active || !this.dirty || this.recomputing) return;
    this.mergedRecomputes++;
    if (this.mergedRecomputes > MAX_MERGED_RECOMPUTES) {
      // 病态环保护：停止本轮合并，保留上次结果并显式记录，绝不静默重试。
      this.dirty = false;
      console.warn("[ElectricalPlugin] merged recompute budget exceeded; keeping last result");
      return;
    }
    this.dirty = false;
    this.recompute(cause);
    // 事件回调中若产生新的相关方块变更，markDirty 会重新调度（合法的新一轮）。
    if (this.dirty) this.markDirty(cause);
    else this.mergedRecomputes = 0;
  }

  private recompute(cause: ElectricalNetworkChangedPayload["cause"]): void {
    if (this.recomputing) return; // 重入保护
    this.recomputing = true;
    try {
      const cells = this.world.all().map((record) => ({
        position: record.position,
        blockId: record.blockId as string,
      }));
      this.result = computeElectricalNetwork({ cells }, this.limits);
      this.lastRelevantKeys = new Set(
        cells.filter((cell) => ELECTRICAL_BLOCK_ROLES[cell.blockId] !== undefined)
          .map((cell) => positionKey(cell.position))
      );
      this.sequence++;
      this.recordSwitchObservations(cells);
      this.publish(cause);
    } finally {
      this.recomputing = false;
    }
  }

  /**
   * DEV-615：把「同一个开关按一下开、再按一下关」登记为成对观察。
   *
   * 两态在存储层是两个 blockId（`WorldSnapshot v1` 无状态字段），但切换走
   * remove + place，两个事件常合并成一次重算；因此除记录当前态外，还把
   * **变化前的旧态**连同旧重算的灯态补记一次，保证「按一下」必然产出两态。
   * 同一位置同一态只保留最新一次（当前态覆盖旧态，灯后来补上时自动更正）。
   */
  private recordSwitchObservations(
    cells: ReadonlyArray<{ position: GridPosition; blockId: string }>
  ): void {
    const current = new Map<string, "open" | "closed">();
    for (const cell of cells) {
      if (cell.blockId === "switch_open" || cell.blockId === "switch_closed") {
        current.set(positionKey(cell.position), cell.blockId === "switch_open" ? "open" : "closed");
      }
    }
    const lampPowered = this.result.status === "ok" && cells.some(
      (cell) => cell.blockId === "lamp_basic" && this.result.poweredLoads.has(positionKey(cell.position))
    );

    // 安全降级（超限 / 畸形输入）时不新增任何观察证据，绝不靠未知状态给进度。
    if (this.result.status === "ok") {
      const put = (key: string, state: "open" | "closed", powered: boolean): void => {
        this.switchObservations.set(`${key}:${state}`, Object.freeze({
          position: Object.freeze(parseKey(key)),
          state,
          lampPowered: powered,
          sequence: this.sequence,
        }));
      };
      for (const [key, state] of current) put(key, state, lampPowered);
      for (const [key, state] of this.lastSwitchStates) {
        if (current.get(key) !== state) put(key, state, this.lastLampPowered);
      }
      while (this.switchObservations.size > MAX_SWITCH_OBSERVATIONS) {
        let oldestKey: string | null = null;
        let oldestSequence = Number.POSITIVE_INFINITY;
        for (const [key, observation] of this.switchObservations) {
          if (observation.sequence < oldestSequence) {
            oldestSequence = observation.sequence;
            oldestKey = key;
          }
        }
        if (oldestKey === null) break;
        this.switchObservations.delete(oldestKey);
      }
    }

    this.lastSwitchStates = current;
    this.lastLampPowered = lampPowered;
  }

  private publish(cause: ElectricalNetworkChangedPayload["cause"]): void {
    const result = this.result;
    const poweredConductorKeys = Object.freeze([...result.poweredConductors].sort());
    const loadStates: ElectricalLoadSnapshot[] = [...result.loadStates.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, state]) => Object.freeze({ position: Object.freeze(parseKey(key)), state }));
    const pumpActiveKeys = Object.freeze(
      loadStates
        .filter(({ position, state }) =>
          state === "powered" && this.world.get(position)?.blockId === "water_pump_basic")
        .map(({ position }) => positionKey(position))
        .sort()
    );

    const network: ElectricalNetworkChangedPayload = Object.freeze({
      status: result.status,
      reason: result.reason,
      poweredConductorKeys,
      pumpActiveKeys,
      loadStates: Object.freeze(loadStates),
      stats: Object.freeze({ ...result.stats }),
      sequence: this.sequence,
      cause,
    });
    this.events.emit(ELECTRICAL_EVENTS.networkChanged, network, ELECTRICAL_EVENT_VERSION);

    type LoadChange = ElectricalLoadStateChangedPayload["changed"][number];
    const loadChanges: LoadChange[] = [];
    const nextLoadStates = new Map(result.loadStates);
    for (const [key, state] of nextLoadStates) {
      const previous = this.lastLoadStates.get(key) ?? null;
      if (previous !== state) {
        loadChanges.push(Object.freeze({ position: Object.freeze(parseKey(key)), state, previous }));
      }
    }
    for (const [key, previous] of this.lastLoadStates) {
      if (!nextLoadStates.has(key)) {
        loadChanges.push(Object.freeze({ position: Object.freeze(parseKey(key)), state: "unknown" as const, previous }));
      }
    }
    if (loadChanges.length > 0) {
      this.events.emit(
        ELECTRICAL_EVENTS.loadStateChanged,
        Object.freeze({ changed: Object.freeze(loadChanges), sequence: this.sequence }) as ElectricalLoadStateChangedPayload,
        ELECTRICAL_EVENT_VERSION
      );
    }

    const nextPumpActive = new Set(pumpActiveKeys);
    type PumpChange = ElectricalPumpStateChangedPayload["changed"][number];
    const pumpChanges: PumpChange[] = [];
    for (const key of nextPumpActive) {
      if (!this.lastPumpActive.has(key)) {
        pumpChanges.push(Object.freeze({ position: Object.freeze(parseKey(key)), active: true }));
      }
    }
    for (const key of this.lastPumpActive) {
      if (!nextPumpActive.has(key)) {
        pumpChanges.push(Object.freeze({ position: Object.freeze(parseKey(key)), active: false }));
      }
    }
    if (pumpChanges.length > 0) {
      this.events.emit(
        ELECTRICAL_EVENTS.pumpStateChanged,
        Object.freeze({ changed: Object.freeze(pumpChanges), sequence: this.sequence }) as ElectricalPumpStateChangedPayload,
        ELECTRICAL_EVENT_VERSION
      );
    }

    this.lastLoadStates = nextLoadStates;
    this.lastPumpActive = nextPumpActive;
  }
}
