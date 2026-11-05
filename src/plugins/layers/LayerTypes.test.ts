import { describe, expect, it } from "vitest";
import type {
  LayerDefinition,
  LayerKind,
  LayerState,
  SectionKeptSide,
  SectionViewState,
  SectionAxis,
  ViewMode,
} from "./LayerTypes";

describe("LayerTypes (V0.4 data contract)", () => {
  it("LayerKind covers all required kinds", () => {
    const kinds: LayerKind[] = [
      "ground-floor", "upper-floor", "basement", "foundation", "passage",
    ];
    expect(kinds).toHaveLength(5);
    expect(kinds).toContain("ground-floor");
    expect(kinds).toContain("upper-floor");
    expect(kinds).toContain("basement");
    expect(kinds).toContain("foundation");
    expect(kinds).toContain("passage");
  });

  it("LayerDefinition schema is well-formed", () => {
    const def: LayerDefinition = {
      id: "ground",
      label: "Ground",
      kind: "ground-floor",
      minY: 0,
      maxYExclusive: 4,
      order: 0,
      defaultVisible: true,
      buildable: true,
    };
    expect(def.id).toBe("ground");
    expect(def.label).toBe("Ground");
    expect(def.kind).toBe("ground-floor");
    expect(def.minY).toBe(0);
    expect(def.maxYExclusive).toBe(4);
    expect(def.order).toBe(0);
    expect(def.defaultVisible).toBe(true);
    expect(def.buildable).toBe(true);
    // minY < maxYExclusive (non-overlapping, valid range)
    expect(def.minY).toBeLessThan(def.maxYExclusive);
  });

  it("basement layer definition has negative Y range", () => {
    const def: LayerDefinition = {
      id: "basement-1",
      label: "Basement 1",
      kind: "basement",
      minY: -4,
      maxYExclusive: 0,
      order: -1,
      defaultVisible: true,
      buildable: true,
    };
    expect(def.minY).toBeLessThan(0);
    expect(def.maxYExclusive).toBe(0);
    expect(def.minY).toBeLessThan(def.maxYExclusive);
  });

  it("foundation layer definition is below basement", () => {
    const def: LayerDefinition = {
      id: "foundation",
      label: "Foundation",
      kind: "foundation",
      minY: -12,
      maxYExclusive: -8,
      order: -3,
      defaultVisible: true,
      buildable: true,
    };
    expect(def.kind).toBe("foundation");
    expect(def.maxYExclusive).toBe(-8);
    expect(def.minY).toBeLessThan(def.maxYExclusive);
  });

  it("ViewMode discriminated union variants", () => {
    const modes: ViewMode[] = [
      { type: "all" },
      { type: "above-ground" },
      { type: "underground" },
      { type: "current-layer" },
      { type: "custom" },
    ];
    expect(modes).toHaveLength(5);
    expect(modes[0].type).toBe("all");
    expect(modes[1].type).toBe("above-ground");
    expect(modes[2].type).toBe("underground");
    expect(modes[3].type).toBe("current-layer");
    expect(modes[4].type).toBe("custom");
  });

  it("LayerState schema is well-formed", () => {
    const state: LayerState = {
      activeLayerId: "ground",
      visibilityByLayer: { ground: true, "level-1": true, "basement-1": false },
      viewMode: { type: "all" },
    };
    expect(state.activeLayerId).toBe("ground");
    expect(state.visibilityByLayer["ground"]).toBe(true);
    expect(state.visibilityByLayer["basement-1"]).toBe(false);
    expect(state.viewMode.type).toBe("all");
  });

  it("SectionViewState schema is well-formed", () => {
    const state: SectionViewState = {
      enabled: true,
      axis: "x",
      coordinate: 0,
      keptSide: "positive",
    };
    expect(state.enabled).toBe(true);
    expect(state.axis).toBe("x");
    expect(state.coordinate).toBe(0);
    expect(state.keptSide).toBe("positive");

    const zState: SectionViewState = {
      enabled: false,
      axis: "z",
      coordinate: 5,
      keptSide: "negative",
    };
    expect(zState.axis).toBe("z");
    expect(zState.keptSide).toBe("negative");
  });

  it("SectionAxis and SectionKeptSide are discriminated", () => {
    const axes: SectionAxis[] = ["x", "z"];
    const sides: SectionKeptSide[] = ["positive", "negative"];
    expect(axes).toContain("x");
    expect(axes).toContain("z");
    expect(sides).toContain("positive");
    expect(sides).toContain("negative");
  });
});
