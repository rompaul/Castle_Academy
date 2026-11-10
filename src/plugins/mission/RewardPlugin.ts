import type { EventBus } from "../../core/events/EventBus";
import type { MissionReward } from "../../content/missions/types";
import { MISSION_EVENTS, type MissionRewardGrantedPayload } from "./events";

/**
 * V51-007 — RewardPlugin（幂等奖励，AC-214）。
 *
 * 本版奖励只有装饰性称号，不解锁/锁死任何建造资源（PD-003）。
 * 每个 missionId 在一个档案会话内只授予一次；档案切换时用 restore() 恢复已授予集合，
 * 避免刷新或切换档案后重复弹奖励。
 */
export class RewardPlugin {
  private readonly granted = new Set<string>();

  constructor(private readonly events: EventBus) {}

  grant(missionId: string, reward: MissionReward | undefined): boolean {
    if (!reward || this.granted.has(missionId)) return false;
    this.granted.add(missionId);
    this.events.emit<MissionRewardGrantedPayload>(MISSION_EVENTS.rewardGranted, { missionId, reward });
    return true;
  }

  has(missionId: string): boolean {
    return this.granted.has(missionId);
  }

  /** 档案切换 / 从持久化恢复：把已完成任务的奖励标记为已授予（不再弹窗）。 */
  restore(missionIds: readonly string[]): void {
    this.granted.clear();
    for (const id of missionIds) this.granted.add(id);
  }

  reset(): void {
    this.granted.clear();
  }
}
