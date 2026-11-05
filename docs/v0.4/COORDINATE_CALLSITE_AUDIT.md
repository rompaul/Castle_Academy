# V0.4 Coordinate Call-site Audit — Task V04-003

**Task ID:** V04-003  
**Status:** PASS  
**Repository:** D:\data\project\Castle_Academy\Castle_Academy_V0.1_Source  
**Scope:** `src/` 目录全仓库搜索

## 1. 搜索模式与匹配文件

| 搜索模式 | 匹配文件数 | 匹配文件 |
|---|---|---|
| `isInsideBuildArea` | 3 | `src/core/world/WorldState.ts`, `src/core/world/WorldState.test.ts`, `src/core/world/coordinates.ts` |
| `y >= 0` / `y < 64` / `position.y` | 4 | `src/rendering/ThreeWorldRenderer.ts`, `src/core/world/WorldState.ts`, `src/plugins/player-controller/PlayerController.ts`, `src/core/world/coordinates.ts` |
| `raycaster` / `Raycaster` | 1 | `src/rendering/ThreeWorldRenderer.ts` |
| `WorldState` | 13 | 所有插件、渲染器、GameCanvas、测试文件 |
| `serialize` / `.load(` / `snapshot` / `SNAPSHOT_VERSION` | 3 | `src/plugins/persistence/PersistencePlugin.ts`, `src/plugins/persistence/PersistencePlugin.test.ts`, `src/core/world/WorldState.ts` |
| `ground` / `terrain` | 3 | `src/rendering/ThreeWorldRenderer.ts`, `src/ui/styles.css`, `src/ui/Hotbar.tsx` |
| `PLAYER_EYE_HEIGHT` / `tryMoveVertical` / `MIN_XZ` / `MAX_XZ` | 1 | `src/plugins/player-controller/PlayerController.ts` |

## 2. 详细调用点清单

### 2.1 边界判断：isInsideBuildArea（硬编码 y >= 0 && y < 64）

**`src/core/world/coordinates.ts:12-18`** — 定义，V0.4 负 Y 支持的首要阻塞点：

```ts
export function isInsideBuildArea(position: GridPosition, size = 32): boolean {
  if (!isGridPosition(position) || !Number.isInteger(size) || size <= 0) return false;
  const half = size / 2;
  return position.x >= -half && position.x < half &&
    position.z >= -half && position.z < half &&
    position.y >= 0 && position.y < 64;  // ← 硬编码：Y 不允许负值，上限 64
}
```

所有通过 `WorldState.get/place/remove/load` 的坐标验证最终都走此函数。

**`src/core/world/WorldState.ts`**
- Line 22: `get(position)` — 调用 `isInsideBuildArea(position)`，返回 undefined 若越界
- Line 31: `place(position, blockId)` — 调用 `isInsideBuildArea(position)`，越界返回 false
- Line 37: `remove(position)` — 调用 `isInsideBuildArea(position)`，越界返回 false
- Line 75: `load(snapshot)` — 遍历 snapshot blocks，对每个 position 调用 `isInsideBuildArea(position)`，任一越界即整体 load 失败

### 2.2 X/Z 边界与垂直移动限制

**`src/plugins/player-controller/PlayerController.ts`**
- Line 16-17: `MIN_XZ = -15.5`, `MAX_XZ = 15.5` — 水平边界（与 coordinates.ts 的 size=32 一致，半开区间 [-16, 16)）
- Line 108-114: `tryMoveHorizontal` — 对 nextX/nextZ 分别 clamp 到 [MIN_XZ, MAX_XZ]，碰撞检测后再提交
- Line 102-104: 垂直移动输入判断 — `Space` 上升，`ControlLeft / ShiftLeft / ShiftRight` 下降
- Line 116-119: `tryMoveVertical` — `nextY` clamp 到 `[PLAYER_EYE_HEIGHT, 24]`，即玩家眼睛高度最低 1.65，最高 24。**玩家无法下沉到负 Y**，这是 V0.4 地下建造的阻塞点。
- Line 121-125: `collides(x, eyeY, z)` — 遍历 `world.all()`，对每个 block 调用 `playerIntersectsBlock` 进行圆柱-AABB 碰撞检测

### 2.3 渲染层：地面、网格、种子世界、射线

**`src/rendering/ThreeWorldRenderer.ts`**
- Line 53-56: `groundGeometry = BoxGeometry(32, 1, 32)`，`ground.position.y = -0.5` — 地面顶面在 y=0，底面在 y=-1
- Line 61-63: `grid = GridHelper(32, 32, ...)`，`grid.position.y = 0.01` — 网格贴在地面顶面
- Line 118-133: `seedWorld()` — 仅在 `y=0` 放置 grass 边框和 wood 垂直柱，没有负 Y 种子数据
- Line 173-177: `reloadFromWorld()` — 从 `this.world.all()` 重建所有 Mesh，**支持任意 Y 坐标**（本身无 y>=0 限制）
- Line 179-231: `onPointerDown` — 左键放置/右键移除，通过 `adjacentPosition()` 计算目标位置
- Line 237-271: `updateRay` — 射线检测目标包含 `[...this.blockMeshes.values(), this.ground]`，**地面 mesh 参与射线命中**
- Line 273-288: `adjacentPosition` — 对 `ground` 点击硬返回 `{ x, y: 0, z }`；对方块点击沿面法线偏移。**无法在地下表面或负 Y 位置放置方块**，这是 V0.4 地下建造的阻塞点。

### 2.4 持久化：serialize / load / snapshot

**`src/core/world/WorldState.ts`**
- Line 9-12: `WorldSnapshot` 接口 — `{ version: number, blocks: Array<{x,y,z,blockId}> }`
- Line 14: `SNAPSHOT_VERSION = 1`
- Line 56-66: `serialize()` — 导出所有方块的位置和 blockId
- Line 68-81: `load(snapshot)` — 先 `this.clear()`，再逐块 `place()`；任一 block 非法（越界或无效 blockId）即整体返回 false，**不会部分加载**

**`src/plugins/persistence/PersistencePlugin.ts` (V0.2)**
- Line 37-40: `storageKey = "castle-academy-world-v1"`, `enabled = true`
- Line 79-92: `saveWorld()` — `JSON.stringify(this.world.serialize())` 写入 localStorage
- Line 94-113: `loadWorld()` — `JSON.parse` 后调用 `this.world.load(snapshot)`，成功则触发 `onReload`

### 2.5 直接访问 WorldState 的模块（13 个文件）

| 文件 | 访问方式 |
|---|---|
| `src/core/world/WorldState.ts` | 定义 get/place/remove/all/clear/serialize/load |
| `src/plugins/building/BuildingPlugin.ts` | 调用 `world.place` / `world.remove`，发射事件 |
| `src/plugins/building-tools/BuildingToolsPlugin.ts` | 调用 `world.place` (line/fill)，读取 `world.get` (copy) |
| `src/plugins/blueprint/BlueprintPlugin.ts` | 调用 `world.place` (placeBlueprint) |
| `src/plugins/persistence/PersistencePlugin.ts` | 调用 `world.serialize` / `world.load` |
| `src/plugins/player-controller/PlayerController.ts` | 调用 `world.all()` (collides) |
| `src/rendering/ThreeWorldRenderer.ts` | `this.world` 成员，调用 `building.place/remove`（间接访问 WorldState） |
| `src/rendering/GameCanvas.tsx` | 通过 `engine.world` 暴露给 gameRef |
| 对应 6 个 `.test.ts` 文件 | 直接实例化 WorldState 并调用 place/remove/get/all/serialize/load |

## 3. 审计结论

**V0.4 负 Y 支持的关键代码点（必须修改）：**

1. `src/core/world/coordinates.ts:17` — `isInsideBuildArea` 的 `position.y >= 0 && position.y < 64`：**唯一硬编码 Y 边界**，必须改为配置化世界边界（建议 `-32 <= y < 64`，X/Z 保持不变）。
2. `src/plugins/player-controller/PlayerController.ts:117` — `tryMoveVertical` 的 `clamp(..., PLAYER_EYE_HEIGHT, 24)`：**玩家无法下沉到负 Y**，需放宽或重构垂直移动边界。
3. `src/rendering/ThreeWorldRenderer.ts:56` / `:62` — ground (`y=-0.5`) 和 grid (`y=0.01`)：**负 Y 建筑会被地面遮挡**，V0.4 需调整地表渲染以不遮挡地下空间。
4. `src/rendering/ThreeWorldRenderer.ts:276-288` — `adjacentPosition` 对 ground 硬返回 `y=0`：**无法在地下表面放置方块**，需支持负 Y 相邻位置计算。
5. `src/plugins/persistence/PersistencePlugin.ts` + `WorldState.load` — `load` 会 `clear()` 现有世界：**V0.4 存档迁移需幂等，旧坐标不可改写**。

**不需要修改的点（已支持任意 Y）：**
- `WorldState.get/place/remove/all` 本身不限制 Y 符号，仅依赖 `isInsideBuildArea`
- `ThreeWorldRenderer.reloadFromWorld` 从 `world.all()` 重建 Mesh，不限制 Y
- `BuildingToolsPlugin.placeLine` / `fillRectangle` 对坐标无 Y 符号假设

## 4. Files Changed

无（审计只读，不修改源码）

## 5. Design / Interface Impact

无（审计报告，不涉及接口变更；V04-004 ADR 校准将基于本审计结果）

## 6. Tests Added / Changed

无

## 7. Commands Actually Run

| 命令 | 退出码 |
|---|---|
| `rg isInsideBuildArea src/` | 0 |
| `rg 'y\s*>=\s*0\|y\s*<\s*64\|position\.y' src/` | 0 |
| `rg raycaster src/` | 0 |
| `rg WorldState src/` | 0 |
| `rg 'serialize\|\.load(\|snapshot\|SNAPSHOT_VERSION' src/` | 0 |
| `rg ground src/` | 0 |
| `rg 'PLAYER_EYE_HEIGHT\|tryMoveVertical\|MIN_XZ\|MAX_XZ' src/` | 0 |

## 8. Remaining Defects / Risks

- 五项关键代码点（见第 3 节）需在 V04-005 至 V04-009 中逐一修改，否则负 Y 方块无法放置/渲染/碰撞。
- 存档迁移（V04-007）需处理 V0.2 schema version 1 到 V0.4 新图层/剖面状态的向后兼容。

## 9. Next Eligible Task ID

**V04-004 — ADR Calibration**（对照真实仓库校准 ADR-0004，确认 y=0 语义、X/Z/Y bounds、默认层高与层范围、V0.2 存档迁移、剖面实现方式；未经确认不进入 V04-005）
