/**
 * V0.7.1 P3 — 桥梁任务设计工作台（DOM overlay，不改 Canvas 尺寸）。
 *
 * 所有数字来自 BridgeSession 的纯函数派生结果；测量复用 MeasurementPlugin。
 * 输入框内的键盘事件由 App 的 typing guard 统一拦截，不触发世界快捷键。
 */
import { useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import type { GameActions } from "../../rendering/GameCanvas";
import type { GridPosition } from "../../core/world/coordinates";
import type { BridgeSessionSnapshot } from "../../features/engineering-design/BridgeSession";
import { BRIDGE_SCENARIO } from "../../features/engineering-design/scenario";
import { bridgeDeckBounds } from "../../features/engineering-design/design";
import { DESIGN_STAGE_ORDER } from "../../features/engineering-design/session";
import {
  BRIDGE_KNOWLEDGE_SNIPPETS,
  BRIDGE_NEXT_MISSION_TEASER,
  BRIDGE_RESULT_MESSAGES,
  BRIDGE_SITE_MAP_LABELS,
  BRIDGE_STAGE_LABELS,
  BRIDGE_STORY,
  BRIDGE_VALIDATION_MESSAGES,
  bridgeHintForAge
} from "../../content/engineering/bridgeContent";

interface Props {
  gameRef: MutableRefObject<GameActions | null>;
  onClose: () => void;
}

const MAP_MIN_X = 5;
const MAP_MAX_X = 15;
const MAP_MIN_Z = 3;
const MAP_MAX_Z = 11;

export function V071BridgeWorkbench({ gameRef, onClose }: Props) {
  const session = gameRef.current?.bridgeSession;
  const [snapshot, setSnapshot] = useState<BridgeSessionSnapshot | null>(
    () => session?.getSnapshot() ?? null
  );
  const [measureStart, setMeasureStart] = useState<GridPosition | null>(null);
  const [measureEnd, setMeasureEnd] = useState<GridPosition | null>(null);
  const [measureValue, setMeasureValue] = useState<number | null>(null);
  const [openKnowledge, setOpenKnowledge] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState(false);

  useEffect(() => {
    if (!session) return;
    return session.subscribe(setSnapshot);
  }, [session]);

  useEffect(() => {
    const measurement = gameRef.current?.measurement;
    measurement?.setChallenge({
      type: "distance",
      target: BRIDGE_SCENARIO.riverSpan,
      tolerance: 0,
      description: "量出河道两岸之间的距离"
    });
    return () => measurement?.clearChallenge();
  }, [gameRef]);

  const ageBand = gameRef.current?.getActiveProfile()?.ageBand;
  const bounds = useMemo(() => {
    if (!snapshot) return null;
    return bridgeDeckBounds(BRIDGE_SCENARIO, snapshot.computed, snapshot.input);
  }, [snapshot]);

  if (!snapshot || !bounds || !session) return null;

  const stageIndex = DESIGN_STAGE_ORDER.indexOf(snapshot.stage);
  const inConstruction = snapshot.stage === "construction"
    || snapshot.stage === "construction-validation";
  const isCompleted = snapshot.stage === "completed";

  const onMapCellClick = (x: number, z: number) => {
    const point: GridPosition = { x, y: 1, z };
    if (!measureStart || measureEnd) {
      setMeasureStart(point);
      setMeasureEnd(null);
      setMeasureValue(null);
      return;
    }
    setMeasureEnd(point);
    const result = gameRef.current?.measurement.measureDistance(measureStart, point);
    if (!result) {
      setMeasureValue(null);
      return;
    }
    // 网格宽度按「覆盖几格」读数：同轴的起止格要 +1；仍由 MeasurementPlugin 提供距离事实。
    const dx = Math.abs(point.x - measureStart.x);
    const dz = Math.abs(point.z - measureStart.z);
    const gridCount = (dx === 0 || dz === 0)
      ? Math.max(dx, dz) + 1
      : Math.round(result.value);
    setMeasureValue(gridCount);
  };

  const useMeasurement = () => {
    if (measureValue === null) return;
    session.setMeasuredRiverSpan(measureValue);
    if (snapshot.stage === "briefing") session.goStage("site-survey");
  };

  const requestValidation = () => {
    if (snapshot.stage === "guided-design") session.goStage("design-validation");
  };

  const enterConstruction = () => {
    if (session.enterConstruction()) {
      gameRef.current?.saveV071Blueprint();
      gameRef.current?.focusV071Site();
    }
  };

  const returnToDesign = () => {
    if (!confirmReturn) {
      setConfirmReturn(true);
      return;
    }
    session.returnToDesign();
    setConfirmReturn(false);
  };

  const evidence = snapshot.evidence;
  const placed = evidence?.placedRequiredCells ?? 0;
  const totalCells = evidence?.totalRequiredCells ?? snapshot.computed.deckArea;

  return (
    <section className="ca-v071-workbench" data-testid="v071-workbench" aria-label="桥梁设计工作台">
      <header className="ca-v071-head">
        <div>
          <div className="ca-v071-eyebrow">修复王国旧桥 · 工程委托</div>
          <h2>先设计，再建造</h2>
        </div>
        <button type="button" className="ca-btn ca-btn-sm" onClick={onClose}>收起工作台</button>
      </header>

      <p className="ca-v071-story">{BRIDGE_STORY.briefing}</p>
      <p className="ca-v071-note">{BRIDGE_STORY.safetyNote}</p>

      <ol className="ca-v071-steps" aria-label="任务步骤">
        {DESIGN_STAGE_ORDER.map((stage, index) => (
          <li
            key={stage}
            className={index === stageIndex ? "is-current" : index < stageIndex ? "is-done" : ""}
            aria-current={index === stageIndex ? "step" : undefined}
          >
            {BRIDGE_STAGE_LABELS[stage]}
          </li>
        ))}
      </ol>

      <div className="ca-v071-grid-layout">
        <div className="ca-v071-panel">
          <h3>施工地点</h3>
          <div className="ca-v071-map" role="group" aria-label="局部地图">
            {Array.from({ length: MAP_MAX_Z - MAP_MIN_Z + 1 }, (_, row) => {
              const z = MAP_MIN_Z + row;
              return (
                <div className="ca-v071-map-row" key={z}>
                  {Array.from({ length: MAP_MAX_X - MAP_MIN_X + 1 }, (_, col) => {
                    const x = MAP_MIN_X + col;
                    const isRiver = x >= BRIDGE_SCENARIO.riverMinX && x <= BRIDGE_SCENARIO.riverMaxX;
                    const isBank = !isRiver && z >= BRIDGE_SCENARIO.riverMinZ && z <= BRIDGE_SCENARIO.riverMaxZ
                      && (x === BRIDGE_SCENARIO.riverMinX - 1 || x === BRIDGE_SCENARIO.rightBankX);
                    const isDeck = x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
                    const isStart = measureStart?.x === x && measureStart?.z === z;
                    const isEnd = measureEnd?.x === x && measureEnd?.z === z;
                    const className = [
                      "ca-v071-cell",
                      isRiver ? "is-river" : "",
                      isBank ? "is-bank" : "",
                      isDeck ? "is-deck" : "",
                      isDeck && isCompleted ? "is-complete" : "",
                      isStart ? "is-start" : "",
                      isEnd ? "is-end" : ""
                    ].filter(Boolean).join(" ");
                    return (
                      <button
                        type="button"
                        key={`${x},${z}`}
                        className={className}
                        title={`(${x}, ${z})`}
                        aria-label={`格子 ${x},${z}${isRiver ? BRIDGE_SITE_MAP_LABELS.river : ""}${isDeck ? BRIDGE_SITE_MAP_LABELS.designOutline : ""}`}
                        onClick={() => onMapCellClick(x, z)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="ca-v071-legend">
            <span><i className="dot river" />{BRIDGE_SITE_MAP_LABELS.river}</span>
            <span><i className="dot bank" />{BRIDGE_SITE_MAP_LABELS.leftBank}</span>
            <span><i className="dot deck" />{BRIDGE_SITE_MAP_LABELS.designOutline}</span>
          </div>
          <p className="ca-v071-tip">{BRIDGE_STORY.siteHint}</p>
          <div className="ca-v071-measure">
            <div>
              测量起点：{measureStart ? `(${measureStart.x}, ${measureStart.z})` : "还没放"}
              <br />
              测量终点：{measureEnd ? `(${measureEnd.x}, ${measureEnd.z})` : "还没放"}
              <br />
              读数：{measureValue === null ? "先点两个格子" : `${measureValue} 格`}
            </div>
            <button
              type="button"
              className="ca-btn ca-btn-primary ca-btn-sm"
              disabled={measureValue === null || measureValue <= 0}
              onClick={useMeasurement}
              data-testid="v071-use-measurement"
            >
              使用这个测量值
            </button>
          </div>
        </div>

        <div className="ca-v071-panel">
          <h3>我的设计</h3>
          <label className="ca-v071-field">
            桥面长度：{snapshot.input.deckLength} 格
            <input
              type="range"
              min={BRIDGE_SCENARIO.deckLengthRange[0]}
              max={BRIDGE_SCENARIO.deckLengthRange[1]}
              step={1}
              value={snapshot.input.deckLength}
              onChange={(event) => session.setDeckLength(Number(event.target.value))}
              data-testid="v071-deck-length"
            />
          </label>
          <label className="ca-v071-field">
            桥面宽度：{snapshot.input.deckWidth} 格
            <input
              type="range"
              min={BRIDGE_SCENARIO.deckWidthRange[0]}
              max={BRIDGE_SCENARIO.deckWidthRange[1]}
              step={1}
              value={snapshot.input.deckWidth}
              onChange={(event) => session.setDeckWidth(Number(event.target.value))}
              data-testid="v071-deck-width"
            />
          </label>
          <dl className="ca-v071-stats" data-testid="v071-design-stats">
            <div><dt>河宽</dt><dd>{snapshot.input.measuredRiverSpan || "未测"} 格</dd></div>
            <div><dt>两岸搭接</dt><dd>{snapshot.computed.leftLanding} + {snapshot.computed.rightLanding} 格</dd></div>
            <div><dt>桥面面积</dt><dd>{snapshot.computed.deckArea} 格</dd></div>
            <div><dt>需要木板</dt><dd>{snapshot.computed.requiredPlanks} 块</dd></div>
            <div><dt>还剩木板</dt><dd>{snapshot.computed.remainingPlanks} 块</dd></div>
          </dl>
          {snapshot.stage === "site-survey" && (
            <button
              type="button"
              className="ca-btn ca-btn-primary"
              onClick={() => session.goStage("guided-design")}
              data-testid="v071-start-design"
            >
              开始设计桥面
            </button>
          )}
          <button
            type="button"
            className="ca-btn ca-btn-primary"
            onClick={requestValidation}
            disabled={snapshot.stage !== "guided-design"}
            data-testid="v071-validate"
          >
            检查方案
          </button>
          {snapshot.stage === "design-validation" && (
            <div className="ca-v071-validation" role="status">
              <strong>{snapshot.validation.passed ? BRIDGE_RESULT_MESSAGES.designPassed : BRIDGE_RESULT_MESSAGES.designFailed}</strong>
              {!snapshot.validation.passed && (
                <ul>
                  {snapshot.validation.issues
                    .filter((item) => item.severity === "error")
                    .map((item) => (
                      <li key={item.code}>{BRIDGE_VALIDATION_MESSAGES[item.messageKey] ?? item.messageKey}</li>
                    ))}
                </ul>
              )}
              <button
                type="button"
                className="ca-btn ca-btn-primary ca-btn-sm"
                disabled={!snapshot.validation.passed}
                onClick={enterConstruction}
                data-testid="v071-enter-construction"
              >
                进入施工现场
              </button>
            </div>
          )}
        </div>

        <div className="ca-v071-panel">
          <h3>工程师的小提示</h3>
          <button
            type="button"
            className="ca-btn ca-btn-sm"
            onClick={() => session.setHintLevel(snapshot.hintLevel + 1)}
            data-testid="v071-hint"
          >
            给我一点提示（{snapshot.hintLevel}/4）
          </button>
          {snapshot.hintLevel > 0 && (
            <p className="ca-v071-hint">{bridgeHintForAge(snapshot.hintLevel, ageBand)}</p>
          )}
          <div className="ca-v071-knowledge">
            {BRIDGE_KNOWLEDGE_SNIPPETS.map((snippet) => (
              <div key={snippet.knowledgePointId} className="ca-v071-knowledge-item">
                <button
                  type="button"
                  className="ca-v071-knowledge-title"
                  aria-expanded={openKnowledge === snippet.knowledgePointId}
                  onClick={() => setOpenKnowledge(
                    openKnowledge === snippet.knowledgePointId ? null : snippet.knowledgePointId
                  )}
                >
                  {snippet.title}
                </button>
                {openKnowledge === snippet.knowledgePointId && (
                  <div className="ca-v071-knowledge-body">
                    <p>{snippet.body}</p>
                    <p className="ca-v071-visual">{snippet.visual}</p>
                    {snippet.ageVariants[ageBand ?? "8-10"] && (
                      <p className="ca-v071-age">{snippet.ageVariants[ageBand ?? "8-10"]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {inConstruction && (
        <div className="ca-v071-hud" role="status" data-testid="v071-construction-hud">
          <strong>施工中：{placed}/{totalCells} 格</strong>
          <span>还需要 {snapshot.computed.requiredPlanks - placed} 块木板</span>
          <button type="button" className="ca-btn ca-btn-sm" onClick={returnToDesign}>
            {confirmReturn ? "确认返回并清空施工进度" : "回到设计"}
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="ca-v071-complete" role="status">
          <strong>{BRIDGE_RESULT_MESSAGES.constructionDone}</strong>
          <p>{BRIDGE_NEXT_MISSION_TEASER.rewardName}：{BRIDGE_NEXT_MISSION_TEASER.body}</p>
          <p className="ca-v071-note">{BRIDGE_NEXT_MISSION_TEASER.note}</p>
        </div>
      )}
    </section>
  );
}
