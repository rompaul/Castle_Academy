import { describe, expect, it } from "vitest";
import type { BlockId } from "../../core/world/blocks";
import type { BridgeBlueprint, BridgeDesignInput, BridgeScenario } from "./types";
import { BRIDGE_SCENARIO, scenarioRiverWidth } from "./scenario";
import {
  computeBridgeDesign,
  coversBothBanks,
  createBridgeBlueprint,
  createConstructionEvidence,
  isBlueprintContinuous,
  isConstructionComplete,
  validateBridgeDesign
} from "./design";

function input(overrides: Partial<BridgeDesignInput> = {}): BridgeDesignInput {
  return {
    scenarioId: BRIDGE_SCENARIO.scenarioId,
    measuredRiverSpan: 6,
    deckLength: 8,
    deckWidth: 3,
    materialBlockId: "wood",
    ...overrides
  };
}

function codesFor(scenario: BridgeScenario, value: BridgeDesignInput): string[] {
  return validateBridgeDesign(scenario, value).issues.map((item) => item.code);
}

describe("V0.7.1 bridge design pure functions", () => {
  it("freezes 6-cell river span and 8x3 baseline computation", () => {
    expect(scenarioRiverWidth(BRIDGE_SCENARIO)).toBe(6);
    const computed = computeBridgeDesign(BRIDGE_SCENARIO, input());
    expect(computed.requiredDeckLength).toBe(8);
    expect(computed.leftLanding).toBe(1);
    expect(computed.rightLanding).toBe(1);
    expect(computed.deckArea).toBe(24);
    expect(computed.requiredPlanks).toBe(24);
    expect(computed.remainingPlanks).toBe(16);
  });

  it("accepts all legal 8~10 x 3~4 options including exact 40-plank budget", () => {
    for (const deckLength of [8, 9, 10]) {
      for (const deckWidth of [3, 4]) {
        expect(validateBridgeDesign(BRIDGE_SCENARIO, input({ deckLength, deckWidth })).passed).toBe(true);
      }
    }
    expect(computeBridgeDesign(BRIDGE_SCENARIO, input({ deckLength: 10, deckWidth: 4 })).remainingPlanks).toBe(0);
  });

  it("BR-01 rejects zero, negative, NaN and non-integer measurement", () => {
    for (const measuredRiverSpan of [0, -6, Number.NaN, 6.5]) {
      expect(codesFor(BRIDGE_SCENARIO, input({ measuredRiverSpan }))).toContain("BR-01");
    }
  });

  it("BR-02 / BR-03 / BR-04 / BR-05 catch length and width failures", () => {
    expect(codesFor(BRIDGE_SCENARIO, input({ deckLength: 7 }))).toContain("BR-02");
    expect(codesFor(BRIDGE_SCENARIO, input({ deckWidth: 2 }))).toContain("BR-03");
    expect(codesFor(BRIDGE_SCENARIO, input({ deckLength: 11 }))).toContain("BR-04");
    expect(codesFor(BRIDGE_SCENARIO, input({ deckLength: 8.5 }))).toContain("BR-04");
    expect(codesFor(BRIDGE_SCENARIO, input({ deckWidth: 5 }))).toContain("BR-05");
    expect(codesFor(BRIDGE_SCENARIO, input({ deckWidth: 3.5 }))).toContain("BR-05");
  });

  it("BR-06 fails when material budget is exceeded", () => {
    const tight: BridgeScenario = { ...BRIDGE_SCENARIO, planksPerCell: 2 };
    expect(codesFor(tight, input())).toContain("BR-06");
  });

  it("BR-07 detects a broken blueprint grid", () => {
    const full = createBridgeBlueprint(BRIDGE_SCENARIO, input(), "bp");
    expect(isBlueprintContinuous(full)).toBe(true);
    const broken: BridgeBlueprint = { ...full, requiredCells: full.requiredCells.slice(1) };
    expect(isBlueprintContinuous(broken)).toBe(false);
  });

  it("BR-08 requires both landings and keeps the right end at x=14", () => {
    expect(codesFor(BRIDGE_SCENARIO, input({ deckLength: 7 }))).toContain("BR-08");
    for (const deckLength of [8, 9, 10]) {
      const bp = createBridgeBlueprint(BRIDGE_SCENARIO, input({ deckLength }), "bp");
      expect(bp.origin.x + bp.deckLength - 1).toBe(BRIDGE_SCENARIO.rightBankX);
      expect(coversBothBanks(BRIDGE_SCENARIO, bp)).toBe(true);
    }
  });

  it("maps blueprint cells to world positions without UI coordinate concatenation", () => {
    const bp = createBridgeBlueprint(BRIDGE_SCENARIO, input(), "bp");
    expect(bp.origin).toEqual({ x: 7, y: 2, z: 6 });
    expect(bp.requiredCells).toHaveLength(24);
  });

  it("builds deterministic construction evidence for complete, missing and wrong-material cells", () => {
    const bp = createBridgeBlueprint(BRIDGE_SCENARIO, input(), "bp");
    const blockAt = (): BlockId | undefined => "wood";
    const done = createConstructionEvidence(bp, blockAt);
    expect(done.totalRequiredCells).toBe(24);
    expect(done.placedRequiredCells).toBe(24);
    expect(isConstructionComplete(done)).toBe(true);

    const missing = createConstructionEvidence(bp, (position) =>
      position.x === bp.origin.x ? undefined : "wood"
    );
    expect(missing.missingCells).toHaveLength(3);
    expect(isConstructionComplete(missing)).toBe(false);

    const wrong = createConstructionEvidence(bp, (position) =>
      position.z === bp.origin.z ? "stone" : "wood"
    );
    expect(wrong.invalidMaterialCells).toHaveLength(8);
    expect(isConstructionComplete(wrong)).toBe(false);
  });
});
