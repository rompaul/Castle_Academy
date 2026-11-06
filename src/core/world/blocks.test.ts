import { describe, expect, it } from "vitest";
import { BLOCKS, type BlockId, getBlockDefinition, ASSET_MANIFEST } from "./blocks";

describe("BLOCKS registry (V0.4.2)", () => {
  it("contains all 22 block IDs (7 original + 15 new)", () => {
    expect(BLOCKS.length).toBe(22);
  });

  it("all block IDs are unique", () => {
    const ids = BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all blocks have model, material, behavior defined", () => {
    for (const block of BLOCKS) {
      expect(block.model.type).toBeDefined();
      expect(block.model.orientation).toBeDefined();
      expect(block.material.texelSize).toBeDefined();
      expect(block.behavior.collidable).toBeDefined();
      expect(block.behavior.selectable).toBeDefined();
      expect(block.behavior.placeable).toBeDefined();
    }
  });

  it("getBlockDefinition returns correct definition for each ID", () => {
    for (const block of BLOCKS) {
      const def = getBlockDefinition(block.id as BlockId);
      expect(def.id).toBe(block.id);
      expect(def.name).toBe(block.name);
      expect(def.color).toBe(block.color);
      expect(def.swatch).toBe(block.swatch);
    }
  });

  it("getBlockDefinition throws for unknown ID", () => {
    expect(() => getBlockDefinition("not-a-block" as BlockId)).toThrow(
      "Unknown block id: not-a-block"
    );
  });

  it("ASSET_MANIFEST contains entries for all block IDs", () => {
    const manifestIds = Object.keys(ASSET_MANIFEST.entries);
    expect(manifestIds.length).toBe(BLOCKS.length);
    for (const block of BLOCKS) {
      expect(ASSET_MANIFEST.entries[block.id]).toBeDefined();
      expect(ASSET_MANIFEST.entries[block.id]!.id).toBe(block.id);
      expect(ASSET_MANIFEST.entries[block.id]!.model).toBe(block.model);
      expect(ASSET_MANIFEST.entries[block.id]!.material).toBe(block.material);
      expect(ASSET_MANIFEST.entries[block.id]!.behavior).toBe(block.behavior);
    }
  });

  it("ASSET_MANIFEST schema version is 1", () => {
    expect(ASSET_MANIFEST.schemaVersion).toBe(1);
  });
});
