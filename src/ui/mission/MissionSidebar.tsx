import { Icon } from "../icons";
import type { MissionSummary } from "../../content/missions/types";
import type { LearnerProfile } from "../../plugins/learner/types";

interface Props {
  missions: MissionSummary[];
  selectedId: string | null;
  profile: LearnerProfile | null;
  open: boolean;
  pinned: boolean;
  onOpen: () => void;
  onScheduleClose: () => void;
  onCloseNow: () => void;
  onTogglePin: () => void;
  onToggleOpen: () => void;
  onSelect: (missionId: string) => void;
}

/**
 * V51-010 — MissionSidebar（S4/S5）。
 * 硬约束：fixed overlay，展开不改变 canvas 视口；外层 pointer-events:none，
 * 仅热区/面板/按钮 intercept（R-606）。折叠态保留 14px 左缘悬停条。
 */
export function MissionSidebar({
  missions, selectedId, profile, open, pinned,
  onOpen, onScheduleClose, onCloseNow, onTogglePin, onToggleOpen, onSelect
}: Props) {
  const completed = missions.filter((m) => m.status === "completed").length;

  return (
    <div
      className="ca-sidebar"
      data-open={open ? "true" : "false"}
      data-testid="mission-sidebar"
      onMouseEnter={onOpen}
      onMouseLeave={onScheduleClose}
      onFocus={onOpen}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onScheduleClose();
      }}
    >
      <button
        className="ca-sidebar-strip"
        type="button"
        aria-label="展开任务列表"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        任 务 <Icon name="chevron" size={12} />
      </button>

      <button
        className="ca-sidebar-toggle"
        type="button"
        aria-label={open ? "收起任务侧栏" : "打开任务侧栏"}
        aria-pressed={open}
        onClick={onToggleOpen}
      >
        <Icon name="mission" size={14} /> 任务 {completed > 0 ? `(${completed}/${missions.length})` : ""}
      </button>

      <div className="ca-sidebar-panel" role="region" aria-label="任务列表">
        <div className="ca-sidebar-header">
          <span className="ca-sidebar-title"><Icon name="mission" size={16} /> 任务 · 城堡水务</span>
          <span className="ca-sidebar-header-actions">
            <button
              className="ca-icon-btn"
              type="button"
              aria-label={pinned ? "取消固定侧栏" : "固定侧栏"}
              aria-pressed={pinned}
              onClick={onTogglePin}
            >
              <Icon name="pin" size={15} />
            </button>
            <button className="ca-icon-btn" type="button" aria-label="收起任务侧栏" onClick={onCloseNow}>
              <Icon name="close" size={15} />
            </button>
          </span>
        </div>

        <div className="ca-sidebar-summary">
          {profile ? `${profile.nickname} · ${completed}/${missions.length} 个任务完成` : "自由建造中 · 任务进度不记录"}
        </div>

        {missions.length === 0 ? (
          <div className="ca-sidebar-empty">暂时没有任务，先自由建造吧。</div>
        ) : (
          <div className="ca-sidebar-list">
            {missions.map((mission) => (
              <button
                key={mission.id}
                className="ca-mission-card"
                type="button"
                data-status={mission.status}
                data-selected={mission.id === selectedId ? "true" : "false"}
                aria-label={`${mission.title}：${mission.progressText}`}
                onClick={() => onSelect(mission.id)}
              >
                <span className="ca-mission-title">
                  <span className="ca-status-icon">
                    <Icon
                      name={mission.status === "completed" ? "check" : mission.status === "unavailable" ? "lock" : "water"}
                      size={15}
                    />
                  </span>
                  {mission.title}
                </span>
                <span className="ca-mission-meta">{mission.progressText}</span>
                <span className="ca-progress-bar">
                  <span className="ca-progress-fill" style={{ width: `${Math.round(mission.progress * 100)}%` }} />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="ca-sidebar-footer">
          <button className="ca-btn ca-btn-outline ca-btn-sm" type="button" onClick={onCloseNow}>
            <Icon name="build" size={14} /> 继续自由建造
          </button>
        </div>
      </div>
    </div>
  );
}
