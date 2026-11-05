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

  it("检测负 Y（地下）方块的碰撞", () => {
    // 玩家眼睛在地下方块内部（脚在方块内）
    expect(playerIntersectsBlock(0, -3, 0, 0, -4, 0)).toBe(true);
    // 玩家在方块上方，脚在方块顶面以上，无垂直重叠
    expect(playerIntersectsBlock(0, -1.3, 0, 0, -4, 0)).toBe(false);
    // 玩家在方块下方，头在方块底面以下，无垂直重叠
    expect(playerIntersectsBlock(0, -5, 0, 0, -4, 0)).toBe(false);
    // 水平无重叠
    expect(playerIntersectsBlock(2, -3, 0, 0, -4, 0)).toBe(false);
  });
});
