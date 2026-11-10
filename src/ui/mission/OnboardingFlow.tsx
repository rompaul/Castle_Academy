import { useState } from "react";

import { AGE_BANDS, type AgeBand, type LearnerProfile } from "../../plugins/learner/types";
import { Icon } from "../icons";

export type OnboardingMode = "none" | "nickname" | "ageband" | "profiles";

interface CreateResult {
  ok: boolean;
  reason?: string;
}

interface Props {
  mode: OnboardingMode;
  profiles: LearnerProfile[];
  activeProfile: LearnerProfile | null;
  onCreate: (nickname: string, ageBand: AgeBand) => CreateResult;
  onSwitch: (profileId: string) => void;
  onSkip: () => void;
  onStartCreate: () => void;
  /** 昵称校验通过 → 进入年龄段选择 */
  onGoAgeBand: () => void;
  onEnterWorld: () => void;
}

const AGE_LABELS: Record<AgeBand, string> = {
  "6-7": "6–7 岁 · 数一数、看一看",
  "8-10": "8–10 岁 · 动手试、找规律",
  "11-12": "11–12 岁 · 剖面与推理",
  "13-15": "13–15 岁 · 设计与表达"
};

/**
 * V51-013 — OnboardingFlow（S1/S2/S3）。
 * 非模态右下卡片：不遮挡世界主视图、欢迎页按钮、顶栏、热栏（保障 AC-215 旧 E2E 不回归）；
 * 不自动聚焦输入框，避免吃掉数字键/WASD；任何一步都可跳到自由建造（AC-226）。
 */
export function OnboardingFlow({
  mode, profiles, activeProfile,
  onCreate, onSwitch, onSkip, onStartCreate, onGoAgeBand, onEnterWorld
}: Props) {
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mode === "none") return null;

  const submitNickname = () => {
    if (nickname.trim().length === 0 || nickname.trim().length > 16) {
      setError("请输入昵称（1~16 字）");
      return;
    }
    setError(null);
    onGoAgeBand();
  };

  const submitCreate = () => {
    if (!ageBand) {
      setError("请选择一个年龄段");
      return;
    }
    const result = onCreate(nickname, ageBand);
    if (!result.ok) {
      setError(result.reason ?? "创建失败，请重试");
      return;
    }
    setError(null);
    setNickname("");
    setAgeBand(null);
  };

  const selected = selectedId ?? activeProfile?.id ?? profiles[0]?.id ?? null;

  return (
    <div className="ca-onboarding" data-testid="onboarding-flow">
      <div className="ca-onboarding-card">
        {mode === "nickname" && (
          <>
            <h2 className="ca-onboarding-title">CASTLE ACADEMY</h2>
            <p className="ca-onboarding-sub">创建你的工程师铭牌</p>
            <div className="ca-onboarding-field">
              <input
                className="ca-input"
                data-testid="onboarding-nickname"
                aria-label="昵称"
                placeholder="输入昵称（1~16 字）"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") submitNickname(); }}
              />
              {error && <p className="ca-error" role="alert">{error}</p>}
            </div>
            <p className="ca-note" style={{ textAlign: "center" }}>只用昵称就好，不用真实姓名</p>
            <div className="ca-onboarding-actions">
              <button className="ca-btn ca-btn-primary" type="button" onClick={submitNickname}>下一步</button>
              <button className="ca-btn ca-btn-ghost" type="button" onClick={onSkip}>跳过 · 自由建造</button>
            </div>
            <div className="ca-onboarding-foot">本地保存 · 无账号 · 无网络</div>
          </>
        )}

        {mode === "ageband" && (
          <>
            <h2 className="ca-onboarding-title">你多大啦？</h2>
            <p className="ca-onboarding-sub">给 {nickname} 选一个年龄段</p>
            <div className="ca-age-grid">
              {AGE_BANDS.map((band) => (
                <button
                  key={band}
                  className="ca-age-option"
                  type="button"
                  aria-pressed={ageBand === band}
                  aria-label={`年龄段 ${band}`}
                  onClick={() => { setAgeBand(band); setError(null); }}
                >
                  {band} 岁
                  <small>{AGE_LABELS[band]}</small>
                </button>
              ))}
            </div>
            {error && <p className="ca-error" role="alert">{error}</p>}
            <p className="ca-note" style={{ marginTop: "var(--ca-space-3)" }}>
              家长说明：年龄段只用来推荐合适的内容范围，不显示难度标签，也不会影响自由建造。
            </p>
            <div className="ca-onboarding-actions">
              <button className="ca-btn ca-btn-primary" type="button" onClick={submitCreate}>
                <Icon name="play" size={14} /> 进入世界
              </button>
              <button className="ca-btn ca-btn-ghost" type="button" onClick={onSkip}>跳过</button>
            </div>
          </>
        )}

        {mode === "profiles" && (
          <>
            <h2 className="ca-onboarding-title">选择你的铭牌</h2>
            <p className="ca-onboarding-sub">这台设备上有 {profiles.length} 个学习者档案</p>
            <div className="ca-profile-list">
              {profiles.map((profile) => {
                const done = Object.values(profile.missionProgress).filter((e) => e.status === "completed").length;
                return (
                  <button
                    key={profile.id}
                    className="ca-profile-card"
                    type="button"
                    aria-pressed={selected === profile.id}
                    aria-label={`档案 ${profile.nickname}`}
                    onClick={() => setSelectedId(profile.id)}
                  >
                    <span className="ca-profile-avatar">{profile.nickname.slice(0, 1)}</span>
                    <span>
                      <span className="ca-profile-name">{profile.nickname}</span>
                      <span className="ca-profile-meta" style={{ display: "block" }}>
                        {profile.ageBand} 岁 · 完成 {done} 个任务
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="ca-onboarding-actions">
              <button
                className="ca-btn ca-btn-primary"
                type="button"
                onClick={() => (selected && selected !== activeProfile?.id ? onSwitch(selected) : onEnterWorld())}
              >
                进入世界
              </button>
              <button className="ca-btn ca-btn-outline" type="button" onClick={onStartCreate}>
                <Icon name="plus" size={14} /> 新建铭牌
              </button>
            </div>
            <div className="ca-onboarding-actions" style={{ marginTop: "var(--ca-space-2)" }}>
              <button className="ca-btn ca-btn-ghost ca-btn-sm" type="button" onClick={onSkip}>跳过 · 自由建造</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
