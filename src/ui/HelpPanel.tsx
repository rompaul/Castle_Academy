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
      <div className="control-row"><kbd>1 — 7</kbd><span>Choose a block</span></div>
      <div className="control-row"><kbd>LEFT CLICK</kbd><span>Place a block</span></div>
      <div className="control-row"><kbd>RIGHT CLICK</kbd><span>Remove a block</span></div>
      <p>Press <kbd>ESC</kbd> to release the mouse.</p>
    </aside>
  );
}
