import type { MissionProgressEntry } from "../learner/types";

/**
 * V51-007 — CapabilityRegistry（V0.2 ARCHITECTURE_AND_SAFETY §4）。
 *
 * 未注册的能力 = 不可用；任务启动前检查 requiredCapabilities，
 * 缺失时任务显示「暂不可玩」（S8），不隐藏、不报错、不阻塞建造。
 */
export class CapabilityRegistry {
  private readonly checks = new Map<string, () => boolean>();

  register(id: string, available: () => boolean): void {
    this.checks.set(id, available);
  }

  isAvailable(id: string): boolean {
    const check = this.checks.get(id);
    if (!check) return false;
    try {
      return check();
    } catch {
      return false;
    }
  }

  /** 缺失能力列表（供 S8 展示原因）。 */
  missing(required: readonly string[]): string[] {
    return required.filter((id) => !this.isAvailable(id));
  }

  /** 测试钩子 / 未来能力上线时切换可用性。 */
  setAvailable(id: string, available: boolean): void {
    this.register(id, () => available);
  }

  unregister(id: string): void {
    this.checks.delete(id);
  }

  ids(): string[] {
    return [...this.checks.keys()];
  }
}

/** V0.51 已开放的 4 项能力；`pipe.diagnostics` 等未注册能力即"暂不可玩"素材。 */
export function createV051Capabilities(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.register("building.basic", () => true);
  registry.register("water.simulation", () => true);
  registry.register("layers.section", () => true);
  registry.register("measurement.distance", () => true);
  return registry;
}

/**
 * 任务进度存储抽象：V51-007 用内存实现，V51-008 换成学习者档案域适配器。
 * 运行时不关心底层是否 localStorage，也不接触 WorldSnapshot（ADR-0006）。
 */
export interface MissionProgressStore {
  get(missionId: string): MissionProgressEntry | null;
  set(missionId: string, entry: Partial<MissionProgressEntry>): void;
  /** 档案切换等外部状态替换时通知运行时重载（返回取消订阅函数） */
  onExternalChange?(handler: () => void): () => void;
}

export class InMemoryMissionProgressStore implements MissionProgressStore {
  private readonly entries = new Map<string, MissionProgressEntry>();

  get(missionId: string): MissionProgressEntry | null {
    const entry = this.entries.get(missionId);
    return entry ? { ...entry } : null;
  }

  set(missionId: string, patch: Partial<MissionProgressEntry>): void {
    const current = this.entries.get(missionId) ?? { status: "available" as const, hintsUsed: 0 };
    this.entries.set(missionId, { ...current, ...patch });
  }

  clear(): void {
    this.entries.clear();
  }
}
