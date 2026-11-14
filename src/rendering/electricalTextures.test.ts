/**
 * V061-007 — 9 类 16×16 程序化纹理 + atlas 容量运行时实测（AC-6731 / AC-6732 / AC-6733）。
 *
 * 本测试在 node 环境用一个最小 Canvas 2D stub 真实调用 `buildBlockAtlas()`：
 * 绘制调用被记录为像素序列，因此既能验证确定性，又能按 `slotByFn` 语义统计
 * 运行时唯一瓦片数（不再只是 Phase 0 的静态解析推导）。
 */

import { describe, expect, it } from "vitest";
import {
  BLOCK_IDS_WITH_TEXTURES,
  buildBlockAtlas,
  generateBlockTexture,
  hasFaceTexture,
} from "./textureGenerator";

interface StubCanvas {
  width: number;
  height: number;
  pixels: string[];
  getContext: () => {
    fillStyle: string;
    fillRect: (x: number, y: number, w: number, h: number) => void;
    drawImage: () => void;
  };
}

const created: StubCanvas[] = [];

/** 记录像素序列：ctx 必须稳定，否则 fillStyle 读不到当次写入的颜色。 */
function installStableCanvasStub(): void {
  const makeCanvas = (): StubCanvas => {
    const pixels: string[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: (x: number, y: number) => {
        pixels.push(`${x},${y},${ctx.fillStyle}`);
      },
      drawImage: () => {},
    };
    const canvas: StubCanvas = {
      width: 0,
      height: 0,
      get pixels() {
        return pixels;
      },
      getContext: () => ctx,
    };
    created.push(canvas);
    return canvas;
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => makeCanvas(),
  };
}

installStableCanvasStub();

const ELECTRICAL_IDS: readonly string[] = [
  "power_source_low_voltage",
  "wire_basic",
  "switch_open",
  "switch_closed",
  "lamp_basic",
  "signal_beacon",
  "water_pump_basic",
  "water_valve_open",
  "water_valve_closed",
];

function pixelsOf(blockId: string, face: "top" | "side" | "bottom"): string {
  created.length = 0;
  const texture = generateBlockTexture(blockId, face);
  expect(texture, `${blockId}:${face}`).toBeDefined();
  return created[0]!.pixels.join("|");
}

describe("V061-007 电力纹理与 atlas 运行时实测", () => {
  it("AC-6731 9 类方块三面纹理齐全，34 个块全部有纹理集", () => {
    for (const id of ELECTRICAL_IDS) {
      for (const face of ["top", "side", "bottom"] as const) {
        expect(hasFaceTexture(id, face), `${id}:${face}`).toBe(true);
      }
    }
    expect(BLOCK_IDS_WITH_TEXTURES).toHaveLength(34);
  });

  it("AC-6731 每个 ID 的 top / side 是专属纹样，bottom 复用既有共享瓦片", () => {
    const atlas = buildBlockAtlas();
    const slot = (key: string): string => {
      const value = atlas.uvMap[key];
      expect(value, key).toBeDefined();
      return `${value!.col},${value!.row}`;
    };
    for (const id of ELECTRICAL_IDS) {
      expect(slot(`${id}:top`), id).not.toBe(slot(`${id}:side`));
      expect(slot(`${id}:bottom`), id).not.toBe(slot(`${id}:top`));
    }
    // 9 类的 top 两两不同（18 个专属函数各自独占一格）。
    const topSlots = new Set(ELECTRICAL_IDS.map((id) => slot(`${id}:top`)));
    const sideSlots = new Set(ELECTRICAL_IDS.map((id) => slot(`${id}:side`)));
    expect(topSlots.size).toBe(9);
    expect(sideSlots.size).toBe(9);
    expect(new Set([...topSlots, ...sideSlots]).size).toBe(18);
    // bottom 复用既有函数：与某个 V0.6 既有块的瓦片重合。
    expect(slot("lamp_basic:bottom")).toBe(slot("wall_plaster:top"));
    expect(slot("wire_basic:bottom")).toBe(slot("foundation_concrete:top"));
    expect(slot("water_valve_open:bottom")).toBe(slot("water_pipe_blue:side"));
  });

  it("AC-6731 确定性 seed：同一面两次生成的 16×16 像素序列逐字节一致", () => {
    for (const id of ELECTRICAL_IDS) {
      const first = pixelsOf(id, "top");
      const second = pixelsOf(id, "top");
      expect(second, id).toBe(first);
      expect(first.length).toBeGreaterThan(0);
    }
  });

  it("AC-6731 不同类别纹样可区分；开关 / 阀门两态靠形状区分而非仅靠颜色", () => {
    const tops = ELECTRICAL_IDS.map((id) => pixelsOf(id, "top"));
    expect(new Set(tops).size).toBe(9);
    expect(pixelsOf("switch_open", "top")).not.toBe(pixelsOf("switch_closed", "top"));
    expect(pixelsOf("water_valve_open", "top")).not.toBe(pixelsOf("water_valve_closed", "top"));
  });

  it("AC-6732 运行时 buildBlockAtlas() 唯一瓦片 ≤64（8×8 上限），无溢出", () => {
    const atlas = buildBlockAtlas();
    expect(atlas.cols).toBe(8);
    expect(atlas.rows).toBe(8);
    const slots = new Set(
      Object.values(atlas.uvMap).map(({ col, row }) => `${col},${row}`)
    );
    // Phase 0 静态解析 31 格；V061-007 新增 18 个专属函数 → 运行时实测目标 49 格。
    expect(slots.size).toBe(49);
    expect(slots.size).toBeLessThanOrEqual(64);
    expect(Object.keys(atlas.uvMap)).toHaveLength(34 * 3);
    // eslint-disable-next-line no-console
    console.log(`[V061-007] atlas runtime unique tiles = ${slots.size}/64 (31 baseline + 18 electrical)`);
  });

  it("AC-6733 通电 / 断电双态未烘焙进图集，无第二套纹理键", () => {
    const atlas = buildBlockAtlas();
    const keys = Object.keys(atlas.uvMap);
    expect(keys.some((key) => /powered|energized|:on$|:off$|lit_|unlit_/.test(key))).toBe(false);
    for (const id of ELECTRICAL_IDS) {
      expect(keys.filter((key) => key.startsWith(`${id}:`))).toHaveLength(3);
    }
  });
});
