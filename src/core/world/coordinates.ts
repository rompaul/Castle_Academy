export interface GridPosition { x: number; y: number; z: number }

export function positionKey(position: GridPosition): string {
  return `${position.x},${position.y},${position.z}`;
}

export function isGridPosition(position: GridPosition): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z) &&
    Number.isInteger(position.x) && Number.isInteger(position.y) && Number.isInteger(position.z);
}

export function isInsideBuildArea(position: GridPosition, size = 32): boolean {
  if (!isGridPosition(position) || !Number.isInteger(size) || size <= 0) return false;
  const half = size / 2;
  return position.x >= -half && position.x < half &&
    position.z >= -half && position.z < half &&
    position.y >= 0 && position.y < 64;
}

export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
