import { describe, expect, it } from "vitest";
import { DESIGN_STAGE_ORDER, canTransition, isTerminalStage, transitionStage } from "./session";

describe("V0.7.1 bridge design stage machine", () => {
  it("follows the approved forward path", () => {
    expect(DESIGN_STAGE_ORDER).toHaveLength(7);
    let stage = DESIGN_STAGE_ORDER[0];
    for (const next of DESIGN_STAGE_ORDER.slice(1)) {
      expect(canTransition(stage, next)).toBe(true);
      stage = transitionStage(stage, next);
      expect(stage).toBe(next);
    }
    expect(isTerminalStage(stage)).toBe(true);
  });

  it("allows only the documented rollbacks", () => {
    expect(canTransition("site-survey", "briefing")).toBe(true);
    expect(canTransition("guided-design", "site-survey")).toBe(true);
    expect(canTransition("design-validation", "guided-design")).toBe(true);
    expect(canTransition("construction", "guided-design")).toBe(true);
    expect(canTransition("construction-validation", "construction")).toBe(true);
  });

  it("rejects illegal jumps and keeps the original state", () => {
    expect(canTransition("briefing", "construction")).toBe(false);
    expect(canTransition("guided-design", "completed")).toBe(false);
    expect(canTransition("completed", "construction")).toBe(false);
    expect(transitionStage("briefing", "construction")).toBe("briefing");
  });
});
