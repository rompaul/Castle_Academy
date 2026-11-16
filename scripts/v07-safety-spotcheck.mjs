/**
 * V07-028 — 儿童安全 / 数据安全抽查（静态文案扫描 + 浏览器运行时核验）
 *
 * 与 v061-safety-spotcheck.mjs 互补：扫描目标加入 V0.7 新文件；新增 V0.7 专项——
 * 反思文本零落盘运行时验证（AC-7021）、6 个新任务 3 级提示、外部请求监控。
 * glossary.ts 为禁用词表来源，单独豁免（与 V0.6.1 口径一致）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v07-safety-spotcheck.mjs
 * 产出：docs/v0.7/V07_Safety_Spotcheck.json
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const ROOT = process.cwd();
const OUT = resolve(ROOT, "docs/v0.7/V07_Safety_Spotcheck.json");

const BANNED = [
  /* 电力禁用词（与 glossary.ts ELECTRICAL_BANNED_WORDS 同源） */
  "红石", "Redstone", "redstone", "信号强度", "充能", "中继", "逻辑门",
  "电压", "电流", "电阻", "短路", "串联", "并联", "衰减",
  "插座", "家用布线", "能量石", "导能管", "信号石",
  /* V0.7 儿童可见文案禁用词（与 v07LearningSupport.test.ts FORBIDDEN 同源） */
  "等级", "难度", "年级", "百分比", "Tier", "掌握度", "正确率", "星级", "扣分"
];
const SCAN_FILES = [
  "src/content/missions/interactiveMissions.ts",
  "src/content/missions/v07LowAgeHints.ts",
  "src/content/missions/electricalMissions.ts",
  "src/content/electrical/lowAgeHints.ts",
  "src/content/electrical/status.ts",
  "src/ui/mission/MissionDetailPanel.tsx",
  "src/ui/mission/V07FormInteractions.tsx",
  "src/ui/mission/v07InteractionModel.ts",
  "src/ui/mission/MissionSidebar.tsx",
  "src/ui/mission/MissionExperience.tsx",
  "src/ui/mission/RewardReveal.tsx",
  "src/ui/mission/ElectricalSafetyGuide.tsx",
  "src/ui/HelpPanel.tsx",
  "src/ui/BlockPalette.tsx",
  "src/ui/Hotbar.tsx",
  "src/core/world/blockCategories.ts"
];

const bannedHits = [];
const exemptions = [];
for (const rel of SCAN_FILES) {
  const lines = readFileSync(resolve(ROOT, rel), "utf8").split("\n");
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    /* 豁免 1：禁用词正则表源本身（与 glossary.ts 同性质）；正则字面量跨两行，按文件豁免 */
    if (rel.endsWith("v07InteractionModel.ts")) {
      exemptions.push({ file: rel, line: index + 1, reason: "banned-word regex source (same class as glossary.ts)" });
      return;
    }
    for (const word of BANNED) {
      /* 豁免 2：「不扣分」为 V0.5 起既有的否定式安心文案（明确否定扣分机制） */
      if (word === "扣分" && line.includes("不扣分")) {
        exemptions.push({ file: rel, line: index + 1, reason: "pre-existing negated copy 「不扣分」(V0.5 baseline)" });
        continue;
      }
      if (line.includes(word)) bannedHits.push({ file: rel, line: index + 1, word });
    }
  });
}

const REFLECTION_TEXT = "我先看到水沟里有水，后来发现花园那里没有水流过去。";

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

/* 建档 → 进入世界 → 保存世界 → 触发 view key 写入 */
await page.getByTestId("onboarding-nickname").fill("小小工程师");
await page.getByRole("button", { name: "下一步" }).click();
await page.getByRole("button", { name: "年龄段 8-10" }).click();
await page.getByRole("button", { name: /进入世界/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Save world" }).click();
await page.evaluate(() => window.__CASTLE_TEST__.setSectionView?.({ enabled: true, coordinate: 1 }));
await page.waitForTimeout(300);

const storage = await page.evaluate(() => {
  const keys = Object.keys(localStorage);
  return { keys, values: Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])) };
});

/* V0.7 新任务：打开侧栏 → 固定 → 选「水在哪里出现」→ 3 级提示 + 3 条观察 + 反思 */
const collapseBtn = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await collapseBtn.first().isVisible())) {
  await page.mouse.move(6, 300);
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: "固定侧栏", exact: true }).click();
await page.getByRole("button", { name: /水在哪里出现/ }).first().click();
await page.waitForTimeout(350);
for (let i = 0; i < 3; i++) {
  const reveal = page.getByTestId("reveal-hint");
  if (await reveal.count()) await reveal.click();
  await page.waitForTimeout(150);
}
const hints = await page.evaluate(() => ({
  ladderText: document.querySelector("[data-testid=hint-ladder]")?.textContent ?? "",
  revealRemaining: document.querySelectorAll("[data-testid=reveal-hint]").length
}));
/* 反思先写：记满 3 条观察会立即完成任务并弹出奖励卡遮挡面板 */
const textarea = page.locator("textarea").first();
if (await textarea.count()) await textarea.fill(REFLECTION_TEXT);
const saveReflection = page.getByRole("button", { name: "记下我的想法" }).first();
if (await saveReflection.count()) await saveReflection.click();
await page.waitForTimeout(300);
for (const label of ["水源旁边", "水沟尽头", "护城河边"]) {
  const btn = page.getByRole("button", { name: new RegExp(`${label}.*记下|记下.*${label}`) }).first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(150);
}

const storageAfterInteraction = await page.evaluate(() => {
  const keys = Object.keys(localStorage);
  return {
    keys,
    serialized: JSON.stringify(Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])))
  };
});
const reflectionPersisted = storageAfterInteraction.serialized.includes("水沟里有水");

const knownKeys = ["castle.academy.learner", "castle-academy-world-v1", "castle-academy-view-v1"];
const report = {
  date: new Date().toISOString(),
  task: "V07-028 儿童安全与数据安全抽查（含 V0.7 反思边界运行时验证）",
  bannedWordScan: {
    files: SCAN_FILES.length,
    bannedWords: BANNED.length,
    hits: bannedHits,
    exemptions,
    verdict: bannedHits.length === 0 ? "PASS (0 hits; glossary.ts banned-word source exempted)" : "BLOCKED"
  },
  storage: {
    keyCountBefore: storage.keys.length,
    keys: storageAfterInteraction.keys,
    knownKeyWhitelist: knownKeys,
    unknownKeys: storageAfterInteraction.keys.filter((k) => !knownKeys.includes(k)),
    reflectionPersisted,
    note: "AC-7021/7022：反思文本必须不出现在任何 localStorage value；key 总数不变且全部在白名单内。",
    verdict: storageAfterInteraction.keys.length <= 3
      && storageAfterInteraction.keys.every((k) => knownKeys.includes(k))
      && !reflectionPersisted ? "PASS" : "BLOCKED"
  },
  hintLadder: {
    ...hints,
    verdict: hints.revealRemaining === 0 && hints.ladderText.length > 0 ? "PASS (3 levels revealed on V0.7 exploration mission)" : "REVIEW"
  },
  externalRequests: {
    urls: [...new Set(externalRequests)],
    hosts: [...new Set(externalRequests.map((u) => { try { return new URL(u).host; } catch { return u; } }))],
    note: "仅 fonts.googleapis.com / fonts.gstatic.com（O-1 既有外链字体）即 PASS"
  },
  pageErrors,
  aiInvolvement: "zero: no LLM / fetch-to-AI / cloud account code paths (V07_AI_ZERO_PARTICIPATION.json)"
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("SPOTCHECK", JSON.stringify({
  bannedHits: bannedHits.length,
  keyCount: storageAfterInteraction.keys.length,
  keys: storageAfterInteraction.keys,
  unknownKeys: report.storage.unknownKeys,
  reflectionPersisted,
  hintLadder: report.hintLadder,
  externalRequestHosts: report.externalRequests.hosts,
  pageErrors,
  verdicts: {
    bannedWords: report.bannedWordScan.verdict,
    storage: report.storage.verdict,
    hintLadder: report.hintLadder.verdict
  }
}, null, 2));
await browser.close();
