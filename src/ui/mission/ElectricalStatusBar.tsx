/**
 * V061-023 — 电力状态消息条（AC-6735/6736，E2/E3/E4）。
 * 纯展示组件：状态由 `deriveElectricalStatus()` 派生，本组件不订阅事件、不改世界。
 * 图标 + 文字并置，不只靠颜色；无电力方块时返回 null，干净世界 HUD 零变化。
 */
import { ELECTRICAL_STATUS_MESSAGES, type ElectricalStatusKey } from "../../content/electrical/glossary";

interface Props { status: ElectricalStatusKey | null; }

export function ElectricalStatusBar({ status }: Props) {
  if (!status) return null;
  const message = ELECTRICAL_STATUS_MESSAGES[status];
  return (
    <div className="ca-electrical-status" role="status" aria-live="polite" data-testid="electrical-status">
      <span className="ca-electrical-status-icon" aria-hidden="true">{message.icon}</span>
      <span className="ca-electrical-status-label">{message.label}</span>
    </div>
  );
}
