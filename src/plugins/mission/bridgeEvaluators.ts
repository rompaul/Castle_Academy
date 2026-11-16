/**
 * V0.7.1 — 桥梁施工确定性评估器（纯函数）。
 *
 * 只读 EvaluatorQuery.bridgeEvidence，不碰 UI / Three.js / WorldState。
 * 未注入证据时降级为 0 进度，既有 24 个评估器零影响。
 */
import { isConstructionComplete } from "../../features/engineering-design/design";
import type { ConstructionEvidence } from "../../features/engineering-design/types";
import { V071_EVALUATOR_ID, V071_MISSION_ID } from "../../content/missions/v071MissionContracts";
import type { EvaluatorQuery, EvaluatorRegistry, MissionEvaluator } from "./evaluators";

function emptyEvidence(): ConstructionEvidence {
  return {
    blueprintId: "",
    placedRequiredCells: 0,
    totalRequiredCells: 0,
    missingCells: [],
    invalidMaterialCells: []
  };
}

function readEvidence(query: EvaluatorQuery): ConstructionEvidence {
  return query.bridgeEvidence ?? emptyEvidence();
}

export function registerBridgeEvaluators(registry: EvaluatorRegistry): void {
  const evaluator: MissionEvaluator = {
    id: V071_EVALUATOR_ID,
    legacyQuestId: V071_MISSION_ID,
    evaluate: (query) => {
      const evidence = readEvidence(query);
      const done = evidence.placedRequiredCells;
      const total = evidence.totalRequiredCells;
      return {
        progress: total > 0 ? done / total : 0,
        complete: isConstructionComplete(evidence),
        evidence: { observation: `${done}/${total}` }
      };
    },
    describe: (query) => {
      const evidence = readEvidence(query);
      return {
        done: evidence.placedRequiredCells,
        total: evidence.totalRequiredCells
      };
    }
  };
  registry.register(evaluator);
}
