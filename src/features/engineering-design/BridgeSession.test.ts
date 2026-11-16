import { describe, expect, it } from "vitest";
import { BridgeSession } from "./BridgeSession";
import { BRIDGE_SCENARIO } from "./scenario";

describe("V0.7.1 bridge session", () => {
  it("keeps the river hidden until the mission starts", () => {
    const session = new BridgeSession(BRIDGE_SCENARIO, "bp");
    expect(session.getSnapshot().sceneActive).toBe(false);
    session.start();
    expect(session.getSnapshot().sceneActive).toBe(true);
    expect(session.getSnapshot().stage).toBe("briefing");
  });

  it("only generates a blueprint after a valid design", () => {
    const session = new BridgeSession(BRIDGE_SCENARIO, "bp");
    session.start();
    session.setMeasuredRiverSpan(6);
    expect(session.enterConstruction()).toBe(false);
    expect(session.getSnapshot().blueprint).toBeNull();

    session.setDeckLength(8);
    session.setDeckWidth(3);
    session.goStage("guided-design");
    session.goStage("design-validation");
    expect(session.enterConstruction()).toBe(true);
    expect(session.getSnapshot().blueprint?.requiredCells).toHaveLength(24);
    expect(session.getSnapshot().stage).toBe("construction");
  });

  it("refuses illegal stage jumps and clears blueprint on explicit return", () => {
    const session = new BridgeSession(BRIDGE_SCENARIO, "bp");
    session.start();
    expect(session.goStage("completed")).toBe(false);
    session.setMeasuredRiverSpan(6);
    session.goStage("guided-design");
    session.goStage("design-validation");
    expect(session.enterConstruction()).toBe(true);
    expect(session.returnToDesign()).toBe(true);
    expect(session.getSnapshot().blueprint).toBeNull();
    expect(session.getSnapshot().stage).toBe("guided-design");
  });
});
