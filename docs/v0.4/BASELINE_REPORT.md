# V0.4 Baseline Report — Task V04-001

**Task ID:** V04-001  
**Status:** PASS  
**Repository:** D:\data\project\Castle_Academy\Castle_Academy_V0.1_Source  
**Branch:** master (git status: clean)  
**Version:** 0.3.0  
**Environment:** Node v24.14.0, npm 11.9.0

## 1. Repository Facts

- Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `test:e2e`, `typecheck`, `verify:source`
- Dependencies: react 18.3.1, three 0.172.0, vite 6.0.7, vitest 2.1.8, @playwright/test 1.49.1
- tsconfig: project references `tsconfig.app.json` + `tsconfig.node.json`
- vite: port 5173, strictPort, `@vitejs/plugin-react`
- vitest: node environment, include `src/**/*.test.ts`
- playwright: `testDir ./e2e`, `baseURL http://127.0.0.1:5173`, `webServer` 启动 dev server
- `node_modules` 已安装，`dist` 已构建

## 2. Files Inspected

| 文件 | 说明 |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `README.md` | 项目配置与说明 |
| `src/core/world/WorldState.ts` | 方块唯一事实源，含 serialize/load（V0.2 持久化） |
| `src/core/world/coordinates.ts` | 坐标工具，`isInsideBuildArea` 硬编码 `y >= 0 && y < 64` |
| `src/plugins/building/BuildingPlugin.ts` | 方块放置/移除，发射 `world.block.placed/removed` |
| `src/plugins/player-controller/PlayerController.ts` | 玩家移动与碰撞，`tryMoveVertical` 限制 y 在 `[PLAYER_EYE_HEIGHT, 24]` |
| `src/plugins/persistence/PersistencePlugin.ts` | V0.2 持久化，localStorage，schema version 1 |
| `src/plugins/building-tools/BuildingToolsPlugin.ts` | V0.3 直线/矩形填充 |
| `src/plugins/blueprint/BlueprintPlugin.ts` | V0.3 蓝图 |
| `src/plugins/measurement/MeasurementPlugin.ts` | V0.3 测量挑战 |
| `src/rendering/ThreeWorldRenderer.ts` | 渲染器，地面 y=-0.5，grid y=0.01，seedWorld 在 y=0 放草块 |
| `src/core/events/EventBus.ts` | DomainEvent 标准外壳 |
| `src/app/App.tsx`, `src/ui/Hotbar.tsx`, `src/ui/HelpPanel.tsx` | V0.3 UI（版本标识 V0.3） |
| `.gitignore`, `scripts/verify-source.mjs` | 构建忽略与源码验证 |

## 3. Files Changed

无（V04-001 只读，不修改源码）

## 4. Design / Interface Impact

无（基线报告，不涉及接口变更）

## 5. Implementation Summary

完成仓库基线盘点。确认当前架构为 **Stable Core + Modular Plugins + Event-Driven Communication**：
- `WorldState` 是方块位置与 blockId 的唯一事实来源。
- `PersistencePlugin`（V0.2）已实现 localStorage 存档，schema version 1，key `castle-academy-world-v1`。
- V0.3 建筑工具（line/fill）、蓝图、测量挑战已实现并接入 shell。
- 渲染对象（Three.js Mesh）是派生缓存，可从 WorldState 重建。

## 6. Tests Added / Changed

无

## 7. Commands Actually Run

| 命令 | 退出码 |
|---|---|
| `git status --short` | 0 |
| `git branch --show-current` | 0 |
| `git log -5 --oneline` | 0 |

其余为 Read 操作，非 shell 命令。

## 8. Remaining Defects / Risks（V0.4 相关）

1. **`coordinates.ts:17` `isInsideBuildArea` 硬编码 `position.y >= 0 && position.y < 64`** —— V0.4 负 Y 支持的首要阻塞点，必须改为统一世界边界配置。
2. **`WorldState.load` 在 load 时会 `clear()` 现有世界** —— V0.4 存档迁移需注意幂等性与旧数据不覆盖。
3. **`PlayerController.tryMoveVertical` 将 y 限制在 `[PLAYER_EYE_HEIGHT, 24]`** —— 地下空间玩家无法下沉，V0.4 需放宽或重构垂直移动边界。
4. **`ThreeWorldRenderer` 地面 mesh 在 `y=-0.5`，grid 在 `y=0.01`** —— 负 Y 建筑会被地面遮挡，V0.4 需调整地表渲染以不遮挡负 Y 空间。
5. **V0.2 持久化 schema version 为 1** —— V0.4 新增图层/剖面状态需决定是否扩展 schema，迁移必须幂等。

## 9. Next Eligible Task ID

**V04-002 — Baseline Tests**（运行安装状态检查、typecheck、unit、build、E2E，记录失败基线）
