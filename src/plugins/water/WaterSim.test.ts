import { describe, expect, it } from "vitest";
import { positionKey, type GridPosition } from "../../core/world/coordinates";
import { computeWater, DEFAULT_WATER_SIM_CONFIG, type WaterSimConfig, type WaterWorldQuery } from "./WaterSim";

/** 测试世界：Map 驱动的确定性假世界 */
function makeWorld(blocks: Array<{ pos: GridPosition; id: string }>): WaterWorldQuery & { blocks: Map<string, string> } {
  const map = new Map<string, string>();
  for (const { pos, id } of blocks) map.set(positionKey(pos), id);
  return {
    blocks: map,
    hasBlock(pos) {
      return map.has(positionKey(pos));
    },
    blockAt(pos) {
      return map.get(positionKey(pos));
    },
  };
}

const CONFIG: WaterSimConfig = { ...DEFAULT_WATER_SIM_CONFIG };

/** 快捷构造：水源在 origin，返回计算结果（测试世界下边界 -32，同 WORLD_BOUNDS.minY） */
function simulate(blocks: Parameters<typeof makeWorld>[0], sources: GridPosition[]) {
  const world = makeWorld(blocks);
  return computeWater({ world, sources, minY: -32 }, CONFIG);
}

const keys = (result: Map<string, GridPosition>) => [...result.keys()].sort();
const p = (x: number, y: number, z: number): GridPosition => ({ x, y, z });

describe("WaterSim 规则（V05-005 / AC-101~110 规则层）", () => {
  it("确定性：同一输入两次计算结果完全一致（无随机/时序）", () => {
    const blocks = [{ pos: p(0, 1, 0), id: "water_source" }];
    const sources = [p(0, 1, 0)];
    const a = simulate(blocks, sources);
    const b = simulate(blocks, sources);
    expect(keys(a.water)).toEqual(keys(b.water));
  });

  it("AC-102 向下流：悬空水源垂直下落到底", () => {
    const result = simulate([{ pos: p(0, 5, 0), id: "water_source" }], [p(0, 5, 0)]);
    // y=4..? 全部下落，且无水平扩散（下方无支撑）
    const ys = [...result.water.values()].map((c) => c.y);
    expect(ys.every((y) => y < 5)).toBe(true);
    expect(result.water.has(positionKey(p(0, 4, 0)))).toBe(true);
    // 水平计数清零后支撑面上可扩散，但此例无地面
  });

  it("AC-103 水平扩散上限：平地单源扩散 ≤ 7 格", () => {
    // 平地：y=0 一层石板，水源在 (0,1,0)
    const blocks: Parameters<typeof makeWorld>[0] = [];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) blocks.push({ pos: p(x, 0, z), id: "stone" });
    const result = simulate(blocks, [p(0, 1, 0)]);
    // 所有水格到源的水平切比雪夫距离 ≤ 7（4 邻接 BFS 实为曼哈顿路径，这里验证边界）
    for (const cell of result.water.values()) {
      const dist = Math.abs(cell.x) + Math.abs(cell.z);
      expect(dist).toBeLessThanOrEqual(CONFIG.horizontalSpreadLimit);
    }
    // 边界处恰好有水
    expect(result.water.has(positionKey(p(7, 1, 0)))).toBe(true);
    expect(result.water.has(positionKey(p(8, 1, 0)))).toBe(false);
  });

  it("AC-104 遇固体阻挡：水不穿墙、不覆盖方块", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [
      { pos: p(0, 0, 0), id: "stone" }, // 地面
      { pos: p(1, 0, 0), id: "stone" },
      { pos: p(2, 0, 0), id: "stone" },
      { pos: p(0, 1, 0), id: "water_source" },
      { pos: p(1, 1, 0), id: "stone" }, // 墙
    ];
    const result = simulate(blocks, [p(0, 1, 0)]);
    expect(result.water.has(positionKey(p(2, 1, 0)))).toBe(false); // 墙后无水
    expect(result.water.has(positionKey(p(0, 1, 1)))).toBe(true); // 侧面正常扩散
  });

  it("AC-105 水格只是空格：不放水进任何方块格", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [
      { pos: p(0, 0, 0), id: "stone" },
      { pos: p(0, 1, 0), id: "water_source" },
    ];
    const result = simulate(blocks, [p(0, 1, 0)]);
    const solidKeys = new Set(blocks.map((b) => positionKey(b.pos)));
    for (const key of result.water.keys()) {
      expect(solidKeys.has(key)).toBe(false);
    }
  });

  it("AC-106 排水渠吸收：水到达渠即终止，不穿透", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [
      { pos: p(-1, 0, 0), id: "stone" }, { pos: p(0, 0, 0), id: "stone" },
      { pos: p(1, 0, 0), id: "stone" }, { pos: p(2, 0, 0), id: "stone" },
      { pos: p(3, 0, 0), id: "stone" },
      { pos: p(0, 1, 0), id: "water_source" },
      { pos: p(2, 1, 0), id: "drain_channel" },
    ];
    const result = simulate(blocks, [p(0, 1, 0)]);
    expect(result.wetDrains.has(positionKey(p(2, 1, 0)))).toBe(true);
    expect(result.water.has(positionKey(p(3, 1, 0)))).toBe(false); // 渠后无水
    expect(result.water.has(positionKey(p(1, 1, 0)))).toBe(true); // 渠前有水
  });

  it("AC-107 管道连通：链上管道 flowing，出水口出水", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [
      { pos: p(0, 0, 0), id: "stone" }, { pos: p(1, 0, 0), id: "stone" },
      { pos: p(2, 0, 0), id: "stone" }, { pos: p(3, 0, 0), id: "stone" },
      { pos: p(0, 1, 0), id: "water_source" },
      { pos: p(1, 1, 0), id: "water_pipe_blue" },
      { pos: p(2, 1, 0), id: "water_pipe_blue" },
      { pos: p(3, 1, 0), id: "water_pipe_blue" },
    ];
    const result = simulate(blocks, [p(0, 1, 0)]);
    expect(result.flowingPipes.has(positionKey(p(1, 1, 0)))).toBe(true);
    expect(result.flowingPipes.has(positionKey(p(3, 1, 0)))).toBe(true);
    // 出水口：末端管道旁的空格（y=1, x=4）与末端下方
    expect(result.water.has(positionKey(p(4, 1, 0)))).toBe(true);
    expect(result.water.has(positionKey(p(3, 0, 0)))).toBe(false); // 管道下方是石板(实心)
  });

  it("AC-108 管道断开：移除中间段后下游 flowing=false", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [
      { pos: p(0, 1, 0), id: "water_source" },
      { pos: p(1, 1, 0), id: "water_pipe_blue" },
      // (2,1,0) 缺失 = 断开
      { pos: p(3, 1, 0), id: "water_pipe_blue" },
    ];
    const result = simulate(blocks, [p(0, 1, 0)]);
    expect(result.flowingPipes.has(positionKey(p(1, 1, 0)))).toBe(true);
    expect(result.flowingPipes.has(positionKey(p(3, 1, 0)))).toBe(false);
  });

  it("AC-110 多水源叠加：移除其一，公共区域水仍在", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) blocks.push({ pos: p(x, 0, z), id: "stone" });
    blocks.push({ pos: p(-2, 1, 0), id: "water_source" });
    blocks.push({ pos: p(2, 1, 0), id: "water_source" });
    const both = simulate(blocks, [p(-2, 1, 0), p(2, 1, 0)]);
    const onlyLeft = simulate(blocks, [p(-2, 1, 0)]);
    // (0,1,0) 在两者可达范围内
    expect(both.water.has(positionKey(p(0, 1, 0)))).toBe(true);
    expect(onlyLeft.water.has(positionKey(p(0, 1, 0)))).toBe(true);
    expect(onlyLeft.water.size).toBeGreaterThan(0);
  });

  it("AC-109 语义：无水源则无水", () => {
    const result = simulate([{ pos: p(0, 0, 0), id: "stone" }], []);
    expect(result.water.size).toBe(0);
    expect(result.flowingPipes.size).toBe(0);
  });

  it("配置生效：缩小水平上限减少扩散", () => {
    const blocks: Parameters<typeof makeWorld>[0] = [];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) blocks.push({ pos: p(x, 0, z), id: "stone" });
    const narrow = computeWater(
      { world: makeWorld(blocks), sources: [p(0, 1, 0)], minY: -32 },
      { ...CONFIG, horizontalSpreadLimit: 2 }
    );
    expect(narrow.water.has(positionKey(p(3, 1, 0)))).toBe(false);
    expect(narrow.water.has(positionKey(p(2, 1, 0)))).toBe(true);
  });
});
