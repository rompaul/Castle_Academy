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
import type { LayerPlugin } from "../plugins/layers/LayerPlugin";
import type { ViewMode, SectionViewState } from "../plugins/layers/LayerTypes";
import type { QuestState } from "../plugins/learning/castleQuests";
import type { MissionDefinition, MissionSummary } from "../content/missions/types";
import type { AgeBand, LearnerProfile } from "../plugins/learner/types";
import type { MissionRuntimePlugin } from "../plugins/mission/MissionRuntimePlugin";
import type { LearnerProfilePlugin } from "../plugins/learner/LearnerProfilePlugin";

export interface GameActions {
  reset: () => void;
  requestPointerLock: () => void;
  world: WorldState;
  events: EventBus;
  persistence: PersistencePlugin;
  buildingTools: BuildingToolsPlugin;
  blueprint: BlueprintPlugin;
  measurement: MeasurementPlugin;
  layerPlugin: LayerPlugin;
  reloadFromWorld: () => void;
  getQuests: () => QuestState[];
  /** —— V0.51 任务体验接入点 —— */
  missionRuntime: MissionRuntimePlugin;
  learnerProfile: LearnerProfilePlugin;
  getMissions: () => MissionSummary[];
  getMissionDefinitions: () => readonly MissionDefinition[];
  getActiveProfile: () => LearnerProfile | null;
  listProfiles: () => LearnerProfile[];
  switchProfile: (id: string) => boolean;
  createProfile: (
    nickname: string,
    ageBand: AgeBand
  ) => { ok: true; profile: LearnerProfile } | { ok: false; reason: string };
  activateMission: (id: string) => boolean;
  useHint: (id: string) => number;
  getHintsUsed: (id: string) => number;
  getMissingCapabilities: (id: string) => string[];
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

    // Restore layer/section view state so visibility/mode/section survive refresh (V0.4).
    const savedView = persistence.loadViewState();
    if (savedView) {
      const visibilityByLayer = savedView.visibilityByLayer as Record<string, boolean> | undefined;
      if (visibilityByLayer) {
        for (const layerId of Object.keys(visibilityByLayer)) {
          engine.layerPlugin.setLayerVisibility(layerId, visibilityByLayer[layerId]);
        }
      }
      const viewMode = savedView.viewMode as ViewMode | undefined;
      if (viewMode) {
        engine.layerPlugin.setViewMode(viewMode);
      }
      const section = savedView.section as Partial<SectionViewState> | undefined;
      if (section) {
        engine.layerPlugin.setSectionView(section);
      }
    }

    // Expose gameRef BEFORE onPersistenceReady so App can read persistence state
    // (e.g. hasSavedWorld) when the ready callback fires.
    gameRef.current = {
      reset: () => engine.reset(),
      requestPointerLock: () => engine.player.requestPointerLock(),
      world: engine.world,
      events: engine.events,
      persistence,
      buildingTools: engine.buildingTools,
      blueprint: engine.blueprint,
      measurement: engine.measurement,
      layerPlugin: engine.layerPlugin,
      reloadFromWorld: () => engine.reloadFromWorld(),
      getQuests: () => engine.missionRuntime.getQuests(),
      missionRuntime: engine.missionRuntime,
      learnerProfile: engine.learnerProfile,
      getMissions: () => engine.missionRuntime.getMissions(),
      getMissionDefinitions: () => engine.missionRuntime.getDefinitions(),
      getActiveProfile: () => engine.learnerProfile.getActiveProfile(),
      listProfiles: () => engine.learnerProfile.listProfiles(),
      switchProfile: (id) => engine.learnerProfile.switchProfile(id),
      createProfile: (nickname, ageBand) => engine.learnerProfile.createProfile(nickname, ageBand),
      activateMission: (id) => engine.missionRuntime.activateMission(id),
      useHint: (id) => engine.missionRuntime.useHint(id),
      getHintsUsed: (id) => engine.missionRuntime.getHintsUsed(id),
      getMissingCapabilities: (id) => engine.missionRuntime.getMissingCapabilities(id)
    };

    // Persist layer/section view state whenever it changes (V0.4).
    const persistViewState = () => {
      const visibilityByLayer: Record<string, boolean> = {};
      for (const layer of engine.layerPlugin.getAllLayers()) {
        visibilityByLayer[layer.id] = engine.layerPlugin.getLayerVisibility(layer.id) ?? false;
      }
      persistence.saveViewState({
        visibilityByLayer,
        viewMode: engine.layerPlugin.getViewMode(),
        section: engine.layerPlugin.getSectionView()
      });
    };
    const unsubscribeViewState = [
      engine.events.on("layer.visibility.changed", persistViewState),
      engine.events.on("view.mode.changed", persistViewState),
      engine.events.on("section.view.changed", persistViewState)
    ];

    onPersistenceReady?.();

    const onPointerLock = () => onPlayingChange(document.pointerLockElement === engine.renderer.domElement);
    document.addEventListener("pointerlockchange", onPointerLock);

    return () => {
      unsubscribeViewState.forEach((unsub) => unsub());
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
