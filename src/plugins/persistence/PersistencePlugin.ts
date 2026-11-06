import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

export interface PersistencePluginConfig {
  storageKey: string;
  storageKeyView: string;
  enabled: boolean;
}

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Persistence plugin (V0.2).
 *
 * Owns save/load of the world snapshot to browser localStorage. It does not
 * touch Three.js or the renderer — it only mutates WorldState via its public
 * serialize/load interface and notifies through the event bus. The shell (App)
 * is responsible for wiring a reload handler so the renderer can rebuild meshes
 * after a load.
 *
 * Lifecycle: register() → initialize() → activate() → deactivate() → dispose().
 */
export class PersistencePlugin {
  readonly id = "persistence";
  readonly name = "World Persistence";
  readonly version = "0.2.0";

  private active = false;
  private onReload?: () => void;

  constructor(
    private readonly world: WorldState,
    private readonly events: EventBus,
    private readonly config: PersistencePluginConfig = {
      storageKey: "castle-academy-world-v1",
      storageKeyView: "castle-academy-view-v1",
      enabled: true
    },
    private readonly store: Store | null = null
  ) {}

  register(): void {
    // No external dependencies to wire up.
  }

  initialize(): void {
    // Nothing async to prepare.
  }

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  dispose(): void {
    this.deactivate();
    this.onReload = undefined;
  }

  /** Provide a callback invoked by the shell after a successful load, so the renderer can rebuild its meshes. */
  setReloadHandler(handler: () => void): void {
    this.onReload = handler;
  }

  hasSavedWorld(): boolean {
    if (!this.active || !this.config.enabled) return false;
    try {
      return this.storage?.getItem(this.config.storageKey) !== null;
    } catch {
      return false;
    }
  }

  saveWorld(): boolean {
    if (!this.active || !this.config.enabled) return false;
    try {
      const snapshot = this.world.serialize();
      this.storage?.setItem(this.config.storageKey, JSON.stringify(snapshot));
      this.events.emit("world.saved", {
        blockCount: snapshot.blocks.length,
        timestamp: Date.now()
      });
      return true;
    } catch {
      return false;
    }
  }

  loadWorld(): boolean {
    if (!this.active || !this.config.enabled) return false;
    try {
      const raw = this.storage?.getItem(this.config.storageKey);
      if (!raw) return false;

      const snapshot = JSON.parse(raw);
      const ok = this.world.load(snapshot);
      if (ok) {
        this.events.emit("world.loaded", {
          blockCount: this.world.size,
          timestamp: Date.now()
        });
        this.onReload?.();
      }
      return ok;
    } catch {
      return false;
    }
  }

  /** Save layer/section view state (visibility, view mode, section) to localStorage. */
  saveViewState(viewState: Record<string, unknown>): boolean {
    if (!this.active || !this.config.enabled) return false;
    try {
      this.storage?.setItem(this.config.storageKeyView, JSON.stringify(viewState));
      return true;
    } catch {
      return false;
    }
  }

  /** Load previously saved layer/section view state. Returns null if none or data is invalid. */
  loadViewState(): Record<string, unknown> | null {
    if (!this.active || !this.config.enabled) return null;
    try {
      const raw = this.storage?.getItem(this.config.storageKeyView);
      if (!raw) return null;
      const record = JSON.parse(raw) as Record<string, unknown>;
      if (!record || typeof record !== "object" || Array.isArray(record)) return null;

      // 验证 visibilityByLayer：如存在必须是 Record<string, boolean>
      const vblRaw = record.visibilityByLayer;
      if (vblRaw !== undefined) {
        if (typeof vblRaw !== "object" || vblRaw === null || Array.isArray(vblRaw)) return null;
        const vbl = vblRaw as Record<string, unknown>;
        for (const key in vbl) {
          if (typeof vbl[key] !== "boolean") return null;
        }
      }

      // 验证 viewMode：如存在必须是 { type: "all" | "above-ground" | "underground" | "current-layer" | "custom" }
      const vmRaw = record.viewMode;
      if (vmRaw !== undefined) {
        if (typeof vmRaw !== "object" || vmRaw === null || Array.isArray(vmRaw)) return null;
        const vm = vmRaw as { type?: unknown };
        const vmType = vm.type as string | undefined;
        const validTypes = ["all", "above-ground", "underground", "current-layer", "custom"];
        if (typeof vmType !== "string" || !validTypes.includes(vmType)) return null;
      }

      // 验证 section：如存在必须是 { enabled?: boolean, axis?: "x"|"y"|"z", coordinate?: number, keptSide?: "positive"|"negative" }
      const secRaw = record.section;
      if (secRaw !== undefined) {
        if (typeof secRaw !== "object" || secRaw === null || Array.isArray(secRaw)) return null;
        const sec = secRaw as { enabled?: unknown; axis?: unknown; coordinate?: unknown; keptSide?: unknown };
        if (sec.enabled !== undefined && typeof sec.enabled !== "boolean") return null;
        const secAxis = sec.axis as string | undefined;
        if (secAxis !== undefined && !["x", "y", "z"].includes(secAxis)) return null;
        if (sec.coordinate !== undefined && typeof sec.coordinate !== "number") return null;
        const secKept = sec.keptSide as string | undefined;
        if (secKept !== undefined && !["positive", "negative"].includes(secKept)) return null;
      }

      return record;
    } catch {
      return null;
    }
  }

  private get storage(): Store | null {
    return this.store ?? (typeof localStorage !== "undefined" ? (localStorage as unknown as Store) : null);
  }
}
