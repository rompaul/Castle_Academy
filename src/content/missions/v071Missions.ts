/**
 * V0.7.1 P1 — 「修复王国旧桥」任务内容（Content Pack，纯数据）。
 *
 * 使用既有 20 字段 MissionDefinition / schema v2；只追加到 ALL_MISSIONS 末尾。
 * 资源包不塞进 MissionReward（类型只支持称号），由 v071MissionContracts 单独登记。
 */
import type { MissionDefinition } from "./types";
import { V071_MISSION_CONTRACT } from "./v071MissionContracts";
import { BRIDGE_HINT_LEVELS, BRIDGE_RESULT_MESSAGES, BRIDGE_STORY } from "../engineering/bridgeContent";

export const V071_MISSIONS: readonly MissionDefinition[] = [
  {
    id: V071_MISSION_CONTRACT.id,
    version: 1,
    title: "修复王国旧桥",
    context: BRIDGE_STORY.briefing,
    goal: "量出河宽，做出桥面设计，再亲手把桥建起来",
    ageScope: V071_MISSION_CONTRACT.ageScope,
    expressionForms: ["problem-solving", "creation", "exploration"],
    requiredCapabilities: ["building.basic", "measurement.distance"],
    hintLadder: [...BRIDGE_HINT_LEVELS],
    successMessage: BRIDGE_RESULT_MESSAGES.constructionDone,
    evaluatorId: V071_MISSION_CONTRACT.evaluatorId,
    reward: { kind: "title", title: "桥梁建造者" },
    learningGoal: "在修桥情境里测量河宽、用搭接决定桥长、用长乘宽算面积和木板数量",
    schemaVersion: 2,
    knowledgePointIds: [...V071_MISSION_CONTRACT.knowledgePointIds],
    prerequisiteMissionIds: [],
    reflectionPrompt: "说说你为什么把桥做成这个长度和宽度。不想写也可以跳过。",
    accessibilityNote: "局部地图、尺寸控制和材料数量都用文字与图形同时表示；所有按钮可键盘操作，输入尺寸时不会触发世界快捷键。",
    progressLanguage: "铺好 {done}/{total} 格",
    unavailableReason: "需要「放置方块」和「距离测量」能力，开放后就能玩。"
  }
];

export const V071_MISSION_COUNT = V071_MISSIONS.length;
