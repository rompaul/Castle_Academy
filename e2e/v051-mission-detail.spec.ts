import { test, expect, type Page } from "@playwright/test";

/** V51-011 — 任务详情面板与提示阶梯（AC-222/223/225、S6/S8） */

async function boot(page: Page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
}

async function openMission(page: Page, title: RegExp) {
  await page.getByRole("button", { name: title }).click();
  await expect(page.getByTestId("mission-detail")).toBeVisible();
}

test("详情层级完整：背景 → 目标 → 进度（平实语言）→ 提示 → 反思", async ({ page }) => {
  await boot(page);
  await openMission(page, /注满护城河/);
  const detail = page.getByTestId("mission-detail");
  await expect(detail.getByText("敌军压境")).toBeVisible();
  await expect(detail.getByText(/目标：让环绕城堡的水道/)).toBeVisible();
  await expect(detail.getByTestId("mission-progress-text")).toHaveText(/已充水 \d+\/40 段/);
  await expect(detail.getByText("提示（用了不扣分，可先看别的思路）")).toBeVisible();
  await expect(detail.getByTestId("reveal-hint")).toBeVisible();
  await expect(detail.getByText(/换个思路/)).toBeVisible();
  const text = await detail.innerText();
  expect(text).not.toMatch(/\d+%/);
  expect(text).not.toMatch(/Tier|难度分层/);
});

test("提示阶梯逐级展开、次数记录且不强制先看提示", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setProfile("小小工程师", "8-10"));
  await openMission(page, /注满护城河/);
  const ladder = page.getByTestId("hint-ladder");
  await expect(ladder.locator(".ca-hint-item")).toHaveCount(0);
  await expect(page.getByTestId("hints-used")).toContainText("累计使用 0 次");

  await page.getByTestId("reveal-hint").click();
  await expect(ladder.locator(".ca-hint-item")).toHaveCount(1);
  await page.getByTestId("reveal-hint").click();
  await expect(ladder.locator(".ca-hint-item")).toHaveCount(2);
  await expect(page.getByTestId("hints-used")).toContainText("累计使用 2 次");

  const stored = await page.evaluate(() => localStorage.getItem("castle.academy.learner"));
  expect(stored).toContain('"hintsUsed":2');
  // 提示不影响任务状态，仍可自由建造
  const status = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status
  );
  expect(status).toBe("active");
});

test("能力缺失态：不隐藏、解释原因、提供「先玩别的任务」出口（S8 / AC-213）", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setCapabilityAvailable("measurement.distance", false));
  await expect(page.getByRole("button", { name: /城堡水井/ })).toBeVisible();
  await openMission(page, /城堡水井/);
  const unavailable = page.getByTestId("mission-unavailable");
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText("测量距离");
  await expect(page.getByRole("button", { name: /先玩别的任务/ })).toBeVisible();
});

test("关闭与自由建造出口；详情 UI 无 emoji 永久图标", async ({ page }) => {
  await boot(page);
  await openMission(page, /地牢告急/);
  const detail = page.getByTestId("mission-detail");
  expect(await detail.innerText()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  await detail.getByRole("button", { name: /继续自由建造/ }).click();
  await expect(page.getByTestId("mission-detail")).toHaveCount(0);
  await expect(page.getByTestId("mission-sidebar")).toHaveAttribute("data-open", "false");

  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  await openMission(page, /注满护城河/);
  await page.getByRole("button", { name: "关闭任务详情" }).click();
  await expect(page.getByTestId("mission-detail")).toHaveCount(0);
});
