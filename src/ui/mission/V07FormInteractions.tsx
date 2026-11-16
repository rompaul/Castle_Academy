/**
 * V07-013~019 — 形式专属交互组件（ADR-0015 决策 5）。
 *
 * 全部是受控展示组件：只接受回调与只读数据，不读 DOM / 存档 / 渲染器；
 * 不产生完成判定，不显示对错、分数、等级、百分比。挂在既有 MissionDetailPanel 内，
 * 无全屏模态、不改 canvas 视口；颜色一律来自 `--ca-*` token（mission.css）。
 */
import { useState } from "react";

import type { ExpressionForm } from "../../content/missions/types";
import type { DecisionEntry } from "../../plugins/mission/interactionContracts";
import type { SwitchObservation } from "../../plugins/electrical/query";
import {
  DIAGNOSIS_HYPOTHESES,
  OBSERVATION_TARGETS,
  ROUTE_CHOICES,
  STORY_MAP_MARKERS
} from "../../plugins/mission/interactiveEvaluators";
import {
  HYPOTHESIS_LABELS,
  OBSERVATION_LABELS,
  ROUTE_CHOICE_LABELS,
  type PairRow,
  buildPairRows,
  choicesForStep,
  decisionRows,
  emptyStateText,
  recordedTargets
} from "./v07InteractionModel";

const MARKER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  water_source: "水源",
  lamp_basic: "灯",
  brick_limestone: "浅色砖"
});

export interface V07InteractionActions {
  submitObservation?: (target: string) => boolean;
  submitDecision?: (step: number, choiceId: string) => boolean;
  /** Problem-solving：登记 / 改「当前假设」（运行时第 0 步），改猜想不惩罚。 */
  submitHypothesis?: (choiceId: string) => boolean;
  /** Experiment：把同一位置的成对观察记成一条只读取证记录。 */
  submitVariablePair?: (row: PairRow) => boolean;
  submitReflection?: (text: string) => boolean;
}

export interface V07FormInteractionProps {
  missionId: string;
  form: ExpressionForm;
  actions?: V07InteractionActions;
  observations?: readonly { readonly missionId: string; readonly target: string }[];
  decisions?: readonly DecisionEntry[];
  switchObservations?: readonly SwitchObservation[];
  reflection?: string | null;
  explanation?: string | null;
  counts?: { observationLog: number; variableComparison: number; decisionSequence: number };
}

export function ObservationChecklist({
  targets, recorded, onSubmit
}: {
  targets: readonly string[];
  recorded: readonly string[];
  onSubmit?: (target: string) => boolean;
}) {
  const done = recorded.length;
  return (
    <div className="ca-v07-section" data-testid="v07-observation-checklist">
      <span className="ca-v07-label">记下我看到 · {done}/{targets.length} 处</span>
      {done === 0 && <p className="ca-v07-empty">{emptyStateText("exploration")}</p>}
      <div className="ca-v07-row">
        {targets.map((target) => {
          const isDone = recorded.includes(target);
          return (
            <button
              key={target}
              type="button"
              className={`ca-v07-chip ${isDone ? "ca-v07-chip-done" : ""}`}
              aria-pressed={isDone}
              data-testid={`v07-observe-${target}`}
              disabled={isDone}
              onClick={() => onSubmit?.(target)}
            >
              {OBSERVATION_LABELS[target] ?? target}{isDone ? " · 已记下" : " · 记下"}
            </button>
          );
        })}
      </div>
      <p className="ca-note">记下的是地方，不用写句子；想说一句也可以写在下面。</p>
    </div>
  );
}

export function TwoStateComparison({
  observations, onSubmitPair
}: {
  observations: readonly SwitchObservation[];
  onSubmitPair?: (row: PairRow) => boolean;
}) {
  const rows = buildPairRows(observations);
  return (
    <div className="ca-v07-section" data-testid="v07-two-state-comparison">
      <span className="ca-v07-label">同一个开关，两种样子</span>
      {rows.length === 0 && <p className="ca-v07-empty">{emptyStateText("experiment")}</p>}
      {rows.map((row) => (
        <div className="ca-v07-pair" key={row.key} data-testid="v07-pair-row">
          <span className="ca-v07-label">{row.label}</span>
          <span className="ca-v07-pair-state" aria-label="合上时灯亮">
            合上 · {row.closedPowered ? "灯亮" : "还没看到"}
          </span>
          <span className="ca-v07-pair-state" aria-label="断开时灯不亮">
            断开 · {row.openUnpowered ? "灯不亮" : "还没看到"}
          </span>
          <span className="ca-v07-pair-state">{row.both ? "两种都看到了" : "还差一种"}</span>
          {row.both && (
            <button
              type="button"
              className="ca-btn ca-btn-outline ca-btn-sm"
              data-testid="v07-pair-record"
              onClick={() => onSubmitPair?.(row)}
            >
              记下这组对照
            </button>
          )}
        </div>
      ))}
      <p className="ca-note">只比开关合上和断开时灯的样子；不量任何数值。</p>
    </div>
  );
}

export function HypothesisSwitcher({
  hypotheses, onSelectHypothesis, onSubmitCheck
}: {
  hypotheses: readonly string[];
  onSelectHypothesis?: (choiceId: string) => boolean;
  onSubmitCheck?: (target: string) => boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  return (
    <div className="ca-v07-section" data-testid="v07-hypothesis-switcher">
      <span className="ca-v07-label">先猜一个原因 · 改猜想没关系</span>
      {!selected && <p className="ca-v07-empty">{emptyStateText("problem-solving")}</p>}
      <div className="ca-v07-row">
        {hypotheses.map((id) => (
          <button
            key={id}
            type="button"
            className={`ca-v07-chip ${selected === id ? "ca-v07-chip-done" : ""}`}
            aria-pressed={selected === id}
            data-testid={`v07-hypothesis-${id}`}
            onClick={() => {
              setSelected(id);
              setChecked(false);
              onSelectHypothesis?.(id);
            }}
          >
            {HYPOTHESIS_LABELS[id] ?? id}
          </button>
        ))}
      </div>
      <div className="ca-v07-actions">
        <button
          type="button"
          className="ca-btn ca-btn-outline ca-btn-sm"
          disabled={!selected}
          data-testid="v07-hypothesis-check"
          onClick={() => {
            if (selected) setChecked(onSubmitCheck?.(`check:${selected}`) ?? false);
          }}
        >
          按这个猜想去查一次
        </button>
        <span className="ca-note">{checked ? "查过了，可以换一个猜想再查。" : "选好猜想就能去查。"}</span>
      </div>
    </div>
  );
}

export function ScenarioDecisions({
  missionId, decisions, onSubmit
}: {
  missionId: string;
  decisions: readonly DecisionEntry[];
  onSubmit?: (step: number, choiceId: string) => boolean;
}) {
  const [step, setStep] = useState(1);
  const rows = decisionRows(decisions, missionId, 3, ROUTE_CHOICES);
  return (
    <div className="ca-v07-section" data-testid="v07-scenario-decisions">
      <span className="ca-v07-label">第 {step} 步 · 选一个做法</span>
      {rows.every((row) => row.choiceId === null) && (
        <p className="ca-v07-empty">{emptyStateText("life-simulation")}</p>
      )}
      <div className="ca-v07-row">
        {choicesForStep(ROUTE_CHOICES, step).map((choiceId) => (
          <button
            key={choiceId}
            type="button"
            className="ca-v07-chip"
            data-testid={`v07-choice-${choiceId}`}
            onClick={() => {
              onSubmit?.(step, choiceId);
              if (step < 3) setStep(step + 1);
            }}
          >
            {ROUTE_CHOICE_LABELS[choiceId] ?? choiceId}
          </button>
        ))}
      </div>
      <div className="ca-v07-actions">
        <button type="button" className="ca-btn ca-btn-ghost ca-btn-sm" onClick={() => setStep(Math.max(1, step - 1))}>
          回看上一步
        </button>
        <span className="ca-note">第 {step} / 3 步 · 想改就直接再点一次</span>
      </div>
      <ul className="ca-v07-list" data-testid="v07-decision-review">
        {rows.map((row) => (
          <li key={row.step}>第 {row.step} 步：{row.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function LocalExplanationCard({ explanation }: { explanation?: string | null }) {
  return (
    <div className="ca-v07-section" data-testid="v07-local-explanation">
      <span className="ca-v07-label">我写下的理由（只在本机看）</span>
      {explanation
        ? <p className="ca-v07-explanation">{explanation}</p>
        : <p className="ca-v07-empty">{emptyStateText("communication")}</p>}
      <p className="ca-note">想改就在下面「写下你的设计说明」里改；不上传、不打分。</p>
    </div>
  );
}

export function CreationHintCard() {
  return (
    <div className="ca-v07-section" data-testid="v07-creation-hint">
      <span className="ca-v07-label">地图里的三个地方</span>
      <p className="ca-v07-empty">{emptyStateText("creation")}</p>
      <ul className="ca-v07-list">
        {STORY_MAP_MARKERS.map((id) => <li key={id}>{MARKER_LABELS[id] ?? id}</li>)}
      </ul>
      <p className="ca-note">放进世界里就行，怎么摆都好看，不比谁做得好。</p>
    </div>
  );
}

export function ReflectionInput({
  initialText, onSubmit
}: {
  initialText?: string | null;
  onSubmit?: (text: string) => boolean;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <div className="ca-v07-section" data-testid="v07-reflection-input">
      <label className="ca-v07-label" htmlFor="v07-reflection">说一说（可以不写）</label>
      <textarea
        id="v07-reflection"
        className="ca-v07-textarea"
        rows={3}
        placeholder="说说你先看了什么、后来改了什么"
        value={text}
        onChange={(event) => { setText(event.target.value); setSaved(false); }}
      />
      <div className="ca-v07-actions">
        <button
          type="button"
          className="ca-btn ca-btn-outline ca-btn-sm"
          data-testid="v07-reflection-submit"
          onClick={() => setSaved(onSubmit?.(text) ?? false)}
        >
          记下我的想法
        </button>
        <span className="ca-note">{saved ? "记下了，可以随时再改。" : "不写也没关系，不影响任务。"}</span>
      </div>
      <p className="ca-note">只在这次游戏里保留，读档、刷新或关掉就没了；不会保存、不会打分、不会上传。</p>
    </div>
  );
}

export function LocalEvidencePanel({
  counts, reflection, explanation
}: {
  counts?: { observationLog: number; variableComparison: number; decisionSequence: number };
  reflection?: string | null;
  explanation?: string | null;
}) {
  return (
    <details className="ca-v07-evidence" data-testid="v07-local-evidence">
      <summary>看看我留下了什么（给大人看）</summary>
      <ul className="ca-v07-list">
        <li>记下的观察：{counts?.observationLog ?? 0} 条</li>
        <li>两态对照：{counts?.variableComparison ?? 0} 条</li>
        <li>做过的选择：{counts?.decisionSequence ?? 0} 条</li>
        <li>我说的话：{reflection ? "已写" : "还没写"}</li>
        <li>我的解释：{explanation ? "已写" : "还没写"}</li>
      </ul>
      {reflection && <p className="ca-v07-explanation">{reflection}</p>}
      <p className="ca-note">这里只是给你和大人回看，系统不判断写得好不好。</p>
    </details>
  );
}

/** 统一入口：按任务主形式挂一个专属组件，底部始终有可选反思与本地证据回看。 */
export function V07FormInteraction({
  missionId, form, actions, observations, decisions, switchObservations,
  reflection, explanation, counts
}: V07FormInteractionProps) {
  let formBlock;
  switch (form) {
    case "exploration":
      formBlock = (
        <ObservationChecklist
          targets={OBSERVATION_TARGETS}
          recorded={recordedTargets(observations ?? [], missionId)}
          onSubmit={actions?.submitObservation}
        />
      );
      break;
    case "experiment":
      formBlock = (
        <TwoStateComparison
          observations={switchObservations ?? []}
          onSubmitPair={actions?.submitVariablePair}
        />
      );
      break;
    case "problem-solving":
      formBlock = (
        <HypothesisSwitcher
          hypotheses={DIAGNOSIS_HYPOTHESES}
          onSelectHypothesis={actions?.submitHypothesis}
          onSubmitCheck={actions?.submitObservation}
        />
      );
      break;
    case "life-simulation":
      formBlock = (
        <ScenarioDecisions missionId={missionId} decisions={decisions ?? []} onSubmit={actions?.submitDecision} />
      );
      break;
    case "communication":
      formBlock = <LocalExplanationCard explanation={explanation} />;
      break;
    case "creation":
      formBlock = <CreationHintCard />;
      break;
    default:
      formBlock = <p className="ca-v07-empty">{emptyStateText(form)}</p>;
  }

  return (
    <div className="ca-v07-forms" data-testid="v07-form-interaction">
      {formBlock}
      <ReflectionInput initialText={reflection} onSubmit={actions?.submitReflection} />
      <LocalEvidencePanel counts={counts} reflection={reflection} explanation={explanation} />
    </div>
  );
}
