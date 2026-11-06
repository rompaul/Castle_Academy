import { test, expect } from "@playwright/test";

test("boots the rendered world and exposes the expected controls", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("CASTLE ACADEMY").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Enter World/i })).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Block selection" })).toBeVisible();
  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("places, rejects duplicate placement, removes, and resets blocks", async ({ page }) => {
  await page.goto("/");
  const initialCount = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());
  const placed = await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(0, 1, 0, "brick"));
  expect(placed).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(0, 1, 0))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(0, 1, 0, "wood"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.removeBlock(0, 1, 0))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(0, 1, 0))).toBe(false);
  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(0, 1, 0, "brick"));
  await page.evaluate(() => (window as any).__CASTLE_TEST__.reset());
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount())).toBe(initialCount);
});

test("keyboard movement updates the player position", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => (window as any).__CASTLE_TEST__.getPlayerPosition() as number[]);
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.keyboard.up("w");
  const after = await page.evaluate(() => (window as any).__CASTLE_TEST__.getPlayerPosition() as number[]);
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.1);
});


test("player cannot walk through a solid voxel", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setPlayerPosition(0, 2.2, -2.5));
  await page.keyboard.down("w");
  await page.waitForTimeout(1100);
  await page.keyboard.up("w");
  const position = await page.evaluate(() => (window as any).__CASTLE_TEST__.getPlayerPosition() as number[]);
  // The seeded wall is at z=-4; the player's radius keeps its center outside its AABB.
  expect(position[2]).toBeGreaterThan(-3.35);
});


test("hotbar selection works by number key and button", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: "Select Dirt" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Select Brick" }).click();
  await expect(page.getByRole("button", { name: "Select Brick" })).toHaveAttribute("aria-pressed", "true");
});

test("places new V0.4.2 block IDs (foundation_concrete, window_frame, stair_stone)", async ({ page }) => {
  await page.goto("/");
  const initialCount = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());

  // 新增块 ID 可正常放置
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(2, 1, 0, "foundation_concrete"))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(2, 1, 0))).toBe(true);

  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(4, 1, 0, "window_frame"))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(4, 1, 0))).toBe(true);

  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(6, 1, 0, "stair_stone"))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(6, 1, 0))).toBe(true);

  // 重置后所有块应消失
  await page.evaluate(() => (window as any).__CASTLE_TEST__.reset());
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount())).toBe(initialCount);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(2, 1, 0))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(4, 1, 0))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(6, 1, 0))).toBe(false);
});
