import { test, expect } from "@playwright/test";

test("diagnose: teleport player to underground and check all edge positions", async ({ page }) => {
  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => consoleLogs.push(`pageerror: ${err.message}`));

  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__CASTLE_TEST__))).toBe(true);

  // 1. 检查初始方块计数
  const initialCount = await page.evaluate(() => (window as any).__CASTLE_TEST__.getBlockCount());
  console.log(`INITIAL_BLOCK_COUNT: ${initialCount}`);

  // 2. 进入世界
  await page.getByRole("button", { name: /Enter World/i }).click();
  await page.waitForTimeout(1000);

  // 3. 将玩家传送到地下室位置 (0, -3, 0) - 眼睛在y=-3，脚在y=-4.65，能看到y=-4的边框
  await page.evaluate(() => {
    (window as any).__CASTLE_TEST__.setPlayerPosition(0, -3, 0);
  });
  await page.waitForTimeout(1000);

  const posAfterTeleport = await page.evaluate(() => (window as any).__CASTLE_TEST__.getPlayerPosition());
  console.log(`PLAYER_POSITION_AFTER_TELEPORT: [${posAfterTeleport}]`);

  // 4. 检查地下室边框各个位置
  const edgePositions = [
    { x: 4, y: -4, z: 0, label: "east" },
    { x: -4, y: -4, z: 0, label: "west" },
    { x: 0, y: -4, z: 4, label: "south" },
    { x: 0, y: -4, z: -4, label: "north" },
    { x: 4, y: -4, z: 4, label: "south-east" },
    { x: -4, y: -4, z: -4, label: "north-west" },
  ];

  for (const p of edgePositions) {
    const has = await page.evaluate(
      ({ x, y, z }) => (window as any).__CASTLE_TEST__.hasBlock(x, y, z),
      p
    );
    console.log(`BLOCK_AT_${p.label.toUpperCase()} (${p.x},${p.y},${p.z}): ${has}`);
  }

  // 5. 检查中心位置（应该是空的）
  const centerHas = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.hasBlock(0, -4, 0)
  );
  console.log(`BLOCK_AT_CENTER (0,-4,0): ${centerHas}`);

  // 6. 检查地表对应位置
  const surfaceHas = await page.evaluate(() =>
    (window as any).__CASTLE_TEST__.hasBlock(4, 0, 0)
  );
  console.log(`BLOCK_AT_SURFACE_EDGE (4,0,0): ${surfaceHas}`);

  // 7. 截图保存
  await page.screenshot({ path: "/tmp/castle-underground-diagnosis.png", fullPage: true });
  console.log("SCREENSHOT_SAVED: /tmp/castle-underground-diagnosis.png");

  // 8. 输出所有控制台日志
  console.log("CONSOLE_LOGS:");
  consoleLogs.forEach((log) => console.log(log));

  // 断言：地下室边框至少有一个位置有方块
  const eastHas = await page.evaluate(() => (window as any).__CASTLE_TEST__.hasBlock(4, -4, 0));
  expect(eastHas).toBe(true);
});
