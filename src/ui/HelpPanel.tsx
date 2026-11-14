import { ELECTRICAL_SAFETY_TEXTS } from "../content/electrical/glossary";

interface Props { onClose: () => void; }

export function HelpPanel({ onClose }: Props) {
  return (
    <aside className="help-panel">
      <button className="help-close" onClick={onClose} aria-label="Close controls">×</button>
      <div className="eyebrow">QUICK CONTROLS</div>
      <h2>Make this place yours.</h2>
      <div className="control-row"><kbd>W A S D</kbd><span>Move around</span></div>
      <div className="control-row"><kbd>MOUSE</kbd><span>Look around</span></div>
      <div className="control-row"><kbd>SPACE</kbd><span>Move up</span></div>
      <div className="control-row"><kbd>SHIFT</kbd><span>Move faster / descend with right Shift</span></div>
      <div className="control-row"><kbd>1 — 9</kbd><span>Choose a quick slot</span></div>
      {/* DDR-0002：MC 式方块栏的新增操作，帮助面板常驻可发现 */}
      <div className="control-row"><kbd>WHEEL</kbd><span>Switch quick slot</span></div>
      <div className="control-row"><kbd>E</kbd><span>Open all blocks by category</span></div>
      <div className="control-row"><kbd>LEFT CLICK</kbd><span>Place a block</span></div>
      <div className="control-row"><kbd>RIGHT CLICK</kbd><span>Remove a block</span></div>
      {/* DEV-615：让「按一下开、再按一下关」可发现，不占用左键 / 右键 */}
      <div className="control-row"><kbd>F</kbd><span>Press the switch or valve you are looking at (on / off)</span></div>
      {/* V061-022：安全文案常驻条目，帮助面板打开时始终可见、不随任务进度消失 */}
      <div className="ca-help-safety" data-testid="help-safety-note">
        <span className="ca-help-safety-icon" aria-hidden="true">●</span>
        <span>{ELECTRICAL_SAFETY_TEXTS.helpPersistent}</span>
      </div>
      <p>Press <kbd>ESC</kbd> to release the mouse.</p>
    </aside>
  );
}
