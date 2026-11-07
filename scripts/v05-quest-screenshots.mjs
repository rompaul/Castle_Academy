/**
 * V05-010~012 游戏内验证：任务面板 + 城堡水务舞台 + 护城河注水进度。
 * 依赖 dev server(5173) 与 DEV 模式 window.__CASTLE_TEST__。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "docs/v0.5/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5173");
await page.waitForTimeout(2500);

const initial = await page.evaluate(() => {
  const api = window.__CASTLE_TEST__;
  if (!api) return null;
  return {
    hasApi: true,
    waterCells: api.getWater?.().cells.length ?? -1,
    quests: api.getQuests?.()?.map((q) => ({ id: q.id, progress: Math.round(q.progress * 100), complete: q.complete })) ?? null
  };
});
console.log("initial:", JSON.stringify(initial));

// 进入世界
await page.getByText("Enter World").click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/quest_panel_stage.png` });

// 玩家在护城河一角放水源（任务交互模拟）
const after = await page.evaluate(() => {
  const api = window.__CASTLE_TEST__;
  api.placeWaterSource(5, 1, 0);
  api.placeWaterSource(-5, 1, 0);
  return new Promise((resolve) => setTimeout(() => {
    resolve({
      waterCells: api.getWater().cells.length,
      moat: api.getQuests().find((q) => q.id === "quest-moat")
    });
  }, 2500));
});
console.log("after sources:", JSON.stringify({
  waterCells: after.waterCells,
  moatProgress: after.moat && Math.round(after.moat.progress * 100),
  moatComplete: after.moat && after.moat.complete
}));

await page.screenshot({ path: `${OUT}/quest_moat_filling.png` });

await browser.close();
console.log("DONE");
