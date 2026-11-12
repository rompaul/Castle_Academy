import type { MasteryEvidenceRecord } from "../../plugins/learner/types";
import { getKnowledgePointById } from "../../content/knowledge/registry";
import { Icon } from "../icons";

interface Props {
  records: MasteryEvidenceRecord[];
  missionTitleById: (missionId: string) => string;
  onClose: () => void;
}

/**
 * V06-019 — 证据记录面板（K5）。
 * 只读、平实语言：展示「做了什么」的确定性观察，不显示掌握等级 / 百分比 / Tier，
 * 不判负、不排名。空态用平实文案引导继续探索。
 */
export function EvidenceRecordPanel({ records, missionTitleById, onClose }: Props) {
  return (
    <div
      className="ca-evidence-panel"
      role="region"
      aria-label="证据记录"
      data-testid="evidence-record-panel"
    >
      <header className="ca-detail-header">
        <span className="ca-detail-title"><Icon name="star" size={16} /> 我的证据</span>
        <button className="ca-icon-btn" type="button" aria-label="关闭证据记录" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="ca-detail-body">
        {records.length === 0 ? (
          <div className="ca-sidebar-empty" data-testid="evidence-empty">
            还没有证据记录。完成任务后，这里会记下你做过什么。
          </div>
        ) : (
          <div className="ca-evidence-list" data-testid="evidence-list">
            {records.map((record, index) => {
              const kp = getKnowledgePointById(record.knowledgePointId);
              return (
                <div className="ca-evidence-item" key={`${record.missionId}-${record.knowledgePointId}-${index}`}>
                  <span className="ca-evidence-kp" data-testid="evidence-kp">
                    <Icon name="check" size={14} /> {kp?.label ?? record.knowledgePointId}
                  </span>
                  <span className="ca-evidence-obs" data-testid="evidence-observation">
                    在「{missionTitleById(record.missionId)}」：{record.observation}
                  </span>
                </div>
              );
            })}
            <div className="ca-note">证据只记录你做过什么，不会打分，也不会上传。</div>
          </div>
        )}
      </div>

      <div className="ca-detail-actions">
        <button className="ca-btn ca-btn-ghost ca-btn-sm" type="button" onClick={onClose}>收起</button>
      </div>
    </div>
  );
}
