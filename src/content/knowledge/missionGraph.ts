/**
 * V0.6 先决条件图纯函数（ADR-0009，任务 V06-009）。
 *
 * 纯函数：无副作用、无 I/O、不读运行时状态；输入任务定义数组，输出确定性结果。
 * 同一输入永远得到同一拓扑序（与数组插入顺序无关 —— 乱序输入置换不变）。
 * 检测：环、悬空引用（前置 ID 不存在）、自引用；检测到即报错，绝不放行（执行规则硬禁令）。
 */
import type { MissionDefinition } from "../missions/types";

export type MissionGraphError = {
  readonly kind: "cycle" | "dangling" | "self-reference";
  /** 触发错误的任务 ID；cycle 时为环上任一成员 */
  readonly missionId: string;
  /** 人类可读说明 */
  readonly detail: string;
};

export type MissionGraphResult = {
  /** 确定性拓扑序（前置在前）；有错误时为空数组 */
  readonly order: readonly string[];
  /** 全部检测到的错误；空数组 = 图合法 */
  readonly errors: readonly MissionGraphError[];
};

/** 确定性拓扑序（Kahn 算法 + 字典序就绪队列）；乱序输入置换不变 */
export function resolveMissionGraph(
  missions: readonly Pick<MissionDefinition, "id" | "prerequisiteMissionIds">[]
): MissionGraphResult {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const errors: MissionGraphError[] = [];

  // 悬空 / 自引用检测
  const effectivePrereqs = new Map<string, string[]>();
  for (const mission of missions) {
    const missing: string[] = [];
    for (const pre of mission.prerequisiteMissionIds) {
      if (pre === mission.id) {
        errors.push({
          kind: "self-reference",
          missionId: mission.id,
          detail: `任务 ${mission.id} 把自己列为前置`,
        });
      } else if (!byId.has(pre)) {
        missing.push(pre);
      }
    }
    if (missing.length > 0) {
      errors.push({
        kind: "dangling",
        missionId: mission.id,
        detail: `前置不存在: ${missing.sort().join(", ")}`,
      });
    }
    effectivePrereqs.set(
      mission.id,
      mission.prerequisiteMissionIds.filter(
        (pre) => pre !== mission.id && byId.has(pre)
      )
    );
  }
  if (errors.length > 0) return { order: [], errors };

  // Kahn：入度表 + 字典序就绪队列 → 确定性
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of byId.keys()) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const [id, pres] of effectivePrereqs) {
    for (const pre of pres) {
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      dependents.get(pre)!.push(id);
    }
  }

  const ready: string[] = [...indegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of dependents.get(id)!) {
      const d = indegree.get(next)! - 1;
      indegree.set(next, d);
      if (d === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  if (order.length !== byId.size) {
    const cyclic = [...byId.keys()]
      .filter((id) => !order.includes(id))
      .sort();
    for (const id of cyclic) {
      errors.push({
        kind: "cycle",
        missionId: id,
        detail: `任务 ${id} 处于先决条件环中`,
      });
    }
    return { order: [], errors };
  }

  return { order, errors: [] };
}

/** 便捷查询：任务的前置是否全部完成（V06-011 状态机消费；纯函数、可重放） */
export function isMissionUnlocked(
  missionId: string,
  completedMissionIds: ReadonlySet<string>,
  missions: readonly Pick<MissionDefinition, "id" | "prerequisiteMissionIds">[]
): boolean {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) return false;
  return mission.prerequisiteMissionIds.every((pre) =>
    completedMissionIds.has(pre)
  );
}
