import { test, expect, type Page } from "@playwright/test";

/**
 * V0.7.1 — 「修复王国旧桥」设计→蓝图→施工→奖励完整闭环。
 * 只新增本版 spec；V0.5 基线 20 条 E2E 逐字节零改动。
 */

const MISSION_ID = "mission.bridge-repair.v1";
const PROGRESS_KEY = "castle.academy.v071.progress";

async function boot(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setProfile("桥梁测试", "8-10"));
  await expect(page.getByTestId("mission-sidebar")).toBeVisible();
  return pageErrors;
}

async function openBridgeWorkbench(page: Page) {
  const list = page.getByRole("region", { name: "任务列表" });
  if (!(await list.isVisible())) {
    await page.getByRole("button", { name: "打开任务侧栏" }).click();
  }
  await page.getByRole("button", { name: /修复王国旧桥/ }).click();
  await expect(page.getByTestId("v071-workbench")).toBeVisible();
}

async function measureCells(page: Page, from: string, to: string) {
  await page.locator(`.ca-v071-cell[title="${from}"]`).click();
  await page.locator(`.ca-v071-cell[title="${to}"]`).click();
  await page.getByTestId("v071-use-measurement").click();
}

test("桥梁任务：测绘→设计→施工→资源解锁，且自由建造不受影响", async ({ page }) => {
  const pageErrors = await boot(page);
  await openBridgeWorkbench(page);

  await measureCells(page, "(8, 7)", "(13, 7)");
  await expect(page.getByTestId("v071-design-stats")).toContainText("6 格");
  await page.getByTestId("v071-start-design").click();

  await page.getByTestId("v071-deck-width").fill("4");
  await expect(page.getByTestId("v071-design-stats")).toContainText("32 格");
  await page.getByTestId("v071-deck-width").fill("3");
  await expect(page.getByTestId("v071-design-stats")).toContainText("24 格");

  await page.getByTestId("v071-validate").click();
  await expect(page.getByTestId("v071-enter-construction")).toBeEnabled();
  await page.getByTestId("v071-enter-construction").click();
  await expect(page.getByTestId("v071-construction-hud")).toContainText("0/24 格");

  await page.evaluate(() => {
    const api = (window as any).__CASTLE_TEST__;
    for (let x = 7; x <= 14; x++) {
      for (let z = 6; z <= 8; z++) api.placeBlock(x, 2, z, "wood");
    }
  });

  await expect.poll(() => page.evaluate((id) =>
    (window as any).__CASTLE_TEST__.getMissions()
      .find((m: { id: string }) => m.id === id)?.status, MISSION_ID
  )).toBe("completed");

  const result = await page.evaluate((key) => {
    const api = (window as any).__CASTLE_TEST__;
    api.placeBlock(0, 1, 0, "stone");
    return {
      progress: JSON.parse(localStorage.getItem(key) ?? "null"),
      keys: Object.keys(localStorage).sort(),
      freeBuildWorks: api.hasBlock(0, 1, 0),
      definitionCount: api.getMissionDefinitions().length
    };
  }, PROGRESS_KEY);

  expect(result.progress.unlockedRewardIds).toContain("resourceKit.masonry_basic");
  expect(result.progress.completedMissionIds).toContain(MISSION_ID);
  expect(result.keys).toContain(PROGRESS_KEY);
  expect(result.keys).toContain("castle.academy.learner");
  expect(result.freeBuildWorks).toBe(true);
  expect(result.definitionCount).toBe(25);
  expect(pageErrors).toEqual([]);
});

test("失败路径：测量过短时不能进入施工，也不写奖励进度", async ({ page }) => {
  const pageErrors = await boot(page);
  await openBridgeWorkbench(page);

  await measureCells(page, "(8, 7)", "(9, 7)");
  await page.getByTestId("v071-start-design").click();
  await page.getByTestId("v071-validate").click();

  await expect(page.getByTestId("v071-enter-construction")).toBeDisabled();
  const hasProgress = await page.evaluate((key) => localStorage.getItem(key) !== null, PROGRESS_KEY);
  expect(hasProgress).toBe(false);
  expect(pageErrors).toEqual([]);
});
