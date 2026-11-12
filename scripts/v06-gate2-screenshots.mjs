/**
 * V06-021 准备 — STOP GATE-2 K1~K6 截图（只产出截图，不做像素判定）。
 *
 * 前置：dev server 运行于 http://127.0.0.1:5173
 * 用法：node scripts/v06-gate2-screenshots.mjs
 * 产出：docs/v0.6/screenshots/gate2/k1~k6/*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = resolve(process.cwd(), "docs/v0.6/screenshots/gate2");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

async function shot(name) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  console.log(`SHOT ${name}`);
}

async function hideWelcome() {
  await page.addStyleTag({ content: ".welcome-overlay, .help-panel { display: none !important; }" });
}

/* ---------- 建档进入世界 ---------- */
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
await page.waitForTimeout(900);
await hideWelcome();
await page.getByTestId("onboarding-nickname").fill("小小工程师");
await page.getByRole("button", { name: "下一步" }).click();
await page.getByRole("button", { name: "年龄段 8-10" }).click();
await page.getByRole("button", { name: /进入世界/ }).click();
await page.waitForTimeout(600);

/* ---------- K1：世界主视图 + 任务侧栏（基线态） ----------
   建档后侧栏会自动展开：已展开则直接固定，否则先点开。 */
const collapseBtn = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await collapseBtn.first().isVisible())) {
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
}
await page.getByRole("button", { name: "固定侧栏" }).click();
await page.waitForTimeout(350);
await shot("k1-world-sidebar-baseline");

/* ---------- K2：任务详情 · 知识点关联卡 ---------- */
await page.getByRole("button", { name: /注满护城河/ }).click();
await page.waitForTimeout(300);
await shot("k2-mission-knowledge-points");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* ---------- K3：任务链 · 先决条件锁定态（水往哪里流未完成 → 七步之约锁定） ---------- */
await page.getByRole("button", { name: /^七步之约/ }).click();
await page.waitForTimeout(300);
await shot("k3-mission-locked");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* ---------- K4：任务链 · 解锁推进态（完成水往哪里流 → 七步之约解锁） ---------- */
await page.evaluate(() => {
  (window).__CASTLE_TEST__.placeWaterSource(5, 4, 0);
});
await page.waitForTimeout(1600); // 等水落到低处（y<=-1），water-flow 完成并发 mission.unlocked
// water-flow 完成会弹奖励卡，先关掉（自由建造会收起侧栏），再重新展开侧栏
await page.getByTestId("reward-reveal").waitFor({ state: "visible", timeout: 15000 });
await page.getByTestId("reward-reveal").getByRole("button", { name: "自由建造" }).click();
await page.waitForTimeout(400);
const reopen = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await reopen.first().isVisible())) {
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  await page.waitForTimeout(300);
}
await page.getByRole("button", { name: /^七步之约/ }).click();
await page.waitForTimeout(300);
await shot("k4-mission-unlocked");
await page.getByRole("button", { name: "关闭任务详情" }).click();

/* ---------- K5：证据记录面板（完成护城河后查看证据） ---------- */
await page.evaluate(() => {
  const a = (window).__CASTLE_TEST__;
  a.placeWaterSource(5, 1, 0);
  a.placeWaterSource(-5, 1, 0);
  a.placeWaterSource(0, 1, 5);
  a.placeWaterSource(0, 1, -5);
});
await page.getByTestId("reward-reveal").waitFor({ state: "visible", timeout: 15000 });
// 奖励按完成顺序排队（水往哪里流 → 注满护城河），逐张关闭
for (let i = 0; i < 4 && (await page.getByTestId("reward-reveal").count()) > 0; i++) {
  await page.getByTestId("reward-reveal").getByRole("button", { name: "自由建造" }).click();
  await page.waitForTimeout(400);
}
// 关奖励会收起侧栏，重新展开后再打开证据面板
const reopen2 = page.getByRole("button", { name: "收起任务侧栏" });
if (!(await reopen2.first().isVisible())) {
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  await page.waitForTimeout(300);
}
await page.getByTestId("evidence-toggle").click();
await page.waitForTimeout(300);
await shot("k5-evidence-record");
await page.getByRole("button", { name: "关闭证据记录" }).click();

/* ---------- K6：档案 v2 迁移/容错提示（非模态卡片） ----------
   v1→v2 迁移是静默原子操作（无提示）；提示卡由容错恢复（learner.profile.recovered）触发。
   注入损坏档案后重载，展示 K6 的提示卡形态。 */
await page.evaluate(() => localStorage.setItem("castle.academy.learner", "{broken json"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__CASTLE_TEST__), null, { timeout: 30000 });
await page.waitForTimeout(900);
await hideWelcome();
await page.getByRole("button", { name: "打开任务侧栏" }).click();
await page.waitForTimeout(300);
await page.getByTestId("profile-notice").waitFor({ state: "visible", timeout: 10000 });
await shot("k6-profile-migration-notice");

await browser.close();
console.log(`DONE -> ${OUT}`);
