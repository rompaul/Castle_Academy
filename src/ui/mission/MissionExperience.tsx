import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { GameActions } from "../../rendering/GameCanvas";
import type { MissionSummary } from "../../content/missions/types";
import { getMissionById } from "../../content/missions";
import type { LearnerProfile } from "../../plugins/learner/types";
import {
  MISSION_EVENTS,
  type MissionOfferedPayload,
  type MissionRewardGrantedPayload
} from "../../plugins/mission/events";
import { LEARNER_EVENTS, type LearnerProfileRecoveredPayload } from "../../plugins/learner/types";
import { MissionSidebar } from "./MissionSidebar";
import { MissionDetailPanel } from "./MissionDetailPanel";
import { EvidenceRecordPanel } from "./EvidenceRecordPanel";
import { RewardReveal, type RewardView } from "./RewardReveal";
import { OnboardingFlow, type OnboardingMode } from "./OnboardingFlow";
import type { AgeBand } from "../../plugins/learner/types";

interface Props {
  gameRef: MutableRefObject<GameActions | null>;
}

/**
 * V51-010~013 — 任务体验容器（唯一与 GameActions/EventBus 对接的 UI 组件）。
 * 所有子组件是纯展示组件；容器负责事件订阅、侧栏状态机与档案状态。
 */
export function MissionExperience({ gameRef }: Props) {
  const [ready, setReady] = useState(false);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hintTick, setHintTick] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** 显式点击展开（与悬停展开分开，避免"悬停已展开时点按钮反而收起"） */
  const [explicitOpen, setExplicitOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** V51-016：多个任务可能在同一轮判定中同时完成，用队列逐张展示，避免后一个奖励覆盖前一个 */
  const [rewardQueue, setRewardQueue] = useState<RewardView[]>([]);
  const reward = rewardQueue[0] ?? null;
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>("none");
  /** V06-019（K5）：证据记录面板开关；数据从档案实时读取 */
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  /** V06-020（K6）：迁移/容错提示已读（非模态卡片，不再阻挡交互） */
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const open = pinned || hovered || explicitOpen;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    clearCloseTimer();
    setHovered(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setHovered(false), 650); // 500~800ms 区间
  }, [clearCloseTimer]);

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setHovered(false);
    setPinned(false);
    setExplicitOpen(false);
  }, [clearCloseTimer]);

  useEffect(() => {
    let cancelled = false;
    let unsubs: Array<() => void> = [];
    let poll: number | null = null;

    const init = (): boolean => {
      const game = gameRef.current;
      if (!game || cancelled) return false;
      const sync = () => {
        setMissions(game.getMissions());
        setProfile(game.getActiveProfile());
        setProfiles(game.listProfiles());
      };
      sync();
      // V06-020（K6）：插件激活早于 UI 订阅，recovered 事件可能已错过——初始化时补读待展示提示
      const pending = game.learnerProfile.peekNotice();
      if (pending) setNotice(pending);
      // 首屏：无档案 → 创建引导；已有档案 → 档案选择页（可跳过直进自由建造）
      setOnboardingMode(game.getActiveProfile() ? "profiles" : "nickname");
      const onProfileReady = () => {
        sync();
        setOnboardingMode("none");
        const first = game.getMissions()[0];
        if (first) {
          setSelectedId(first.id); // 首次进入高亮第一个任务
          setHovered(true);        // 侧栏首次自动展开
        }
      };
      unsubs = [
        game.events.on<MissionOfferedPayload>(MISSION_EVENTS.offered, (e) => setMissions(e.payload.missions)),
        game.events.on(MISSION_EVENTS.progressUpdated, sync),
        game.events.on(MISSION_EVENTS.activated, sync),
        game.events.on(LEARNER_EVENTS.created, onProfileReady),
        game.events.on(LEARNER_EVENTS.switched, onProfileReady),
        game.events.on<LearnerProfileRecoveredPayload>(LEARNER_EVENTS.recovered, (e) => {
          setNotice(e.payload.message);
          setNoticeDismissed(false); // 新提示重新可读
          sync();
          setOnboardingMode(game.getActiveProfile() ? "profiles" : "nickname");
        }),
        game.events.on<MissionRewardGrantedPayload>(MISSION_EVENTS.rewardGranted, (e) => {
          const definition = getMissionById(e.payload.missionId);
          if (!definition) return;
          setOnboardingMode("none"); // 完成反馈期间收起引导，避免与奖励卡片层叠
          setRewardQueue((queue) => [...queue, {
            missionId: definition.id,
            title: definition.title,
            successMessage: definition.successMessage,
            learned: definition.learningGoal,
            rewardTitle: e.payload.reward.title
          }]);
        })
      ];
      setReady(true);
      return true;
    };

    if (!init()) {
      // GameCanvas 的 effect 可能尚未写入 gameRef（React 挂载顺序/StrictMode 二次挂载）
      poll = window.setInterval(() => {
        if (init() && poll !== null) {
          window.clearInterval(poll);
          poll = null;
        }
      }, 50);
    }

    return () => {
      cancelled = true;
      if (poll !== null) window.clearInterval(poll);
      unsubs.forEach((unsub) => unsub());
    };
  }, [gameRef]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const toggleOpen = () => {
    if (explicitOpen || pinned) {
      closeNow();
    } else {
      openNow();
      setExplicitOpen(true);
    }
  };

  const togglePin = () => {
    setPinned((value) => !value);
    setExplicitOpen(true);
    openNow();
  };

  const selectMission = (missionId: string) => {
    gameRef.current?.activateMission(missionId);
    setSelectedId(missionId);
    setDetailOpen(true);
    setOnboardingMode("none"); // 开始玩任务后不再显示引导卡片
  };

  const useHint = (missionId: string) => {
    gameRef.current?.useHint(missionId);
    setHintTick((value) => value + 1);
  };

  const nextMission = () => {
    const next = missions.find((m) => m.id !== reward?.missionId
      && m.status !== "completed" && m.status !== "unavailable" && m.status !== "locked");
    setRewardQueue((queue) => queue.slice(1));
    if (next) {
      selectMission(next.id);
      openNow();
    } else {
      closeNow();
    }
  };

  const createProfile = (nickname: string, ageBand: AgeBand) =>
    gameRef.current?.createProfile(nickname, ageBand) ?? { ok: false, reason: "世界尚未就绪，请稍后再试" };

  const switchProfile = (profileId: string) => {
    gameRef.current?.switchProfile(profileId);
    setOnboardingMode("none");
  };

  const selectedDefinition = selectedId ? getMissionById(selectedId) : undefined;
  const selectedSummary = selectedId ? missions.find((m) => m.id === selectedId) : undefined;
  // 提示次数由 useHint() 触发 setHintTick 强制重渲染后重新读取
  const hintsUsed = selectedId ? (gameRef.current?.getHintsUsed(selectedId) ?? 0) : 0;
  const missingCapabilities = selectedId ? (gameRef.current?.getMissingCapabilities(selectedId) ?? []) : [];
  // V06-019：证据记录（profile 变化时随 sync 更新）
  const evidenceRecords = evidenceOpen && profile
    ? gameRef.current?.learnerProfile.getMasteryEvidence() ?? []
    : [];
  const missionTitleById = (missionId: string) =>
    missions.find((m) => m.id === missionId)?.title ?? missionId;

  if (!ready) return null;

  return (
    <div className="ca-root" data-testid="mission-experience" data-hint-tick={hintTick}>
      <MissionSidebar
        missions={missions}
        selectedId={selectedId}
        profile={profile}
        open={open}
        pinned={pinned}
        evidenceOpen={evidenceOpen}
        onOpen={openNow}
        onScheduleClose={scheduleClose}
        onCloseNow={closeNow}
        onTogglePin={togglePin}
        onToggleOpen={toggleOpen}
        onSelect={selectMission}
        onToggleEvidence={() => setEvidenceOpen((value) => !value)}
      />

      {detailOpen && selectedDefinition && selectedSummary && (
        <MissionDetailPanel
          key={selectedDefinition.id}
          definition={selectedDefinition}
          summary={selectedSummary}
          hintsUsed={hintsUsed}
          missingCapabilities={missingCapabilities}
          onUseHint={() => useHint(selectedDefinition.id)}
          onClose={() => setDetailOpen(false)}
          onFreeBuild={() => {
            setDetailOpen(false);
            closeNow();
          }}
          onSubmitEvidence={(text) =>
            gameRef.current?.submitTextEvidence(selectedDefinition.id, text) ?? false
          }
        />
      )}

      <OnboardingFlow
        mode={onboardingMode}
        profiles={profiles}
        activeProfile={profile}
        onCreate={createProfile}
        onSwitch={switchProfile}
        onSkip={() => setOnboardingMode("none")}
        onStartCreate={() => setOnboardingMode("nickname")}
        onGoAgeBand={() => setOnboardingMode("ageband")}
        onEnterWorld={() => setOnboardingMode("none")}
      />

      {reward && (
        <RewardReveal
          view={reward}
          onNextMission={nextMission}
          onFreeBuild={() => {
            setRewardQueue((queue) => queue.slice(1));
            setDetailOpen(false);
            closeNow();
          }}
        />
      )}

      {evidenceOpen && (
        <EvidenceRecordPanel
          records={evidenceRecords}
          missionTitleById={missionTitleById}
          onClose={() => setEvidenceOpen(false)}
        />
      )}

      {notice && !noticeDismissed && (
        /* V06-020（K6）：非模态轻提示卡，不阻挡世界交互；≤400ms 轻动画 + 减少动效支持 */
        <div className="ca-notice" role="status" data-testid="profile-notice">
          <div className="ca-notice-card">
            <div className="ca-notice-text">{notice}</div>
            <button
              className="ca-btn ca-btn-primary ca-btn-sm"
              type="button"
              data-testid="notice-dismiss"
              onClick={() => setNoticeDismissed(true)}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
