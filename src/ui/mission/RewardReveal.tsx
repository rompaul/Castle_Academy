import { Icon } from "../icons";

export interface RewardView {
  missionId: string;
  title: string;
  successMessage: string;
  learned: string;
  rewardTitle: string;
}

interface Props {
  view: RewardView;
  onNextMission: () => void;
  onFreeBuild: () => void;
}

/**
 * V51-012 — RewardReveal（S7）。
 * 完成 ≠ 掌握：只说明「做了什么 + 学到什么」，不判定掌握度；
 * 奖励为装饰性称号，不锁基础建造资源（PD-003）；动画 240ms（≤400ms）。
 */
export function RewardReveal({ view, onNextMission, onFreeBuild }: Props) {
  return (
    <div className="ca-reward-backdrop" data-testid="reward-reveal" role="dialog" aria-label="任务完成">
      <div className="ca-reward-card">
        <div className="ca-reward-icon"><Icon name="star" size={30} /></div>
        <h2 className="ca-reward-title">{view.title}完成了！</h2>
        <p className="ca-reward-desc">
          你做到了：{view.successMessage}<br />
          这里面的道理：{view.learned}
        </p>

        <div className="ca-reward-box" data-testid="reward-title">
          <small>解锁称号</small>
          <b><Icon name="star" size={14} /> {view.rewardTitle}</b>
        </div>

        <div className="ca-reward-actions">
          <button className="ca-btn ca-btn-primary" type="button" onClick={onNextMission}>
            <Icon name="arrow" size={15} /> 下一个任务
          </button>
          <button className="ca-btn ca-btn-outline" type="button" onClick={onFreeBuild}>
            <Icon name="build" size={15} /> 自由建造
          </button>
        </div>
      </div>
    </div>
  );
}
