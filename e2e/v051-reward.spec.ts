import { test, expect, type Page } from "@playwright/test";

/** V51-012 — 完成反馈与奖励解锁（AC-214/224/225、S7） */

async function completeMoat(page: Page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.evaluate(() => {
    const a = (window as any).__CASTLE_TEST__;
    a.placeWaterSource(5, 1, 0);
    a.placeWaterSource(-5, 1, 0);
    a.placeWaterSource(0, 1, 5);
    a.placeWaterSource(0, 1, -5);
  });
  await expect(page.getByTestId("reward-reveal")).toBeVisible({ timeout: 15000 });
}

test("完成护城河 → 反馈说明做了什么/学到什么 + 装饰称号 + 双出口", async ({ page }) => {
  await completeMoat(page);
  const reveal = page.getByTestId("reward-reveal");
  await expect(reveal).toContainText("注满护城河完成了！");
  await expect(reveal).toContainText("护城河碧波荡漾");
  await expect(reveal).toContainText("水沿地形扩散有范围上限");
  await expect(page.getByTestId("reward-title")).toContainText("护城河功臣");
  await expect(reveal.getByRole("button", { name: /下一个任务/ })).toBeVisible();
  await expect(reveal.getByRole("button", { name: /自由建造/ })).toBeVisible();
});

test("奖励揭示动画 ≤400ms；完成幂等，不重复弹窗（AC-214/224）", async ({ page }) => {
  await completeMoat(page);
  const duration = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".ca-reward-card")!).animationDuration
  );
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.4);

  await page.getByRole("button", { name: /自由建造/ }).click();
  await expect(page.getByTestId("reward-reveal")).toHaveCount(0);
  // 再次扰动水域：已完成任务不得重复发奖
  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeWaterSource(5, 2, 0));
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("reward-reveal")).toHaveCount(0);
  const granted = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status
  );
  expect(granted).toBe("completed");
});

test("「下一个任务」切换到未完成任务的详情，奖励 UI 无 emoji", async ({ page }) => {
  await completeMoat(page);
  const reveal = page.getByTestId("reward-reveal");
  expect(await reveal.innerText()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  await reveal.getByRole("button", { name: /下一个任务/ }).click();
  await expect(reveal).toHaveCount(0);
  await expect(page.getByTestId("mission-detail")).toBeVisible();
  await expect(page.getByTestId("mission-detail")).toContainText("城堡水井");
});
