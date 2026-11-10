import type { MissionSummary } from "../../content/missions/types";
import type { MissionReward } from "../../content/missions/types";

/** V0.51 新增 mission.* 事件（契约 §3，全部经 EventBus DomainEvent 信封发射）。 */
export const MISSION_EVENTS = {
  offered: "mission.offered",
  activated: "mission.activated",
  progressUpdated: "mission.progress.updated",
  completed: "mission.completed",
  rewardGranted: "mission.reward.granted"
} as const;

export interface MissionOfferedPayload {
  missions: MissionSummary[];
}

export interface MissionActivatedPayload {
  missionId: string;
}

export interface MissionProgressUpdatedPayload {
  missionId: string;
  progress: number;
  complete: boolean;
}

export interface MissionCompletedPayload {
  missionId: string;
  successMessage: string;
  reward?: MissionReward;
}

export interface MissionRewardGrantedPayload {
  missionId: string;
  reward: MissionReward;
}
