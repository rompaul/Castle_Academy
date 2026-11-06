import { test, expect } from "@playwright/test";

test("layer panel opens and closes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  // Open layer panel — the panel's "Section" label is unique to the panel
  await page.getByRole("button", { name: /Layers/i }).click();
  await expect(page.getByText("Section", { exact: true }).first()).toBeVisible();

  // Close layer panel
  await page.getByRole("button", { name: /Close/i }).click();
  await expect(page.getByText("Section", { exact: true }).first()).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test("ground and underground layer icons toggle visibility independently", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.getByRole("button", { name: /Layers/i }).click();

  // Both visible by default (defaultVisible=true; getLayerVisibility returns undefined when not explicitly set)
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("ground") ?? true)).toBe(true);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("basement-1") ?? true)).toBe(true);

  // Toggle ground visibility via dev bridge
  await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.setLayerVisibility("ground", false));
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.getLayerVisibility("ground"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("basement-1") ?? true)).toBe(true);

  await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.setLayerVisibility("ground", true));
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.getLayerVisibility("ground"))).toBe(true);

  // Toggle underground visibility via dev bridge
  await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.setLayerVisibility("basement-1", false));
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.getLayerVisibility("basement-1"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.getLayerVisibility("ground") ?? true)).toBe(true);

  // Both off -> all hidden
  await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.setLayerVisibility("ground", false));
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.getLayerVisibility("ground"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__CASTLE_TEST__.layerPlugin.getLayerVisibility("basement-1"))).toBe(false);

  expect(pageErrors).toEqual([]);
});

test("section axis icons toggle independently", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.getByRole("button", { name: /Layers/i }).click();

  // Default axis is X
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).axis).toBe("x");

  // Click Axis Y
  await page.getByTitle("Axis Y").click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).axis).toBe("y");

  // Click Axis Z
  await page.getByTitle("Axis Z").click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).axis).toBe("z");

  // Click Axis X back
  await page.getByTitle("Axis X").click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).axis).toBe("x");

  expect(pageErrors).toEqual([]);
});

test("section enabled and keep +/- toggle", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.getByRole("button", { name: /Layers/i }).click();

  // Section disabled by default
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).enabled).toBe(false);

  // Enable section
  await page.getByRole("checkbox", { name: /Enabled/i }).click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).enabled).toBe(true);

  // Default keptSide is positive
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).keptSide).toBe("positive");

  // Click Keep −
  await page.getByRole("checkbox", { name: /Keep −/i }).click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).keptSide).toBe("negative");

  // Click Keep + back
  await page.getByRole("checkbox", { name: /Keep \+/i }).click();
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).keptSide).toBe("positive");

  expect(pageErrors).toEqual([]);
});

test("section coordinate can be set", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  await page.getByRole("button", { name: /Layers/i }).click();

  // Set coordinate via the dev bridge
  await page.evaluate(() => (window as any).__CASTLE_TEST__.setSectionView({ coordinate: 4 }));
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).coordinate).toBe(4);

  await page.evaluate(() => (window as any).__CASTLE_TEST__.setSectionView({ coordinate: -4 }));
  expect((await page.evaluate(() => (window as any).__CASTLE_TEST__.getSectionView())).coordinate).toBe(-4);

  expect(pageErrors).toEqual([]);
});
