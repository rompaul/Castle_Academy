import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { GameActions } from "../../rendering/GameCanvas";
import type { MissionSummary } from "../../content/missions/types";
import type { LearnerProfile } from "../../plugins/learner/types";
import { MISSION_EVENTS, type MissionOfferedPayload } from "../../plugins/mission/events";
import { LEARNER_EVENTS, type LearnerProfileRecoveredPayload } from "../../plugins/learner/types";
import { MissionSidebar } from "./MissionSidebar";

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
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** 显式点击展开（与悬停展开分开，避免"悬停已展开时点按钮反而收起"） */
  const [explicitOpen, setExplicitOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
      };
      sync();
      unsubs = [
        game.events.on<MissionOfferedPayload>(MISSION_EVENTS.offered, (e) => setMissions(e.payload.missions)),
        game.events.on(MISSION_EVENTS.progressUpdated, sync),
        game.events.on(MISSION_EVENTS.activated, sync),
        game.events.on(LEARNER_EVENTS.created, sync),
        game.events.on(LEARNER_EVENTS.switched, sync),
        game.events.on<LearnerProfileRecoveredPayload>(LEARNER_EVENTS.recovered, (e) => setNotice(e.payload.message))
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
  };

  if (!ready) return null;

  return (
    <div className="ca-root" data-testid="mission-experience">
      <MissionSidebar
        missions={missions}
        selectedId={selectedId}
        profile={profile}
        open={open}
        pinned={pinned}
        onOpen={openNow}
        onScheduleClose={scheduleClose}
        onCloseNow={closeNow}
        onTogglePin={togglePin}
        onToggleOpen={toggleOpen}
        onSelect={selectMission}
      />
      {notice && (
        <div className="ca-onboarding" role="status">
          <div className="ca-onboarding-card">
            <div className="ca-onboarding-sub">{notice}</div>
            <div className="ca-onboarding-actions">
              <button className="ca-btn ca-btn-primary ca-btn-sm" type="button" onClick={() => setNotice(null)}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
