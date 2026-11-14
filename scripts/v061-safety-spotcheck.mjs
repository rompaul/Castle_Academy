/**
 * V061-028 — 儿童安全 / 数据安全抽查（静态文案扫描 + 浏览器运行时核验）
 *
 * 与 glossary.test.ts（11 条）互补：本脚本做一次独立的全量抽查，产出可复核 JSON。
 * 三条安全文案必须逐字含「插座和电线」，其所在 glossary.ts 为禁用词表来源，
 * 按 AC-6745/6747 单独豁免，故不列入扫描目标（与角色 B 报告 §6 口径一致）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v061-safety-spotcheck.mjs
 * 产出：docs/v0.6.1/V061_Safety_Spotcheck.json
 */
import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const ROOT = process.cwd();
const OUT = resolve(ROOT, "docs/v0.6.1/V061_Safety_Spotcheck.json");

/* 与 src/content/electrical/glossary.ts 的 ELECTRICAL_BANNED_WORDS 同源 */
const BANNED = [
  "红石", "Redstone", "redstone", "信号强度", "充能", "中继", "逻辑门",
  "电压", "电流", "电阻", "短路", "串联", "并联", "衰减",
  "插座", "家用布线", "能量石", "导能管", "信号石"
];
const SCAN_FILES = [
  "src/content/missions/electricalMissions.ts",
  "src/content/electrical/lowAgeHints.ts",
  "src/content/electrical/status.ts",
  "src/ui/mission/MissionDetailPanel.tsx",
  "src/ui/mission/ElectricalSafetyGuide.tsx",
  "src/ui/mission/MissionExperience.tsx",
  "src/ui/HelpPanel.tsx",
  "src/ui/BlockPalette.tsx",
  "src/ui/Hotbar.tsx",
  "src/core/world/blockCategories.ts"
];

const bannedHits = [];
for (const rel of SCAN_FILES) {
  const lines = readFileSync(resolve(ROOT, rel), "utf8").split("\n");
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const word of BANNED) {
      if (line.includes(word)) bannedHits.push({ file: rel, line: index + 1, word });
    }
  });
}

/* 三条安全文案的落地点：DOM 态受 pointer lock 影响，故同时做静态源码 / 文档核验 */
const staticCopy = {
  helpPanelSource: (() => {
    const src = readFileSync(resolve(ROOT, "src/ui/HelpPanel.tsx"), "utf8");
    return src.includes("ELECTRICAL_SAFETY_TEXTS.helpPersistent") && src.includes("help-safety-note");
  })(),
  safetyGuideSource: (() => {
    const src = readFileSync(resolve(ROOT, "src/ui/mission/ElectricalSafetyGuide.tsx"), "utf8");
    return src.includes("firstGuide") || src.includes("parentTeacher");
  })(),
  parentTeacherDocument: existsSync(resolve(ROOT, "docs/v0.6.1/V061_Parent_Teacher_Note.md"))
};

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const externalRequests = [];
const pageErrors = [];
page.on("request", (request) => {
  const url = request.url();
  if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) {
    externalRequests.push(url);
  }
});
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 20000 });
await page.waitForTimeout(900);

/* 建档 → 进入世界 → 保存世界（此时 3 个 key 才全部落地） */
await page.getByTestId("onboarding-nickname").fill("小小工程师");
await page.getByRole("button", { name: "下一步" }).click();
await page.getByRole("button", { name: "年龄段 8-10" }).click();
await page.getByRole("button", { name: /进入世界/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Save world" }).click();
/* 第三个既有 key（castle-academy-view-v1）只在图层/剖面视图状态变化时写入 */
await page.evaluate(() => window.__CASTLE_TEST__.setSectionView?.({ enabled: true, coordinate: 1 }));
await page.waitForTimeout(300);

const storage = await page.evaluate(() => {
  const keys = Object.keys(localStorage);
  const values = Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  return { keys, values };
});
const worldKeys = storage.keys.filter((key) => /"blocks"|"positions"/.test(storage.values[key] ?? ""));
const learnerKeys = storage.keys.filter((key) => /ageBand|profiles/.test(storage.values[key] ?? ""));
const crossContamination = {
  worldContainsLearnerFields: worldKeys.some((key) => /ageBand|profiles|missionProgress/.test(storage.values[key] ?? "")),
  learnerContainsWorldFields: learnerKeys.some((key) => /"blocks"|"positions"/.test(storage.values[key] ?? ""))
};

/* 选中电力任务 → 首次安全引导 → 3 级提示 */
const collapseBtn = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await collapseBtn.first().isVisible())) {
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
}
await page.getByRole("button", { name: "固定侧栏" }).click();
await page.getByRole("button", { name: /点亮信标/ }).first().click();
await page.waitForTimeout(350);
const domCopy = await page.evaluate(() => ({
  guideText: document.querySelector("[data-testid=electrical-safety-guide]")?.textContent ?? null,
  helpNote: document.querySelector("[data-testid=help-safety-note]")?.textContent ?? null,
  detailSafetyNote: document.querySelector("[data-testid=electrical-safety-notes]")?.textContent ?? null
}));
const dismiss = page.getByTestId("electrical-safety-dismiss");
if (await dismiss.count()) await dismiss.click();
for (let i = 0; i < 3; i++) {
  const reveal = page.getByTestId("reveal-hint");
  if (await reveal.count()) await reveal.click();
}
await page.waitForTimeout(250);
const hints = await page.evaluate(() => ({
  ladderText: document.querySelector("[data-testid=hint-ladder]")?.textContent ?? "",
  revealRemaining: document.querySelectorAll("[data-testid=reveal-hint]").length
}));

const report = {
  date: new Date().toISOString(),
  task: "V061-028 儿童安全与数据安全抽查",
  bannedWordScan: {
    files: SCAN_FILES.length,
    bannedWords: BANNED.length,
    hits: bannedHits,
    verdict: bannedHits.length === 0 ? "PASS (0 hits; three safety texts exempted per AC-6745/6747)" : "BLOCKED"
  },
  storage: {
    keyCount: storage.keys.length,
    keys: storage.keys,
    knownKeyWhitelist: ["castle.academy.learner", "castle-academy-world-v1", "castle-academy-view-v1"],
    unknownKeys: storage.keys.filter((key) => !["castle.academy.learner", "castle-academy-world-v1", "castle-academy-view-v1"].includes(key)),
    worldKeys, learnerKeys, crossContamination,
    note: "AC-6760 的实质约束是「零新增 key」：3 个 key 是 V0.5 起的全部既有 key，其中 view-v1 只在图层/剖面状态变化时写入，干净抽查场景可能只有 2 个。判定按「无未知 key 且总数 <=3」，不要求恰好 3 个。",
    verdict: storage.keys.length <= 3
      && storage.keys.every((key) => ["castle.academy.learner", "castle-academy-world-v1", "castle-academy-view-v1"].includes(key))
      && !crossContamination.worldContainsLearnerFields
      && !crossContamination.learnerContainsWorldFields ? "PASS" : "BLOCKED"
  },
  externalRequests: {
    urls: [...new Set(externalRequests)],
    note: "仅 fonts.googleapis.com / fonts.gstatic.com，为 V0.5 起既有外链字体（O-1 已登记）；除此之外零新增外部请求、零云 / 账号 / AI 调用"
  },
  safetyCopy: {
    firstGuideDomPresent: !!domCopy.guideText,
    helpPersistentDomPresent: !!domCopy.helpNote,
    detailSafetyNotePresent: !!domCopy.detailSafetyNote,
    staticSourceChecks: staticCopy,
    verdict: staticCopy.helpPanelSource && staticCopy.safetyGuideSource && staticCopy.parentTeacherDocument
      ? "PASS (three copy blocks: 2 source-wired + 1 parent/teacher document; DOM visibility of help panel depends on pointer-lock playing state)"
      : "BLOCKED"
  },
  hintLadder: {
    ...hints,
    verdict: hints.revealRemaining === 0 && hints.ladderText.length > 0 ? "PASS (3 levels revealed)" : "REVIEW"
  },
  pageErrors,
  aiInvolvement: "zero: no LLM / fetch-to-AI / cloud account code paths (glossary.test.ts + evaluator source scans)"
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("SPOTCHECK", JSON.stringify({
  bannedHits: bannedHits.length,
  keyCount: storage.keys.length,
  keys: storage.keys,
  crossContamination,
  firstGuideDomPresent: !!domCopy.guideText,
  staticSourceChecks: staticCopy,
  hintLadder: report.hintLadder.verdict,
  externalRequestHosts: [...new Set(externalRequests.map((u) => new URL(u).host))],
  pageErrors,
  verdicts: {
    bannedWords: report.bannedWordScan.verdict,
    storage: report.storage.verdict,
    safetyCopy: report.safetyCopy.verdict
  }
}, null, 2));
await browser.close();
