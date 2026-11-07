import type { GridPosition } from "../../core/world/coordinates";
import type { BlockId } from "../../core/world/blocks";

/**
 * V05-010~012 — 城堡水务舞台（学习任务预设场景）。
 *
 * 在 V0.4 样板世界基础上扩展三个任务舞台（数据即布局，无逻辑）：
 * 1. 护城河：半径 5 的石砌渠底（y=0）+ 内外墙（半径 4/6，y=1）围成的 1 格深水道。
 * 2. 城堡水井：东侧 3×3 石塔（x∈[6,8], z∈[-1,1]），中空井筒从 y=1 到 y=-2，
 *    井底 y=-3 石板；塔顶开口，玩家把水引到塔顶即灌满井筒。
 * 3. 地牢积水池：地下室 7×7 石板地（y=-4）+ 四周石墙（y=-3，半径 4）围成封闭水池，
 *    预置一个渗水水源 (2,-3,2)——玩家的任务是用排水渠把指定角落排干。
 *
 * 布局与任务判定（castleQuests.ts）共享同一份区域定义，避免双写漂移。
 */

export type StagePlace = (position: GridPosition, blockId: BlockId) => boolean;

const RING_DELTAS = (radius: number): GridPosition[] => {
  const cells: GridPosition[] = [];
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === radius) cells.push({ x, y: 0, z });
    }
  }
  return cells;
};

/** 护城河渠底（y=0，半径 5）——与任务区域（同 x/z，y=1）一一对应 */
export const MOAT_FLOOR_CELLS: GridPosition[] = RING_DELTAS(5).map((p) => ({ ...p, y: 0 }));
/** 水井井筒（判定区） */
export const WELL_SHAFT_CELLS: GridPosition[] = [
  { x: 7, y: -1, z: 0 },
  { x: 7, y: -2, z: 0 }
];
/** 地牢必须排干的"牢房区"（2×2） */
export const DUNGEON_DRY_CELLS: GridPosition[] = [
  { x: -2, y: -3, z: -2 },
  { x: -1, y: -3, z: -2 },
  { x: -2, y: -3, z: -1 },
  { x: -1, y: -3, z: -1 }
];
/** 地牢渗水水源位置（两处：保证牢房区初始真实积水——单源扩散 7 格够不到角落） */
export const DUNGEON_SEEP_POSITIONS: readonly GridPosition[] = [
  { x: 2, y: -3, z: 2 },
  { x: -1, y: -3, z: 2 }
];

/** 构建城堡水务舞台（幂等：重复放置同格失败会被忽略）。 */
export function buildCastleWaterStage(place: StagePlace): void {
  /* ---------- 1. 护城河 ---------- */
  for (const cell of MOAT_FLOOR_CELLS) place(cell, "stone");
  for (const wall of RING_DELTAS(4)) place({ ...wall, y: 1 }, "stone");
  for (const wall of RING_DELTAS(6)) place({ ...wall, y: 1 }, "stone");

  /* ---------- 2. 城堡水井（3×3 石塔，中空井筒） ---------- */
  for (let y = 1; y >= -3; y--) {
    for (let x = 6; x <= 8; x++) {
      for (let z = -1; z <= 1; z++) {
        const isShaft = x === 7 && z === 0 && y >= -2;
        if (!isShaft) place({ x, y, z }, "stone");
      }
    }
  }

  /* ---------- 3. 地牢积水池 ---------- */
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      place({ x, y: -4, z }, "stone"); // 池底
    }
  }
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === 4) place({ x, y: -3, z }, "stone"); // 池壁
    }
  }
  for (const seep of DUNGEON_SEEP_POSITIONS) place(seep, "water_source");
}
