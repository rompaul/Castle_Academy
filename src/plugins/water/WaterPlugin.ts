import type { GridPosition } from "../../core/world/coordinates";
import { positionKey } from "../../core/world/coordinates";
import type { BlockId } from "../../core/world/blocks";
import type { WorldState } from "../../core/world/WorldState";
import type { EventBus } from "../../core/events/EventBus";
import {
  computeWater,
  DEFAULT_WATER_SIM_CONFIG,
  type WaterSimConfig,
  type WaterSimResult,
} from "./WaterSim";

/**
 * V05-007 — WaterPlugin：水域模拟插件（ADR-0005）。
 *
 * 职责：
 * - 订阅 world.block.placed / world.block.removed，标记脏状态并全量重算水域目标。
 * - 以固定 tick 周期把目标状态分批应用到"已应用集合"（每 tick ≤ maxCellsPerTick），
 *   发射 water.flow.updated / water.simulation.tick / water.pipe.state.changed。
 * - 提供只读查询接口 WaterQuery（渲染/UI/学习任务消费）。
 *
 * 架构红线（CA-TECH-001/003）：
 * - 水格是本插件拥有的派生模拟状态，绝不写入 WorldState / WorldSnapshot。
 * - 不依赖 Three.js / React / DOM。
 */

/** 水域变化事件 payload（water.flow.updated） */
export interface WaterFlowUpdatedPayload {
  added: GridPosition[];
  removed: GridPosition[];
  reason: "source-changed" | "recalculate" | "tick";
}

/** 管道通水状态变化事件 payload（water.pipe.state.changed） */
export interface PipeStateChangedPayload {
  changed: Array<{ position: GridPosition; flowing: boolean }>;
}

/** 只读查询接口 */
export interface WaterQuery {
  hasWater(position: GridPosition): boolean;
  getWaterCells(): GridPosition[];
  isPipeFlowing(position: GridPosition): boolean;
  /** 模拟是否已收敛（无待应用更新） */
  isConverged(): boolean;
}

export class WaterPlugin {
  readonly config: WaterSimConfig;
  private readonly world: WorldState;
  private readonly events: EventBus;

  /** 已应用到渲染的水格（权威应用状态；目标是 WaterSim 的重算结果） */
  private applied = new Map<string, GridPosition>();
  /** 已应用的通水管道 */
  private appliedPipes = new Set<string>();
  /** 重算目标（脏标记后立即重算；应用按 tick 分批） */
  private target: WaterSimResult | null = null;
  /** 待应用的新增水格（BFS 距离序，target 中的键序） */
  private pendingAdded: Array<{ key: string; position: GridPosition }> = [];
  private pendingRemoved: string[] = [];
  private pendingPipeChanges: Array<{ position: GridPosition; flowing: boolean }> = [];

  private dirty = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(world: WorldState, events: EventBus, config?: Partial<WaterSimConfig>) {
    this.world = world;
    this.events = events;
    this.config = { ...DEFAULT_WATER_SIM_CONFIG, ...config };
  }

  /** 生命周期：activate（CA-TECH-001） */
  activate(): void {
    if (this.active) return;
    this.active = true;
    this.unsubscribe.push(
      this.events.on<{ position: GridPosition; blockId: BlockId }>("world.block.placed", () => {
        this.markDirty();
      }),
      this.events.on<{ position: GridPosition }>("world.block.removed", () => {
        this.markDirty();
      })
    );
    this.timer = setInterval(() => this.tick(), this.config.tickIntervalMs);
    this.refresh(); // 激活时重算并立即收敛（种子世界的预置水域首帧可见）
  }

  dispose(): void {
    this.active = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    while (this.unsubscribe.length > 0) {
      this.unsubscribe.pop()?.();
    }
  }

  /** 世界被整体替换（存档加载/重置）后调用：强制重算并立即收敛 */
  refresh(): void {
    this.markDirty();
    this.tick();
  }

  getQuery(): WaterQuery {
    return {
      hasWater: (position) => this.applied.has(positionKey(position)),
      getWaterCells: () => [...this.applied.values()],
      isPipeFlowing: (position) => this.appliedPipes.has(positionKey(position)),
      isConverged: () => this.pendingAdded.length === 0 && this.pendingRemoved.length === 0 && !this.dirty,
    };
  }

  /* ---------- 内部 ---------- */

  private markDirty(): void {
    this.dirty = true;
    this.recalculate();
  }

  /** 全量重算目标状态，并 diff 出待应用增量（确定性：键序排序） */
  private recalculate(): void {
    const sources = this.world
      .all()
      .filter((record) => record.blockId === "water_source")
      .map((record) => record.position);

    this.target = computeWater(
      {
        world: {
          hasBlock: (position) => this.world.has(position),
          blockAt: (position) => this.world.get(position)?.blockId,
        },
        sources,
        minY: -32, // WORLD_BOUNDS.minY；避免从坐标模块引入渲染无关耦合
      },
      this.config
    );

    const targetKeys = new Set(this.target.water.keys());
    this.pendingRemoved = [...this.applied.keys()].filter((key) => !targetKeys.has(key)).sort();
    this.pendingAdded = [...this.target.water.entries()]
      .filter(([key]) => !this.applied.has(key))
      .map(([key, position]) => ({ key, position }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // 管道状态 diff
    const targetPipes = this.target.flowingPipes;
    this.pendingPipeChanges = [];
    for (const key of targetPipes) {
      if (!this.appliedPipes.has(key)) {
        this.pendingPipeChanges.push({ position: this.target.water.get(key) ?? parsePipeKey(key), flowing: true });
      }
    }
    for (const key of this.appliedPipes) {
      if (!targetPipes.has(key)) {
        this.pendingPipeChanges.push({ position: parsePipeKey(key), flowing: false });
      }
    }
  }

  /** 固定 tick：分批应用增量并发射事件 */
  private tick(): void {
    if (!this.active || !this.target) return;
    if (this.pendingAdded.length === 0 && this.pendingRemoved.length === 0) {
      if (this.dirty) {
        this.dirty = false;
        this.events.emit("water.simulation.tick", { activeCells: this.applied.size, pendingOps: 0 });
      }
      return;
    }

    const added: GridPosition[] = [];
    const removed: GridPosition[] = [];

    // 退水立即应用（数量通常远小于新增）
    for (const key of this.pendingRemoved.splice(0)) {
      const position = this.applied.get(key);
      if (position) {
        this.applied.delete(key);
        removed.push(position);
      }
    }

    // 新增水格按上限分批
    const batch = this.pendingAdded.splice(0, this.config.maxCellsPerTick);
    for (const item of batch) {
      this.applied.set(item.key, item.position);
      added.push(item.position);
    }

    // 收敛标记必须在发射事件之前更新：事件监听者（任务判定等）在回调里
    // 同步查询 isConverged()，若发射后才清 dirty 会导致它们永远看到"未收敛"。
    if (this.pendingAdded.length === 0 && this.pendingRemoved.length === 0) {
      this.dirty = false;
    }

    if (added.length > 0 || removed.length > 0) {
      this.events.emit("water.flow.updated", {
        added,
        removed,
        reason: "source-changed",
      });
    }

    if (this.pendingPipeChanges.length > 0) {
      const changed = this.pendingPipeChanges.splice(0);
      for (const item of changed) {
        if (item.flowing) this.appliedPipes.add(positionKey(item.position));
        else this.appliedPipes.delete(positionKey(item.position));
      }
      this.events.emit("water.pipe.state.changed", { changed });
    }

    this.events.emit("water.simulation.tick", {
      activeCells: this.applied.size,
      pendingOps: this.pendingAdded.length + this.pendingRemoved.length,
    });
  }
}

function parsePipeKey(key: string): GridPosition {
  const [x, y, z] = key.split(",").map(Number) as [number, number, number];
  return { x, y, z };
}
