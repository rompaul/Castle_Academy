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
import type { BridgeSession } from "../features/engineering-design/BridgeSession";
import { deriveElectricalStatus } from "../content/electrical/status";
import type { ElectricalStatusKey } from "../content/electrical/glossary";

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
  /** V51-016 交流类任务文字证据（只留运行时内存，不进任何存档） */
  submitTextEvidence: (missionId: string, text: string) => boolean;
  /** V0.6.1：电力状态消息只读派生（干净世界返回 null，UI 不显示） */
  getElectricalStatus: () => ElectricalStatusKey | null;
  /** DEV-615：注视开关 / 阀门时按一下切换两态（「生活中的开关」） */
  toggleFocusedBlock: () => boolean;
  /** V0.7：两态对照卡只读电力观察；可选方法，旧调用方零影响 */
  getElectricalQuery?: () => import("../plugins/electrical/query").ElectricalQuery;
  /** V0.7.1：桥梁任务会话（内存态，零落盘） */
  bridgeSession: BridgeSession;
  /** V0.7.1：镜头移到桥梁施工点，只改相机 */
  focusV071Site: () => void;
  /** V0.7.1：把设计蓝图存入既有 BlueprintPlugin，不自动放置方块 */
  saveV071Blueprint: () => boolean;
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
      getMissingCapabilities: (id) => engine.missionRuntime.getMissingCapabilities(id),
      submitTextEvidence: (missionId, text) => engine.missionRuntime.submitTextEvidence(missionId, text),
      getElectricalStatus: () => deriveElectricalStatus({
        loadStates: engine.electricalPlugin.getQuery().getLoadStates(),
        blocks: engine.world.all()
      }),
      toggleFocusedBlock: () => engine.toggleFocusedBlock(),
      getElectricalQuery: () => engine.electricalPlugin.getQuery(),
      bridgeSession: engine.bridgeSession,
      focusV071Site: () => engine.focusV071Site(),
      saveV071Blueprint: () => engine.saveV071Blueprint()
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
