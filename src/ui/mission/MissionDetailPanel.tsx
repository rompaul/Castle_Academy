import { useState } from "react";

import type { MissionDefinition, MissionSummary } from "../../content/missions/types";
import { Icon } from "../icons";

interface Props {
  definition: MissionDefinition;
  summary: MissionSummary;
  hintsUsed: number;
  missingCapabilities: string[];
  onUseHint: () => void;
  onClose: () => void;
  onFreeBuild: () => void;
  /** V51-016 交流类任务：提交文字证据。运行时只校验非空/最短长度，不评判内容 */
  onSubmitEvidence?: (text: string) => boolean;
}

/**
 * V51-011 — MissionDetailPanel（S6）与提示阶梯（S8 复用同一面板）。
 * 层级：标题 → 背景 → 目标 → 进度 → 可选提示阶梯 → 反思 → 出口。
 * 进度永远用平实语言；不显示难度分层 / 百分比；不判负、不扣分。
 */
export function MissionDetailPanel({
  definition, summary, hintsUsed, missingCapabilities,
  onUseHint, onClose, onFreeBuild, onSubmitEvidence
}: Props) {
  const [revealed, setRevealed] = useState(0);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const unavailable = summary.status === "unavailable";
  const completed = summary.status === "completed";
  const hints = definition.hintLadder;
  const isCommunication = definition.expressionForms.includes("communication");

  const revealNext = () => {
    if (revealed >= hints.length) return;
    setRevealed((value) => value + 1);
    onUseHint();
  };

  const submitEvidence = () => {
    if (!onSubmitEvidence) return;
    setNoteSaved(onSubmitEvidence(note));
  };

  return (
    <section className="ca-detail" role="dialog" aria-label={`任务详情：${definition.title}`} data-testid="mission-detail">
      <header className="ca-detail-header">
        <span className="ca-detail-title">{definition.title}</span>
        <button className="ca-icon-btn" type="button" aria-label="关闭任务详情" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="ca-detail-body">
        <div className="ca-detail-section">
          <span className="ca-detail-label">背景</span>
          <p className="ca-detail-context">{definition.context}</p>
        </div>

        {unavailable ? (
          <div className="ca-detail-section">
            <div className="ca-unavailable" data-testid="mission-unavailable">
              <p style={{ margin: 0 }}>这个任务暂时还不能玩：{definition.unavailableReason}</p>
              <p style={{ margin: "var(--ca-space-2) 0 0" }}>
                缺少能力：{missingCapabilities.length > 0 ? missingCapabilities.join("、") : "评估器未注册"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="ca-detail-section">
              <span className="ca-detail-label">目标</span>
              <div className="ca-goal-box">目标：{definition.goal}</div>
            </div>

            <div className="ca-detail-section">
              <span className="ca-detail-label">进度</span>
              <div className="ca-detail-progress-text">
                <span>{completed ? "已完成" : "正在探索"}</span>
                <b data-testid="mission-progress-text">{summary.progressText}</b>
              </div>
              <span className="ca-progress-bar">
                <span className="ca-progress-fill" style={{ width: `${Math.round(summary.progress * 100)}%` }} />
              </span>
            </div>

            <div className="ca-detail-section">
              <span className="ca-detail-label">提示（用了不扣分，可先看别的思路）</span>
              <div className="ca-hints" data-testid="hint-ladder">
                {hints.slice(0, revealed).map((hint, index) => (
                  <div className="ca-hint-item" key={index}>
                    <span className="ca-status-icon"><Icon name="hint" size={15} /></span>
                    <span>第 {index + 1} 级 · {hint}</span>
                  </div>
                ))}
                {revealed < hints.length && (
                  <button className="ca-btn ca-btn-outline ca-btn-sm" type="button" onClick={revealNext} data-testid="reveal-hint">
                    <Icon name="chevron" size={14} /> 看一条提示
                  </button>
                )}
              </div>
              <div className="ca-note" data-testid="hints-used">
                已看 {revealed}/{hints.length} 级 · 本任务累计使用 {hintsUsed} 次提示（不扣分）
              </div>
            </div>

            <div className="ca-detail-section">
              <span className="ca-detail-label">换个思路 · 说说你的做法</span>
              <p className="ca-reflection">{definition.reflectionPrompt}</p>
            </div>

            {isCommunication && (
              <div className="ca-detail-section" data-testid="evidence-section">
                <label className="ca-detail-label" htmlFor="ca-evidence-input">写下你的设计说明</label>
                <textarea
                  id="ca-evidence-input"
                  className="ca-evidence-input"
                  data-testid="evidence-input"
                  rows={3}
                  placeholder="我做了什么，为什么这样设计"
                  value={note}
                  onChange={(event) => { setNote(event.target.value); setNoteSaved(false); }}
                />
                <div className="ca-evidence-actions">
                  <button
                    className="ca-btn ca-btn-primary ca-btn-sm"
                    type="button"
                    data-testid="evidence-submit"
                    onClick={submitEvidence}
                  >
                    记下我的想法
                  </button>
                  <span className="ca-evidence-status" data-testid="evidence-status">
                    {noteSaved ? "已记下，内容不会被打分，也不会上传" : "至少写 12 个字；只检查长度，不评判内容"}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="ca-detail-actions">
        <button className="ca-btn ca-btn-primary ca-btn-sm" type="button" onClick={onFreeBuild}>
          <Icon name="build" size={14} /> {unavailable ? "先玩别的任务" : "继续自由建造"}
        </button>
        <button className="ca-btn ca-btn-ghost ca-btn-sm" type="button" onClick={onClose}>收起</button>
      </div>
    </section>
  );
}
