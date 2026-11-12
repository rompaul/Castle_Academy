import { useCallback, useEffect, useRef, useState } from "react";
import { Home, ArrowDown, ArrowRight, ArrowUp, ArrowLeft } from "lucide-react";
import { GameCanvas } from "../rendering/GameCanvas";
import type { GameActions } from "../rendering/GameCanvas";
import { BLOCKS, type BlockId } from "../core/world/blocks";
import { Hotbar } from "../ui/Hotbar";
import { HelpPanel } from "../ui/HelpPanel";
import type { SectionViewState } from "../plugins/layers/LayerTypes";
import {
  QUEST_UPDATED_EVENT,
  type QuestState
} from "../plugins/learning/castleQuests";
import { MissionExperience } from "../ui/mission/MissionExperience";

export function App() {
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("grass");
  const [playing, setPlaying] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const [message, setMessage] = useState("Your building world is ready.");
  const [hasSavedWorld, setHasSavedWorld] = useState(false);
  const [buildingTool, setBuildingTool] = useState<"place" | "line" | "fill">("place");
  const [blueprintName, setBlueprintName] = useState("");
  const [measurementTarget, setMeasurementTarget] = useState("");
  const [measurementResult, setMeasurementResult] = useState<string | null>(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const gameRef = useRef<GameActions | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const layerPlugin = gameRef.current?.layerPlugin;
  const [groundVisible, setGroundVisible] = useState<boolean>(true);
  const [undergroundVisible, setUndergroundVisible] = useState<boolean>(true);
  const [sectionState, setSectionState] = useState<SectionViewState>(() =>
    layerPlugin ? layerPlugin.getSectionView() : { enabled: false, axis: "x", coordinate: 0, keptSide: "positive" }
  );

  // 从 LayerPlugin 同步实际图层可见性到 UI state（首次挂载及刷新后）
  useEffect(() => {
    const lp = gameRef.current?.layerPlugin;
    if (!lp) return;
    const groundOn = lp.getAllLayers().some((l) => l.minY >= 0 && (lp.getLayerVisibility(l.id) ?? l.defaultVisible ?? true));
    const underOn = lp.getAllLayers().some((l) => l.maxYExclusive <= 0 && (lp.getLayerVisibility(l.id) ?? l.defaultVisible ?? true));
    setGroundVisible(groundOn);
    setUndergroundVisible(underOn);
  }, [gameRef.current]);

  const handleGroundChange = (checked: boolean) => {
    setGroundVisible(checked);
    const lp = gameRef.current?.layerPlugin;
    if (!lp) return;
    lp.getAllLayers().forEach((layer) => {
      if (layer.minY >= 0) lp.setLayerVisibility(layer.id, checked);
    });
  };

  const handleUndergroundChange = (checked: boolean) => {
    setUndergroundVisible(checked);
    const lp = gameRef.current?.layerPlugin;
    if (!lp) return;
    lp.getAllLayers().forEach((layer) => {
      if (layer.maxYExclusive <= 0) lp.setLayerVisibility(layer.id, checked);
    });
  };

  // 订阅 LayerPlugin 剖面状态变更，驱动 UI 重新渲染
  useEffect(() => {
    const lp = gameRef.current?.layerPlugin;
    if (!lp) return;
    const unsub = lp.onSectionChange?.((section: SectionViewState) => setSectionState(section));
    return () => {
      unsub();
    };
  }, [gameRef.current]);

  // 订阅图层可见性变更，驱动 UI 按钮状态同步
  useEffect(() => {
    const lp = gameRef.current?.layerPlugin;
    if (!lp) return;
    const unsub = lp.onVisibilityChange?.(() => {
      const allLayers = lp.getAllLayers();
      const groundOn = allLayers.some((l) => l.minY >= 0 && (lp.getLayerVisibility(l.id) ?? l.defaultVisible ?? true));
      const underOn = allLayers.some((l) => l.maxYExclusive <= 0 && (lp.getLayerVisibility(l.id) ?? l.defaultVisible ?? true));
      setGroundVisible(groundOn);
      setUndergroundVisible(underOn);
    });
    return () => {
      unsub();
    };
  }, [gameRef.current]);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setMessage((current) => current === text ? "" : current), 2600);
  }, []);

  // 城堡水务任务（V0.5）：订阅任务事件驱动面板与完成 toast
  const [quests, setQuests] = useState<QuestState[]>([]);
  // 悬停水信息（Scope 成果 7）：渲染器 raycast 后回传状态文本
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    setQuests(game.getQuests());
    const events = game.events;
    const unsubs = [
      events.on<{ quests: QuestState[] }>(QUEST_UPDATED_EVENT, (e) => setQuests(e.payload.quests)),
      // V0.51：完成反馈统一由 RewardReveal 提供，移除迁移期重复的 quest.completed /
      // castle.quests.allCompleted toast 订阅（旧 quest-panel 仍保留至 STOP GATE-2）
      events.on<{ text: string | null }>("world.hover.info", (e) => setHoverInfo(e.payload.text))
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [gameRef.current, showMessage]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const onPersistenceReady = useCallback(() => {
    setHasSavedWorld(gameRef.current?.persistence.hasSavedWorld() ?? false);
  }, []);

  useEffect(() => {
    const toolOrder: Array<"place" | "line" | "fill"> = ["place", "line", "fill"];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlaying(false);
      const index = Number(event.key) - 1;
      if (index >= 0 && index < BLOCKS.length) setSelectedBlock(BLOCKS[index].id);
      if (event.key === "Tab") {
        event.preventDefault();
        const current = toolOrder.indexOf(buildingTool);
        const next = toolOrder[(current + 1) % toolOrder.length];
        setBuildingTool(next);
        const bt = gameRef.current?.buildingTools;
        if (bt) bt.setTool(next);
        showMessage(`Building tool: ${next}`);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buildingTool, gameRef]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">CA</div>
          <div>
            <div className="brand-name">CASTLE ACADEMY</div>
            <div className="brand-subtitle">BUILD · EXPLORE · LEARN</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="version-pill">V0.6.0</span>
          <button className="subtle-button" onClick={() => setLayerPanelOpen((v) => !v)}>
            {layerPanelOpen ? "Hide layers" : "Layers"}
          </button>
          <button className="subtle-button" onClick={() => setHelpOpen((value) => !value)}>
            {helpOpen ? "Hide guide" : "Controls"}
          </button>
          <button className="subtle-button" onClick={() => {
            gameRef.current?.reset();
            showMessage("World reset.");
          }}>Reset world</button>
          <button className="subtle-button" disabled={!hasSavedWorld} onClick={() => {
            if (gameRef.current?.persistence.loadWorld()) showMessage("World loaded.");
          }}>Load world</button>
          <button className="subtle-button" onClick={() => {
            if (gameRef.current?.persistence.saveWorld()) {
              showMessage("World saved.");
              setHasSavedWorld(true);
            }
          }}>Save world</button>

          <div className="v03-tools">
            <label className="tool-label">Tool:</label>
            <select
              className="tool-select"
              value={buildingTool}
              onChange={(e) => {
                const next = e.target.value as "place" | "line" | "fill";
                setBuildingTool(next);
                const bt = gameRef.current?.buildingTools;
                if (bt) bt.setTool(next);
                showMessage(`Building tool: ${next}`);
              }}
            >
              <option value="place">Place</option>
              <option value="line">Line</option>
              <option value="fill">Fill</option>
            </select>

            <label className="tool-label">Blueprint:</label>
            <input
              className="tool-input"
              value={blueprintName}
              onChange={(e) => setBlueprintName(e.target.value)}
              placeholder="name"
            />
            <button className="subtle-button" disabled={!blueprintName} onClick={() => {
              const bp = gameRef.current?.blueprint;
              if (!bp || !blueprintName) return;
              const placed = bp.placeBlueprint(blueprintName, { x: 0, y: 0, z: 0 });
              if (placed > 0) {
                showMessage(`Blueprint "${blueprintName}" placed (${placed} blocks).`);
              } else {
                showMessage("Blueprint not found.");
              }
            }}>Place blueprint</button>

            <label className="tool-label">Measure target:</label>
            <input
              className="tool-input"
              value={measurementTarget}
              onChange={(e) => setMeasurementTarget(e.target.value)}
              placeholder="blocks"
            />
            <button className="subtle-button" onClick={() => {
              const m = gameRef.current?.measurement;
              if (!m) return;
              const target = Number(measurementTarget);
              if (!Number.isFinite(target)) {
                showMessage("Enter a valid number.");
                return;
              }
              m.setChallenge({ type: "distance", target, tolerance: 0.5 });
              const result = m.measureDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
              const check = m.checkChallenge(result);
              setMeasurementResult(check.message);
              showMessage(check.message);
              gameRef.current?.events.emit("measurement.used", { tool: "distance" });
            }}>Check challenge</button>
            {measurementResult && <span className="tool-hint">{measurementResult}</span>}
          </div>
        </div>
      </header>

      {quests.length > 0 && (
        <div className="quest-panel" role="region" aria-label="Castle water quests">
          <div className="quest-panel-header">🏰 城堡水务任务</div>
          {quests.map((quest) => (
            <div key={quest.id} className={`quest-item ${quest.complete ? "quest-done" : ""}`} title={quest.hint}>
              <div className="quest-item-title">
                {quest.complete ? "✅" : quest.direction === "fill" ? "💧" : "🛠️"} {quest.title}
              </div>
              {!quest.complete && <div className="quest-item-brief">{quest.briefing}</div>}
              {!quest.complete && <div className="quest-item-hint">👉 {quest.hint}</div>}
              {!quest.complete && (
                <div className="quest-bar">
                  <div className="quest-bar-fill" style={{ width: `${Math.round(quest.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
          <div className="quest-panel-footer">
            💡 左下角热栏选方块，左键放置 / 右键拆除；瞄准方块可查看水信息；顶栏 Measure 可量高差
          </div>
        </div>
      )}

      {hoverInfo && (
        <div className="hover-info" role="status">{hoverInfo}</div>
      )}

      {layerPanelOpen && gameRef.current?.layerPlugin && (
        <div className="layer-panel" role="region" aria-label="Layer controls">
          <div className="layer-panel-header">
            <span className="layer-panel-title">Layers</span>
            <button className="subtle-button" onClick={() => setLayerPanelOpen(false)}>Close</button>
          </div>

          {/* Layer: 图标标识，只分 Ground / Underground，可同时选中 */}
          <div className="layer-section">
            <label className="layer-label">Layers</label>
            <div className="layer-icons">
              <label className={`layer-icon ${groundVisible ? "active" : ""}`} title="Ground">
                <input
                  type="checkbox"
                  checked={groundVisible}
                  onChange={(e) => handleGroundChange(e.target.checked)}
                  style={{ display: "none" }}
                />
                <Home size={16} />
                <span className="layer-icon-label">Ground</span>
              </label>
              <label className={`layer-icon ${undergroundVisible ? "active" : ""}`} title="Underground">
                <input
                  type="checkbox"
                  checked={undergroundVisible}
                  onChange={(e) => handleUndergroundChange(e.target.checked)}
                  style={{ display: "none" }}
                />
                <ArrowDown size={16} />
                <span className="layer-icon-label">Underground</span>
              </label>
            </div>
          </div>

          {/* Section: 图标标识，Axis X / Y / Z */}
          <div className="layer-section">
            <label className="layer-label">Section</label>
            <div className="layer-row">
              <label className="layer-checkbox-label" style={{ flex: 1 }}>
                <input
                  type="checkbox"
                  checked={sectionState.enabled}
                  onChange={(e) => layerPlugin?.setSectionView({ enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="layer-icons">
              <button
                className={`layer-icon ${sectionState.axis === "x" ? "active" : ""}`}
                onClick={() => layerPlugin?.setSectionView({ axis: "x" })}
                title="Axis X"
              >
                <ArrowRight size={16} />
                <span className="layer-icon-label">Axis X</span>
              </button>
              <button
                className={`layer-icon ${sectionState.axis === "y" ? "active" : ""}`}
                onClick={() => layerPlugin?.setSectionView({ axis: "y" })}
                title="Axis Y"
              >
                <ArrowUp size={16} />
                <span className="layer-icon-label">Axis Y</span>
              </button>
              <button
                className={`layer-icon ${sectionState.axis === "z" ? "active" : ""}`}
                onClick={() => layerPlugin?.setSectionView({ axis: "z" })}
                title="Axis Z"
              >
                <ArrowLeft size={16} />
                <span className="layer-icon-label">Axis Z</span>
              </button>
            </div>
            <div className="layer-row">
              <input
                type="number"
                className="layer-select"
                value={sectionState.coordinate}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isInteger(v)) layerPlugin?.setSectionView({ coordinate: v });
                }}
                placeholder="coordinate"
              />
            </div>
            <div className="layer-row">
              <label className="layer-checkbox-label" style={{ flex: 1 }}>
                <input
                  type="checkbox"
                  checked={sectionState.keptSide === "positive"}
                  onChange={(e) => layerPlugin?.setSectionView({ keptSide: e.target.checked ? "positive" : "negative" })}
                />
                Keep +
              </label>
              <label className="layer-checkbox-label" style={{ flex: 1 }}>
                <input
                  type="checkbox"
                  checked={sectionState.keptSide === "negative"}
                  onChange={(e) => layerPlugin?.setSectionView({ keptSide: e.target.checked ? "negative" : "positive" })}
                />
                Keep −
              </label>
            </div>
          </div>
        </div>
      )}

      <section className="game-stage">
        <GameCanvas
          selectedBlock={selectedBlock}
          onPlayingChange={setPlaying}
          onMessage={showMessage}
          onPersistenceReady={onPersistenceReady}
          gameRef={gameRef}
        />
        <div className="crosshair" aria-hidden="true"><span /></div>

        <div className="world-label">
          <span className="live-dot" /> CREATIVE WORLD
          <span className="world-divider">/</span>
          BUILD ZONE 32 × 32
        </div>

        {!playing && (
          <div className="welcome-overlay">
            <div className="welcome-card">
              <div className="eyebrow">YOUR WORLD IS WAITING</div>
              <h1>Imagine it.<br /><em>Build it.</em></h1>
              <p>A small world for big ideas. Start with a few blocks and make something yours.</p>
              <button className="primary-button" onClick={() => {
                gameRef.current?.requestPointerLock();
                setHelpOpen(false);
              }}>Enter World <span>→</span></button>
              <div className="welcome-footnote">WASD to move · Mouse to look · Click to build</div>
            </div>
          </div>
        )}

        {helpOpen && playing && <HelpPanel onClose={() => setHelpOpen(false)} />}

        {message && <div className="toast">{message}</div>}

        <div className="bottom-hud">
          <div className="hud-caption">SELECT A MATERIAL</div>
          <Hotbar selected={selectedBlock} onSelect={setSelectedBlock} />
          <div className="hud-tip">LEFT CLICK · PLACE <span>│</span> RIGHT CLICK · REMOVE</div>
        </div>
      </section>

      {/* V0.51 任务体验层：fixed overlay，不改变 canvas 视口尺寸 */}
      <MissionExperience gameRef={gameRef} />

      <footer className="footer">
        <span>CASTLE ACADEMY <b>V0.6.0</b></span>
        <span>BUILD FIRST. SIMULATE NEXT. LEARN THROUGH BUILDING.</span>
        <span>LOCAL CREATIVE WORLD</span>
      </footer>
    </main>
  );
}
