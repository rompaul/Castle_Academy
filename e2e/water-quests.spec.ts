import { test, expect } from "@playwright/test";

/**
 * V05-013 — 水工程与城堡水务任务 E2E（AC-117~119 的自动化层）。
 * 任务面板可见、水方块可放置、护城河任务可推进、任务事件不产生页面错误。
 */

test("castle water quests panel shows three tasks with progress", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Enter World/i })).toBeVisible();

  await expect(page.getByText("城堡水务任务")).toBeVisible();
  await expect(page.getByText("注满护城河")).toBeVisible();
  await expect(page.getByText("城堡水井")).toBeVisible();
  await expect(page.getByText("地牢告急")).toBeVisible();

  // 初始状态：护城河 0%，地牢不伪完成
  await expect.poll(() =>
    page.evaluate(() => {
      const api = (window as any).__CASTLE_TEST__;
      const quests = api.getQuests();
      const moat = quests.find((q: { id: string }) => q.id === "quest-moat");
      const dungeon = quests.find((q: { id: string }) => q.id === "quest-dungeon");
      return { moat: moat.progress, dungeonDone: dungeon.complete };
    })
  ).toEqual({ moat: 0, dungeonDone: false });

  expect(pageErrors).toEqual([]);
});

test("placing moat water sources advances the moat quest", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.evaluate(() => {
    (window as any).__CASTLE_TEST__.placeWaterSource(5, 1, 0);
    (window as any).__CASTLE_TEST__.placeWaterSource(-5, 1, 0);
  });

  // 水 tick 分批应用，等待收敛后护城河进度应显著上升
  await expect.poll(() =>
    page.evaluate(() => {
      const api = (window as any).__CASTLE_TEST__;
      const moat = api.getQuests().find((q: { id: string }) => q.id === "quest-moat");
      return moat.progress;
    }),
    { timeout: 10_000 }
  ).toBeGreaterThan(0.5);
});

test("water state is rebuilt from sources after reset (derived state replay)", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeWaterSource(5, 1, 0));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.reset());

  // reset 回到种子世界：地牢渗水水源重放重算，水域重新出现并收敛
  const water = await page.evaluate(() => (window as any).__CASTLE_TEST__.getWater());
  expect(water.cells.length).toBeGreaterThan(0);
  expect(water.isConverged).toBe(true);
});
