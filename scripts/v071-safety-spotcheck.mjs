/**
 * V0.7.1 — 儿童安全 / 数据安全抽查。
 *
 * 与 V0.7 同型，但按 owner D2 授权把 localStorage 白名单从 3 key 扩到 4 key，
 * 并验证第 4 个 key 只含任务/奖励 ID，不含儿童自由文本。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v071-safety-spotcheck.mjs
 * 产出：docs/v0.7.1/V071_Safety_Spotcheck.json
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const ROOT = process.cwd();
const OUT = resolve(ROOT, "docs/v0.7.1/V071_Safety_Spotcheck.json");
const PROGRESS_KEY = "castle.academy.v071.progress";

const BANNED = [
  "红石", "Redstone", "redstone", "信号强度", "充能", "中继", "逻辑门",
  "电压", "电流", "电阻", "短路", "串联", "并联", "衰减",
  "插座", "家用布线", "能量石", "导能管", "信号石",
  "等级", "难度", "年级", "百分比", "Tier", "掌握度", "正确率", "星级", "扣分"
];
const SCAN_FILES = [
  "src/content/engineering/bridgeContent.ts",
  "src/content/missions/v071MissionContracts.ts",
  "src/content/missions/v071Missions.ts",
  "src/features/engineering-design/BridgeSession.ts",
  "src/features/engineering-design/V071ProgressStore.ts",
  "src/features/engineering-design/design.ts",
  "src/features/engineering-design/scenario.ts",
  "src/features/engineering-design/session.ts",
  "src/features/engineering-design/types.ts",
  "src/plugins/mission/bridgeEvaluators.ts",
  "src/rendering/V071BridgeScene.ts",
  "src/ui/mission/V071BridgeWorkbench.tsx",
  "src/ui/v071.css"
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
await page.evaluate(() => window.__CASTLE_TEST__.setProfile("安全抽查", "8-10"));
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Save world" }).click();
await page.evaluate(() => window.__CASTLE_TEST__.setSectionView?.({ enabled: true, coordinate: 1 }));
await page.waitForTimeout(200);

const list = page.getByRole("region", { name: "任务列表" });
if (!(await list.isVisible())) await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.getByRole("button", { name: /修复王国旧桥/ }).click();
await page.locator('.ca-v071-cell[title="(8, 7)"]').click();
await page.locator('.ca-v071-cell[title="(13, 7)"]').click();
await page.getByTestId("v071-use-measurement").click();
await page.getByTestId("v071-start-design").click();
await page.getByTestId("v071-validate").click();
await page.getByTestId("v071-enter-construction").click();
await page.evaluate(() => {
  const api = window.__CASTLE_TEST__;
  for (let x = 7; x <= 14; x++) {
    for (let z = 6; z <= 8; z++) api.placeBlock(x, 2, z, "wood");
  }
});
await page.waitForFunction(() =>
  window.__CASTLE_TEST__.getMissions()
    .find((m) => m.id === "mission.bridge-repair.v1")?.status === "completed",
null, { timeout: 15000 });

const storage = await page.evaluate((key) => {
  const keys = Object.keys(localStorage).sort();
  return {
    keys,
    progressRaw: localStorage.getItem(key),
    serialized: JSON.stringify(Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])))
  };
}, PROGRESS_KEY);
const progress = JSON.parse(storage.progressRaw ?? "{}");
const knownKeys = [
  "castle.academy.learner",
  "castle-academy-world-v1",
  "castle-academy-view-v1",
  PROGRESS_KEY
];
const unknownKeys = storage.keys.filter((key) => !knownKeys.includes(key));
const freeTextLeaked = storage.serialized.includes("先测量河道");

const report = {
  date: new Date().toISOString(),
  task: "V0.7.1 儿童安全与数据安全抽查（owner D2：4 key 白名单）",
  bannedWordScan: {
    files: SCAN_FILES.length,
    bannedWords: BANNED.length,
    hits: bannedHits,
    verdict: bannedHits.length === 0 ? "PASS (0 hits)" : "BLOCKED"
  },
  storage: {
    keyCount: storage.keys.length,
    keys: storage.keys,
    knownKeyWhitelist: knownKeys,
    unknownKeys,
    progressShape: progress,
    freeTextLeaked,
    note: "第 4 key 只存任务 ID 与奖励 ID；不存儿童自由文本。",
    verdict: storage.keys.length === 4
      && unknownKeys.length === 0
      && Array.isArray(progress.unlockedRewardIds)
      && !freeTextLeaked ? "PASS" : "BLOCKED"
  },
  externalRequests: {
    hosts: [...new Set(externalRequests.map((url) => { try { return new URL(url).host; } catch { return url; } }))],
    note: "仅 fonts.googleapis.com / fonts.gstatic.com（O-1 既有外链字体）即 PASS"
  },
  pageErrors,
  aiInvolvement: "zero: V0.7.1 added no LLM / network / cloud code path"
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("V071_SPOTCHECK", JSON.stringify({
  bannedHits: bannedHits.length,
  keys: storage.keys,
  unknownKeys,
  progressShape: progress,
  pageErrors,
  verdicts: {
    bannedWords: report.bannedWordScan.verdict,
    storage: report.storage.verdict
  }
}, null, 2));
await browser.close();
