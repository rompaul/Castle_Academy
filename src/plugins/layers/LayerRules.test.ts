import { describe, expect, it } from "vitest";
import type { LayerRulesContext } from "./LayerRules";
import {
  isLayerVisible,
  isPositionVisible,
  resolveLayerId,
  getVisibleLayerIds,
} from "./LayerRules";
import type { LayerDefinition, LayerState } from "./LayerTypes";

function groundLayer(): LayerDefinition {
  return {
    id: "ground",
    label: "Ground",
    kind: "ground-floor",
    minY: 0,
    maxYExclusive: 4,
    order: 0,
    defaultVisible: true,
    buildable: true,
  };
}

function level1Layer(): LayerDefinition {
  return {
    id: "level-1",
    label: "Level 1",
    kind: "upper-floor",
    minY: 4,
    maxYExclusive: 8,
    order: 1,
    defaultVisible: true,
    buildable: true,
  };
}

function basement1Layer(): LayerDefinition {
  return {
    id: "basement-1",
    label: "Basement 1",
    kind: "basement",
    minY: -4,
    maxYExclusive: 0,
    order: -1,
    defaultVisible: true,
    buildable: true,
  };
}

function basement2Layer(): LayerDefinition {
  return {
    id: "basement-2",
    label: "Basement 2",
    kind: "basement",
    minY: -8,
    maxYExclusive: -4,
    order: -2,
    defaultVisible: true,
    buildable: true,
  };
}

function makeContext(
  layers: LayerDefinition[],
  state: Partial<LayerState>
): LayerRulesContext {
  const definitions = new Map<string, LayerDefinition>();
  for (const layer of layers) {
    definitions.set(layer.id, layer);
  }
  const defaultState: LayerState = {
    activeLayerId: layers[0]?.id ?? "ground",
    visibilityByLayer: {},
    viewMode: { type: "all" },
    section: { enabled: false, axis: "x", coordinate: 0, keptSide: "positive" },
  };
  return {
    definitions,
    state: { ...defaultState, ...state },
  };
}

describe("LayerRules (pure functions)", () => {
  describe("resolveLayerId", () => {
    it("maps y to the correct layer", () => {
      const ctx = makeContext(
        [basement2Layer(), basement1Layer(), groundLayer(), level1Layer()],
        {}
      );
      expect(resolveLayerId(-7, ctx.definitions)).toBe("basement-2");
      expect(resolveLayerId(-3, ctx.definitions)).toBe("basement-1");
      expect(resolveLayerId(0, ctx.definitions)).toBe("ground");
      expect(resolveLayerId(3, ctx.definitions)).toBe("ground");
      expect(resolveLayerId(5, ctx.definitions)).toBe("level-1");
      expect(resolveLayerId(100, ctx.definitions)).toBeUndefined();
      expect(resolveLayerId(-100, ctx.definitions)).toBeUndefined();
    });

    it("treats minY as inclusive and maxYExclusive as exclusive", () => {
      const ctx = makeContext([groundLayer()], {});
      expect(resolveLayerId(0, ctx.definitions)).toBe("ground");
      expect(resolveLayerId(3, ctx.definitions)).toBe("ground");
      expect(resolveLayerId(4, ctx.definitions)).toBeUndefined();
      expect(resolveLayerId(-1, ctx.definitions)).toBeUndefined();
    });
  });

  describe("isLayerVisible", () => {
    it("defaults to LayerDefinition.defaultVisible when not in visibilityByLayer", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { visibilityByLayer: {} }
      );
      expect(isLayerVisible("ground", ctx)).toBe(true);
      expect(isLayerVisible("basement-1", ctx)).toBe(true);
    });

    it("respects user visibility override", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { visibilityByLayer: { ground: false, "basement-1": true } }
      );
      expect(isLayerVisible("ground", ctx)).toBe(false);
      expect(isLayerVisible("basement-1", ctx)).toBe(true);
    });

    it("returns false for unknown layer", () => {
      const ctx = makeContext([groundLayer()], {});
      expect(isLayerVisible("nonexistent", ctx)).toBe(false);
    });

    it("respects defaultVisible: false", () => {
      const hiddenLayer: LayerDefinition = {
        ...groundLayer(),
        id: "hidden",
        defaultVisible: false,
      };
      const ctx = makeContext([hiddenLayer], { visibilityByLayer: {} });
      expect(isLayerVisible("hidden", ctx)).toBe(false);
    });
  });

  describe("view mode filtering", () => {
    it("all mode shows every visible layer", () => {
      const ctx = makeContext(
        [basement1Layer(), groundLayer(), level1Layer()],
        { viewMode: { type: "all" } }
      );
      expect(isLayerVisible("ground", ctx)).toBe(true);
      expect(isLayerVisible("level-1", ctx)).toBe(true);
      expect(isLayerVisible("basement-1", ctx)).toBe(true);
    });

    it("above-ground mode shows only y >= 0 layers", () => {
      const ctx = makeContext(
        [basement1Layer(), groundLayer(), level1Layer()],
        { viewMode: { type: "above-ground" } }
      );
      expect(isLayerVisible("ground", ctx)).toBe(true);
      expect(isLayerVisible("level-1", ctx)).toBe(true);
      expect(isLayerVisible("basement-1", ctx)).toBe(false);
    });

    it("underground mode shows only y < 0 layers", () => {
      const ctx = makeContext(
        [basement1Layer(), groundLayer(), level1Layer()],
        { viewMode: { type: "underground" } }
      );
      expect(isLayerVisible("basement-1", ctx)).toBe(true);
      expect(isLayerVisible("ground", ctx)).toBe(false);
      expect(isLayerVisible("level-1", ctx)).toBe(false);
    });

    it("current-layer mode shows only active layer", () => {
      const ctx = makeContext(
        [groundLayer(), level1Layer()],
        { activeLayerId: "level-1", viewMode: { type: "current-layer" } }
      );
      expect(isLayerVisible("level-1", ctx)).toBe(true);
      expect(isLayerVisible("ground", ctx)).toBe(false);
    });

    it("custom mode relies on visibilityByLayer", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { viewMode: { type: "custom" }, visibilityByLayer: { ground: true, "basement-1": false } }
      );
      expect(isLayerVisible("ground", ctx)).toBe(true);
      expect(isLayerVisible("basement-1", ctx)).toBe(false);
    });
  });

  describe("isPositionVisible", () => {
    it("returns true for visible layer positions", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { viewMode: { type: "all" } }
      );
      expect(isPositionVisible({ x: 0, y: 0, z: 0 }, ctx)).toBe(true);
      expect(isPositionVisible({ x: 0, y: -3, z: 0 }, ctx)).toBe(true);
    });

    it("returns false for positions outside all layer ranges", () => {
      const ctx = makeContext([groundLayer()], { viewMode: { type: "all" } });
      expect(isPositionVisible({ x: 0, y: 100, z: 0 }, ctx)).toBe(false);
      expect(isPositionVisible({ x: 0, y: -100, z: 0 }, ctx)).toBe(false);
    });

    it("returns false when layer is hidden by view mode", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { viewMode: { type: "above-ground" } }
      );
      expect(isPositionVisible({ x: 0, y: -3, z: 0 }, ctx)).toBe(false);
    });

    it("returns false when layer is hidden by visibilityByLayer", () => {
      const ctx = makeContext(
        [groundLayer(), basement1Layer()],
        { viewMode: { type: "all" }, visibilityByLayer: { "basement-1": false } }
      );
      expect(isPositionVisible({ x: 0, y: -3, z: 0 }, ctx)).toBe(false);
    });
  });

  describe("getVisibleLayerIds", () => {
    it("returns all visible layer ids", () => {
      const ctx = makeContext(
        [basement1Layer(), groundLayer(), level1Layer()],
        { viewMode: { type: "all" } }
      );
      expect(getVisibleLayerIds(ctx)).toEqual([
        "basement-1",
        "ground",
        "level-1",
      ]);
    });

    it("returns filtered ids for above-ground mode", () => {
      const ctx = makeContext(
        [basement1Layer(), groundLayer(), level1Layer()],
        { viewMode: { type: "above-ground" } }
      );
      expect(getVisibleLayerIds(ctx)).toEqual(["ground", "level-1"]);
    });
  });
});
