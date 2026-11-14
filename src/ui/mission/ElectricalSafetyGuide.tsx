/**
 * V061-022 — 首次引导安全文案（R-628 三条之一）。
 * 非模态轻卡片，可关闭；由 MissionExperience 在会话内首次进入电力任务时显示一次。
 * 不新增 localStorage key（AC-6760 仍为 3 个），关闭状态只留运行时模块级标记。
 */
import { ELECTRICAL_SAFETY_TEXTS } from "../../content/electrical/glossary";

interface Props { onDismiss: () => void; }

export function ElectricalSafetyGuide({ onDismiss }: Props) {
  return (
    <div className="ca-safety-guide" data-testid="electrical-safety-guide">
      <div className="ca-safety-guide-card" role="dialog" aria-label="电力玩法安全提示">
        <div className="ca-safety-guide-title">城堡里的电</div>
        <p className="ca-safety-guide-text">{ELECTRICAL_SAFETY_TEXTS.firstGuide}</p>
        <button
          className="ca-btn ca-btn-primary ca-btn-sm"
          type="button"
          data-testid="electrical-safety-dismiss"
          onClick={onDismiss}
        >
          知道了
        </button>
      </div>
    </div>
  );
}
