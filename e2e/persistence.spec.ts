import { test, expect } from "@playwright/test";

test("load button is disabled when there is no saved world", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Load world/i })).toBeDisabled();
  expect(pageErrors).toEqual([]);
});

test("save persists placed blocks across page reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  const initialCount = await page.evaluate(
    () => (window as any).__CASTLE_TEST__.getBlockCount()
  );

  // Place a brick via the dev test bridge.
  const placed = await page.evaluate(
    () => (window as any).__CASTLE_TEST__.placeBlock(0, 1, 0, "brick")
  );
  expect(placed).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(0, 1, 0))).toBe(true);

  // Save world.
  await page.getByRole("button", { name: /Save world/i }).click();
  await expect(page.getByText("World saved.", { exact: false })).toBeVisible();

  // Reload simulates browser restart; saved world must survive.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(0, 1, 0))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount())).toBe(
    initialCount + 1
  );

  // After reload a saved world exists, so Load is enabled.
  await expect(page.getByRole("button", { name: /Load world/i })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test("load world restores the last saved state", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  // First saved state: one grass block at origin.
  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(0, 1, 0, "grass"));
  await page.getByRole("button", { name: /Save world/i }).click();

  // Mutate the live world: add a second block that is NOT in the saved state.
  await page.evaluate(() => (window as any).__CASTLE_TEST__.placeBlock(2, 1, 0, "stone"));
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(2, 1, 0))).toBe(true);

  // Load should restore the saved state: grass at origin present, stone absent.
  await page.getByRole("button", { name: /Load world/i }).click();
  await expect(page.getByText("World loaded.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(0, 1, 0))).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(2, 1, 0))).toBe(false);
  expect(pageErrors).toEqual([]);
});
