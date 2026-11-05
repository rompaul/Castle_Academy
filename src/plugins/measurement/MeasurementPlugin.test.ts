import { describe, expect, it } from "vitest";
import { MeasurementPlugin } from "./MeasurementPlugin";
import type { GridPosition } from "../../core/world/coordinates";

function pos(x: number, y: number, z: number): GridPosition {
  return { x, y, z };
}

describe("MeasurementPlugin", () => {
  it("declares plugin contract fields", () => {
    const plugin = new MeasurementPlugin();
    expect(plugin.id).toBe("measurement");
    expect(plugin.name).toBe("Measurement");
    expect(plugin.version).toBe("0.3.0");
  });

  it("measurements are pure and always available (no activation required)", () => {
    const plugin = new MeasurementPlugin();
    const r = plugin.measureDistance(pos(0, 0, 0), pos(3, 0, 0));
    expect(r.value).toBe(3);
    expect(plugin.getChallenge()).toBeUndefined();
  });

  it("measures Euclidean distance", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    const r = plugin.measureDistance(pos(0, 0, 0), pos(3, 0, 0));
    expect(r.type).toBe("distance");
    expect(r.value).toBe(3);
    expect(r.unit).toBe("blocks");

    const r2 = plugin.measureDistance(pos(0, 0, 0), pos(0, 0, 0));
    expect(r2.value).toBe(0);

    const r3 = plugin.measureDistance(pos(1, 2, 3), pos(4, 6, 8));
    // dx=3, dy=4, dz=5 => sqrt(9+16+25)=sqrt(50)≈7.071
    expect(r3.value).toBeCloseTo(Math.sqrt(50), 6);
  });

  it("measures area on XZ plane", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    const r = plugin.measureArea(pos(0, 0, 0), pos(2, 0, 3));
    expect(r.type).toBe("area");
    // width=3, depth=4 => 12
    expect(r.value).toBe(12);
    expect(r.unit).toBe("square blocks");

    const r2 = plugin.measureArea(pos(2, 0, 3), pos(0, 0, 0));
    expect(r2.value).toBe(12);
  });

  it("measures volume of a box", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    const r = plugin.measureVolume(pos(0, 0, 0), pos(1, 2, 3));
    // width=2, height=3, depth=4 => 24
    expect(r.type).toBe("volume");
    expect(r.value).toBe(24);
    expect(r.unit).toBe("cubic blocks");

    const r2 = plugin.measureVolume(pos(0, 0, 0), pos(0, 0, 0));
    expect(r2.value).toBe(1);
  });

  it("checkChallenge passes when within tolerance", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    plugin.setChallenge({ type: "distance", target: 5, tolerance: 0.5 });
    const result = plugin.measureDistance(pos(0, 0, 0), pos(3, 4, 0)); // 5
    const check = plugin.checkChallenge(result);
    expect(check.passed).toBe(true);
    expect(check.message).toContain("Challenge complete");
  });

  it("checkChallenge fails when outside tolerance", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    plugin.setChallenge({ type: "distance", target: 10 });
    const result = plugin.measureDistance(pos(0, 0, 0), pos(3, 0, 0)); // 3
    const check = plugin.checkChallenge(result);
    expect(check.passed).toBe(false);
    expect(check.message).toContain("Not yet");
    expect(check.message).toContain("target 10");
  });

  it("checkChallenge reports type mismatch", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    plugin.setChallenge({ type: "distance", target: 5 });
    const result = plugin.measureArea(pos(0, 0, 0), pos(2, 0, 2)); // area
    const check = plugin.checkChallenge(result);
    expect(check.passed).toBe(false);
    expect(check.message).toContain("expects distance, measured area");
  });

  it("checkChallenge returns null when no challenge active", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    const result = plugin.measureDistance(pos(0, 0, 0), pos(1, 0, 0));
    const check = plugin.checkChallenge(result);
    expect(check.passed).toBeNull();
    expect(check.message).toBe("No active challenge.");
  });

  it("clearChallenge removes active challenge", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    plugin.setChallenge({ type: "volume", target: 100 });
    expect(plugin.getChallenge()).toBeDefined();
    plugin.clearChallenge();
    expect(plugin.getChallenge()).toBeUndefined();
  });

  it("challenge tolerance defaults to 0 (exact match)", () => {
    const plugin = new MeasurementPlugin();
    plugin.activate();

    plugin.setChallenge({ type: "volume", target: 8 });
    const result = plugin.measureVolume(pos(0, 0, 0), pos(1, 1, 1)); // 8
    const check = plugin.checkChallenge(result);
    expect(check.passed).toBe(true);

    const result2 = plugin.measureVolume(pos(0, 0, 0), pos(0, 0, 1)); // 2
    const check2 = plugin.checkChallenge(result2);
    expect(check2.passed).toBe(false);
  });
});
