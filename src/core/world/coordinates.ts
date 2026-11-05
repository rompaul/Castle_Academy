export interface GridPosition { x: number; y: number; z: number }

/**
 * 集中定义世界边界。V0.4 扩展垂直范围以支持负 Y（地下空间）。
 * X/Z 保留 V0.1 的 [-16, 16)；Y 扩展到 [-32, 64)。
 * 所有坐标边界判断必须通过本常量，不得在代码中散落魔法数字。
 */
export const WORLD_BOUNDS = {
  minX: -16,
  maxXExclusive: 16,
  minZ: -16,
  maxZExclusive: 16,
  minY: -32,
  maxYExclusive: 64,
} as const;

export function positionKey(position: GridPosition): string {
  return `${position.x},${position.y},${position.z}`;
}

export function isGridPosition(position: GridPosition): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z) &&
    Number.isInteger(position.x) && Number.isInteger(position.y) && Number.isInteger(position.z);
}

export function isInsideBuildArea(position: GridPosition): boolean {
  if (!isGridPosition(position)) return false;
  return position.x >= WORLD_BOUNDS.minX && position.x < WORLD_BOUNDS.maxXExclusive &&
    position.z >= WORLD_BOUNDS.minZ && position.z < WORLD_BOUNDS.maxZExclusive &&
    position.y >= WORLD_BOUNDS.minY && position.y < WORLD_BOUNDS.maxYExclusive;
}

export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
