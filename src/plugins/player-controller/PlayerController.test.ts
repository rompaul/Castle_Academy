import { describe, expect, it } from "vitest";
import { circleIntersectsBlock, playerIntersectsBlock } from "./PlayerController";

describe("player voxel collision geometry", () => {
  it("detects overlap with a voxel and allows a clear gap", () => {
    expect(circleIntersectsBlock(0, 0, 0.28, 0, 0)).toBe(true);
    expect(circleIntersectsBlock(0.78, 0, 0.28, 0, 0)).toBe(false);
  });

  it("uses circle-to-box distance at corners", () => {
    expect(circleIntersectsBlock(0.68, 0.68, 0.28, 0, 0)).toBe(true);
    expect(circleIntersectsBlock(0.71, 0.71, 0.28, 0, 0)).toBe(false);
  });

  it("checks vertical body overlap as well as horizontal overlap", () => {
    expect(playerIntersectsBlock(0, 2.2, 0, 0, 0, 0)).toBe(true);
    expect(playerIntersectsBlock(0, 4, 0, 0, 0, 0)).toBe(false);
    expect(playerIntersectsBlock(2, 2.2, 0, 0, 0, 0)).toBe(false);
  });
});
