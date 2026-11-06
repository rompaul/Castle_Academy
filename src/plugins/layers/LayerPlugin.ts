import { EventBus } from "../../core/events/EventBus";
import { LayerRegistry } from "./LayerRegistry";
import type { LayerDefinition } from "./LayerTypes";
import type { LayerState, ViewMode, SectionViewState } from "./LayerTypes";
import { resolveLayerId, isLayerVisible, isPositionVisible, getVisibleLayerIds, type LayerRulesContext } from "./LayerRules";

/**
 * LayerPlugin facade (V0.4)。
 *
 * 对外提供图层注册、查询、更新接口，并通过事件总线通知状态变更。
 * 纯数据层，不依赖 Three.js/React/DOM。
 *
 * Lifecycle: register() → initialize() → activate() → deactivate() → dispose().
 */
export class LayerPlugin {
  readonly id = "layer";
  readonly name = "Layer";
  readonly version = "0.4.0";

  private active = false;
  private readonly registry: LayerRegistry;
  private state: LayerState;

  constructor(
    private readonly events: EventBus,
    registry: LayerRegistry,
    initialState: Partial<LayerState> = {}
  ) {
    this.registry = registry;
    this.state = {
      activeLayerId: registry.getDefaultLayerId() ?? "",
      visibilityByLayer: {},
      viewMode: { type: "all" },
      section: { enabled: false, axis: "x", coordinate: 0, keptSide: "positive" },
      ...initialState,
    };
  }

  /* ---------- Lifecycle ---------- */

  register(): void {
    // 所有注册通过 registry，此处无额外外部依赖。
  }

  initialize(): void {
    // 无异步准备。
  }

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  dispose(): void {
    this.deactivate();
  }

  /* ---------- Registry ---------- */

  registerLayer(definition: LayerDefinition): void {
    this.registry.register(definition);
    this.events.emit("layer.registry.changed", {
      action: "registered",
      layerId: definition.id,
      timestamp: Date.now(),
    });
  }

  getLayer(id: string): LayerDefinition | undefined {
    return this.registry.get(id);
  }

  getAllLayers(): LayerDefinition[] {
    return this.registry.getAll();
  }

  getDefaultLayerId(): string | null {
    return this.registry.getDefaultLayerId();
  }

  hasLayer(id: string): boolean {
    return this.registry.has(id);
  }

  /* ---------- Active layer ---------- */

  getActiveLayerId(): string {
    return this.state.activeLayerId;
  }

  setActiveLayer(layerId: string): boolean {
    if (!this.registry.has(layerId)) return false;
    const definition = this.registry.get(layerId);
    if (!definition || !definition.buildable) return false;
    const prev = this.state.activeLayerId;
    this.state.activeLayerId = layerId;
    this.events.emit("layer.active.changed", {
      previousLayerId: prev,
      layerId,
      timestamp: Date.now(),
    });
    return true;
  }

  /* ---------- Visibility ---------- */

  getLayerVisibility(layerId: string): boolean | undefined {
    return this.state.visibilityByLayer[layerId];
  }

  /** 判断指定图层是否有效可见（结合用户勾选与视图模式）。 */
  isLayerEffectivelyVisible(layerId: string): boolean {
    const context: LayerRulesContext = {
      definitions: this.registry.getAll().reduce((map, def) => {
        map.set(def.id, def);
        return map;
      }, new Map<string, LayerDefinition>()),
      state: this.state,
    };
    return isLayerVisible(layerId, context);
  }

  getVisibilityByLayer(): Record<string, boolean> {
    return { ...this.state.visibilityByLayer };
  }

  setLayerVisibility(layerId: string, visible: boolean): boolean {
    if (!this.registry.has(layerId)) return false;
    const prev = this.state.visibilityByLayer[layerId];
    this.state.visibilityByLayer[layerId] = visible;
    this.events.emit("layer.visibility.changed", {
      layerId,
      previousVisible: prev,
      visible,
      timestamp: Date.now(),
    });
    return true;
  }

  /* ---------- View mode ---------- */

  getViewMode(): ViewMode {
    return { ...this.state.viewMode };
  }

  setViewMode(mode: ViewMode): void {
    const prev = { ...this.state.viewMode };
    this.state.viewMode = mode;
    this.events.emit("view.mode.changed", {
      previousMode: prev,
      mode,
      timestamp: Date.now(),
    });
  }

  /** 订阅视图模式变更，返回取消订阅函数。 */
  onViewModeChange(handler: (mode: ViewMode) => void): () => void {
    return this.events.on<{ mode: ViewMode }>("view.mode.changed", (event) => {
      handler(event.payload.mode);
    });
  }

  /* ---------- Section view ---------- */

  getSectionView(): SectionViewState {
    return { ...this.state.section };
  }

  setSectionView(section: Partial<SectionViewState>): void {
    const prev = { ...this.state.section };
    this.state.section = { ...this.state.section, ...section };
    this.events.emit("section.view.changed", {
      previousSection: prev,
      section: this.state.section,
      timestamp: Date.now(),
    });
  }

  /** 订阅剖面视图变更，返回取消订阅函数。 */
  onSectionChange(handler: (section: SectionViewState) => void): () => void {
    return this.events.on<{ section: SectionViewState }>("section.view.changed", (event) => {
      handler(event.payload.section);
    });
  }

  /* ---------- Resolution ---------- */

  resolveLayerId(y: number): string | undefined {
    return resolveLayerId(y, this.registry.getAll().reduce((map, def) => {
      map.set(def.id, def);
      return map;
    }, new Map<string, LayerDefinition>()));
  }

  isPositionVisible(position: { x: number; y: number; z: number }): boolean {
    return isPositionVisible(position, {
      definitions: this.registry.getAll().reduce((map, def) => {
        map.set(def.id, def);
        return map;
      }, new Map<string, LayerDefinition>()),
      state: this.state,
    });
  }

  getVisibleLayerIds(): string[] {
    return getVisibleLayerIds({
      definitions: this.registry.getAll().reduce((map, def) => {
        map.set(def.id, def);
        return map;
      }, new Map<string, LayerDefinition>()),
      state: this.state,
    });
  }

  /* ---------- Active state ---------- */

  getState(): LayerState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.active;
  }
}
