import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "../rendering/GameCanvas";
import type { GameActions } from "../rendering/GameCanvas";
import { BLOCKS, type BlockId } from "../core/world/blocks";
import { Hotbar } from "../ui/Hotbar";
import { HelpPanel } from "../ui/HelpPanel";
import type { ViewMode } from "../plugins/layers/LayerTypes";

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
  const layers = layerPlugin ? layerPlugin.getAllLayers() : [];
  const activeLayerId = layerPlugin ? layerPlugin.getActiveLayerId() : "";
  const viewMode = layerPlugin ? layerPlugin.getViewMode() : { type: "all" };

  const getLayerVisibility = (layerId: string): boolean => {
    const v = layerPlugin?.getLayerVisibility(layerId);
    if (v === undefined) {
      const def = layers.find((l) => l.id === layerId);
      return def ? def.defaultVisible : true;
    }
    return v;
  };

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setMessage((current) => current === text ? "" : current), 2600);
  }, []);

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
          <span className="version-pill">V0.3</span>
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
            }}>Check challenge</button>
            {measurementResult && <span className="tool-hint">{measurementResult}</span>}
          </div>
        </div>
      </header>

      {layerPanelOpen && gameRef.current?.layerPlugin && (
        <div className="layer-panel" role="region" aria-label="Layer controls">
          <div className="layer-panel-header">
            <span className="layer-panel-title">Layers</span>
            <button className="subtle-button" onClick={() => setLayerPanelOpen(false)}>Close</button>
          </div>
          <div className="layer-section">
            <label className="layer-label">View mode</label>
            <select
              className="layer-select"
              value={viewMode.type}
              onChange={(e) => {
                const mode = e.target.value as Extract<ViewMode, { type: string }>["type"];
                layerPlugin?.setViewMode({ type: mode });
              }}
            >
              <option value="all">All layers</option>
              <option value="above-ground">Above ground</option>
              <option value="underground">Underground</option>
              <option value="current-layer">Current layer only</option>
            </select>
          </div>
          <div className="layer-section">
            <label className="layer-label">Active layer</label>
            <span className="layer-active-value">{activeLayerId}</span>
          </div>
          <div className="layer-section">
            <label className="layer-label">Visibility</label>
            <div className="layer-list">
              {layers.map((layer) => (
                <div key={layer.id} className="layer-row">
                  <label className="layer-checkbox-label">
                    <input
                      type="checkbox"
                      checked={getLayerVisibility(layer.id)}
                      onChange={(e) => layerPlugin?.setLayerVisibility(layer.id, e.target.checked)}
                    />
                    {layer.label}
                  </label>
                  <span className="layer-kind">{layer.kind}</span>
                  <span className="layer-range">Y {layer.minY}–{layer.maxYExclusive}</span>
                  <span className={layer.buildable ? "layer-tag buildable" : "layer-tag readonly"}>
                    {layer.buildable ? "buildable" : "view only"}
                  </span>
                </div>
              ))}
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

      <footer className="footer">
        <span>CASTLE ACADEMY <b>V0.3</b></span>
        <span>BUILD FIRST. SIMULATE NEXT. LEARN THROUGH BUILDING.</span>
        <span>LOCAL CREATIVE WORLD</span>
      </footer>
    </main>
  );
}
