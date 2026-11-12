import type { EventBus } from "../../core/events/EventBus";
import type { LearnerProfilePlugin } from "../learner/LearnerProfilePlugin";
import {
  LEARNER_EVENTS,
  type MasteryEvidenceRecord,
  type MissionProgressEntry
} from "../learner/types";
import type { MissionProgressStore } from "./CapabilityRegistry";

/**
 * V51-008 — 任务进度 → 学习者档案域适配器（ADR-0006 + ADR-0007）。
 *
 * MissionRuntime 只认 MissionProgressStore 接口，不认识 localStorage；
 * 本适配器把进度写进当前档案的 `missionProgress`，随档案切换而切换。
 * 世界存档（WorldSnapshot）零耦合、零字段泄漏（AC-211 / 验收计划 §5）。
 */
export class LearnerProfileProgressStore implements MissionProgressStore {
  constructor(
    private readonly profile: LearnerProfilePlugin,
    private readonly events: EventBus
  ) {}

  get(missionId: string): MissionProgressEntry | null {
    return this.profile.getMissionProgress(missionId);
  }

  set(missionId: string, patch: Partial<MissionProgressEntry>): void {
    this.profile.updateMissionProgress(missionId, patch);
  }

  /** V0.6（ADR-0010 / V06-013）：完成时按知识点落掌握证据到当前档案。 */
  recordMasteryEvidence(records: readonly MasteryEvidenceRecord[]): void {
    this.profile.recordMasteryEvidence(records);
  }

  onExternalChange(handler: () => void): () => void {
    // 新建档案会直接切换 activeProfile，等同一次档案切换；损坏重置同理。
    const names = [LEARNER_EVENTS.created, LEARNER_EVENTS.switched, LEARNER_EVENTS.recovered];
    const unsubs = names.map((name) => this.events.on(name, () => handler()));
    return () => unsubs.forEach((unsub) => unsub());
  }
}
