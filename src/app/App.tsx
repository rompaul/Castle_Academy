import { useCallback, useEffect, useRef, useState } from "react";
import { Home, ArrowDown, ArrowRight, ArrowUp, ArrowLeft } from "lucide-react";
import { GameCanvas } from "../rendering/GameCanvas";
import type { GameActions } from "../rendering/GameCanvas";
import { type BlockId } from "../core/world/blocks";
import {
  assignToSlot, DEFAULT_QUICK_SLOTS, QUICK_SLOT_COUNT,
} from "../core/world/blockCategories";
import { Hotbar } from "../ui/Hotbar";
import { BlockPalette } from "../ui/BlockPalette";
import { HelpPanel } from "../ui/HelpPanel";
import type { SectionViewState } from "../plugins/layers/LayerTypes";
import {
  QUEST_UPDATED_EVENT,
  type QuestState
} from "../plugins/learning/castleQuests";
import { MissionExperience } from "../ui/mission/MissionExperience";
import { isTypingTarget } from "../ui/mission/v07InteractionModel";

export function App() {
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("grass");
  // DDR-0002：MC 式快捷格。只在运行时内存中，绝不写进任何持久化存储。
  const [quickSlots, setQuickSlots] = useState<readonly BlockId[]>(DEFAULT_QUICK_SLOTS);
  const [activeSlot, setActiveSlot] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  // DDR-0002：点快捷格 = 切格 + 选中该格方块
  const selectSlot = (index: number) => {
    setActiveSlot(index);
    setSelectedBlock(quickSlots[index]);
  };

  // DDR-0002：在分类面板点方块 = 放进当前格并立即选中（纯函数保证 9 格互不重复）
  const assignBlock = (id: BlockId) => {
    setQuickSlots((current) => assignToSlot(current, activeSlot, id));
    setSelectedBlock(id);
  };

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
      if (event.key === "Escape") {
        setPlaying(false);
        setPaletteOpen(false);
        return;
      }
      // V07-018 / DEV-704：输入框里一律不触发世界快捷键（数字键 / E / F / Tab / 滚轮）；
      // Tab 在输入时不拦截，保留浏览器默认的焦点切换。
      const target = event.target as HTMLElement | null;
      if (isTypingTarget(target)) return;
      // DDR-0002：数字键 1–9 切快捷格；默认 9 格仍为 BLOCKS[0..8]，V0.5 基线语义不变。
      const index = Number(event.key) - 1;
      if (index >= 0 && index < QUICK_SLOT_COUNT) {
        setActiveSlot(index);
        setSelectedBlock(quickSlots[index]);
      }
      // E 打开 / 关闭「所有方块」分类面板（MC 式物品栏入口）
      if (event.key.toLowerCase() === "e" && !event.repeat) {
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const current = toolOrder.indexOf(buildingTool);
        const next = toolOrder[(current + 1) % toolOrder.length];
        setBuildingTool(next);
        const bt = gameRef.current?.buildingTools;
        if (bt) bt.setTool(next);
        showMessage(`Building tool: ${next}`);
      }
      // DEV-615：注视开关 / 阀门时按 F 切换开合，像按生活中的开关一样。
      // 不占用左键（相邻格放置）与右键（拆除），V0.5 基线键位零变化。
      if (event.key.toLowerCase() === "f" && !event.repeat) {
        const toggled = gameRef.current?.toggleFocusedBlock() ?? false;
        showMessage(toggled ? "Switch: pressed." : "Look at a switch or valve, then press F.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buildingTool, gameRef, quickSlots]);

  // DDR-0002：滚轮切快捷格；分类面板打开或焦点在输入框时不抢占滚动/输入。
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (paletteOpen || event.deltaY === 0) return;
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      const step = event.deltaY > 0 ? 1 : -1;
      const next = (activeSlot + step + QUICK_SLOT_COUNT) % QUICK_SLOT_COUNT;
      setActiveSlot(next);
      setSelectedBlock(quickSlots[next]);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [activeSlot, quickSlots, paletteOpen]);

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
          <span className="version-pill">V0.6.1</span>
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

        {paletteOpen && (
          <BlockPalette
            activeSlot={activeSlot}
            assigned={quickSlots}
            onAssign={assignBlock}
            onClose={() => setPaletteOpen(false)}
          />
        )}

        <div className="bottom-hud">
          <div className="hud-caption">SELECT A MATERIAL</div>
          <Hotbar
            slots={quickSlots}
            activeSlot={activeSlot}
            selected={selectedBlock}
            onSelectSlot={selectSlot}
            onTogglePalette={() => setPaletteOpen((open) => !open)}
            paletteOpen={paletteOpen}
          />
          <div className="hud-tip">LEFT CLICK · PLACE <span>│</span> RIGHT CLICK · REMOVE</div>
        </div>
      </section>

      {/* V0.51 任务体验层：fixed overlay，不改变 canvas 视口尺寸 */}
      <MissionExperience gameRef={gameRef} />

      <footer className="footer">
        <span>CASTLE ACADEMY <b>V0.6.1</b></span>
        <span>BUILD FIRST. SIMULATE NEXT. LEARN THROUGH BUILDING.</span>
        <span>LOCAL CREATIVE WORLD</span>
      </footer>
    </main>
  );
}
