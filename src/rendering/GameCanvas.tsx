import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { BlockId } from "../core/world/blocks";
import type { WorldState } from "../core/world/WorldState";
import type { EventBus } from "../core/events/EventBus";
import { ThreeWorldRenderer } from "./ThreeWorldRenderer";
import { PersistencePlugin } from "../plugins/persistence/PersistencePlugin";
import type { BuildingToolsPlugin } from "../plugins/building-tools/BuildingToolsPlugin";
import type { BlueprintPlugin } from "../plugins/blueprint/BlueprintPlugin";
import type { MeasurementPlugin } from "../plugins/measurement/MeasurementPlugin";

export interface GameActions {
  reset: () => void;
  requestPointerLock: () => void;
  world: WorldState;
  events: EventBus;
  persistence: PersistencePlugin;
  buildingTools: BuildingToolsPlugin;
  blueprint: BlueprintPlugin;
  measurement: MeasurementPlugin;
  reloadFromWorld: () => void;
}

interface Props {
  selectedBlock: BlockId;
  onPlayingChange: (playing: boolean) => void;
  onMessage: (message: string) => void;
  onPersistenceReady?: () => void;
  gameRef: MutableRefObject<GameActions | null>;
}

export function GameCanvas({ selectedBlock, onPlayingChange, onMessage, onPersistenceReady, gameRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreeWorldRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: ThreeWorldRenderer;
    try {
      engine = new ThreeWorldRenderer(host, onMessage);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown graphics initialization error";
      onMessage(`3D graphics could not start. Please enable WebGL or try Chrome/Edge. (${detail})`);
      return;
    }
    engineRef.current = engine;

    const persistence = new PersistencePlugin(engine.world, engine.events);
    persistence.setReloadHandler(() => engine.reloadFromWorld());
    persistence.activate();

    // Restore any saved world so creations survive page refresh (V0.2 persistence).
    if (persistence.hasSavedWorld()) {
      persistence.loadWorld();
    }

    onPersistenceReady?.();

    gameRef.current = {
      reset: () => engine.reset(),
      requestPointerLock: () => engine.player.requestPointerLock(),
      world: engine.world,
      events: engine.events,
      persistence,
      buildingTools: engine.buildingTools,
      blueprint: engine.blueprint,
      measurement: engine.measurement,
      reloadFromWorld: () => engine.reloadFromWorld()
    };

    const onPointerLock = () => onPlayingChange(document.pointerLockElement === engine.renderer.domElement);
    document.addEventListener("pointerlockchange", onPointerLock);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLock);
      engine.buildingTools.dispose();
      engine.blueprint.dispose();
      engine.measurement.dispose();
      persistence.dispose();
      gameRef.current = null;
      engineRef.current = null;
      engine.dispose();
    };
  }, [gameRef, onMessage, onPlayingChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (host) host.dataset.selectedBlock = selectedBlock;
  }, [selectedBlock]);

  return <div className="game-canvas" ref={hostRef} data-selected-block={selectedBlock} />;
}
