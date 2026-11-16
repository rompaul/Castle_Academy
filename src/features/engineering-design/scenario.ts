/**
 * V0.7.1 P0 冻结场景参数（ADR-V071-1：动态生成，不写 seedWorld）。
 *
 * 世界边界 X/Z ∈ [-16,16)，地面顶面 y=0。河槽沿 Z 流动，桥沿 X 跨越。
 * 桥的右端固定落在 x=14（右岸搭接 1 格），左端随桥长向 -X 延伸：
 *   桥长 8 → x=7..14；桥长 9 → x=6..14；桥长 10 → x=5..14。
 * 这样 8–10 格的全部合法方案都落在世界边界内，且右岸搭接始终有效。
 */
import type { BridgeScenario } from "./types";

export const BRIDGE_SCENARIO: BridgeScenario = Object.freeze({
  scenarioId: "site.eastern-river-crossing",
  siteId: "scene.eastern-river-crossing",
  riverSpan: 6,
  rightLanding: 1,
  minDeckWidth: 3,
  deckLengthRange: Object.freeze([8, 10] as const),
  deckWidthRange: Object.freeze([3, 4] as const),
  materialBudget: 40,
  planksPerCell: 1,
  materialBlockId: "wood",
  deckY: 2,
  riverMinX: 8,
  riverMaxX: 13,
  riverMinZ: 3,
  riverMaxZ: 11,
  rightBankX: 14,
  deckZStart: 6,
  orientation: "x"
});

/** 河槽净宽（含端点），用于单测防止场景参数与文案脱节。 */
export function scenarioRiverWidth(scenario: BridgeScenario): number {
  return scenario.riverMaxX - scenario.riverMinX + 1;
}
