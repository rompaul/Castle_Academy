import { WorldState } from "../../core/world/WorldState";
import { EventBus } from "../../core/events/EventBus";

export interface PersistencePluginConfig {
  storageKey: string;
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

  private get storage(): Store | null {
    return this.store ?? (typeof localStorage !== "undefined" ? (localStorage as unknown as Store) : null);
  }
}
