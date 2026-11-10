import { test, expect } from "@playwright/test";

/** V51-010 — 任务侧栏交互与视口不变约束（AC-220/221/225、R-606） */

async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  await expect(page.getByTestId("mission-sidebar")).toBeVisible();
}

test("侧栏默认折叠；悬停热区展开；移开 650ms 后自动折叠", async ({ page }) => {
  await boot(page);
  const sidebar = page.getByTestId("mission-sidebar");
  await expect(sidebar).toHaveAttribute("data-open", "false");
  await page.getByRole("button", { name: "展开任务列表" }).hover();
  await expect(sidebar).toHaveAttribute("data-open", "true");
  await expect(page.getByRole("region", { name: "任务列表" })).toBeVisible();
  await page.mouse.move(640, 400);
  await expect.poll(() => sidebar.getAttribute("data-open"), { timeout: 3000 }).toBe("false");
});

test("固定后不自动折叠；显式按钮可展开/收起（触屏路径）", async ({ page }) => {
  await boot(page);
  const sidebar = page.getByTestId("mission-sidebar");
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  await expect(sidebar).toHaveAttribute("data-open", "true");
  await page.getByRole("button", { name: "固定侧栏" }).click();
  await page.mouse.move(640, 400);
  await page.waitForTimeout(900);
  await expect(sidebar).toHaveAttribute("data-open", "true");
  await page.getByRole("button", { name: "收起任务侧栏" }).first().click();
  await expect(sidebar).toHaveAttribute("data-open", "false");
});

test("键盘可达：聚焦热区即展开，aria-expanded 同步", async ({ page }) => {
  await boot(page);
  const strip = page.getByRole("button", { name: "展开任务列表" });
  await strip.focus();
  await expect(page.getByTestId("mission-sidebar")).toHaveAttribute("data-open", "true");
  await expect(strip).toHaveAttribute("aria-expanded", "true");
  const toggle = page.getByRole("button", { name: /收起任务侧栏|打开任务侧栏/ });
  await expect(toggle.first()).toBeVisible();
});

test("展开/折叠不改变 canvas 尺寸与相机（AC-221）", async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => ({
    box: document.querySelector('[data-testid="game-canvas"]')!.getBoundingClientRect().toJSON(),
    camera: (window as any).__CASTLE_TEST__.getPlayerPosition()
  }));
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  await expect(page.getByTestId("mission-sidebar")).toHaveAttribute("data-open", "true");
  const after = await page.evaluate(() => ({
    box: document.querySelector('[data-testid="game-canvas"]')!.getBoundingClientRect().toJSON(),
    camera: (window as any).__CASTLE_TEST__.getPlayerPosition()
  }));
  expect(after.box).toEqual(before.box);
  expect(after.camera).toEqual(before.camera);
});

test("点击任务卡片激活任务并选中；任务 UI 无 emoji 永久图标（AC-225）", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "打开任务侧栏" }).click();
  const card = page.getByRole("button", { name: /注满护城河/ });
  await card.click();
  await expect(card).toHaveAttribute("data-selected", "true");
  const status = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.getMissions().find((m: { id: string }) => m.id === "mission.moat.v1")?.status
  );
  expect(status).toBe("active");
  const text = await page.getByTestId("mission-sidebar").innerText();
  expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});
