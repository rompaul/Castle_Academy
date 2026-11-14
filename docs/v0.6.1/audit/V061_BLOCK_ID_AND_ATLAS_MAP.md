# V061-002 方块 ID 与 Atlas 容量映射（V0.6.1）

**审计基线**：tag `v0.6.0` / `0bd6e4f`（工作树 `1052a24`，源码无差异）
**日期**：2026-11-13

## 1. 既有 25 个 Block ID 全表（FACT）

来源：`src/core/world/blocks.ts`，正则 `id: "([a-z_]+)"`，计数 25。

```
grass, dirt, stone, wood, sand, brick, glass,
sandstone_warm, rock_moss, gravel, wood_walnut, brick_limestone,
tile_slate, foundation_concrete, footing_carved, wall_plaster,
wall_timber_frame, tunnel_lining, pillar_corner, arch_keystone,
stair_stone, window_frame,
water_source, drain_channel, water_pipe_blue
```

`BlockDefinition` 结构（`blocks.ts:1-30`）：`id` + `BlockModel { type, orientation }` + `BlockMaterial { top?, side?, bottom?, texelSize?, transparent?, opacity? }` + `BlockBehavior { collidable, selectable, placeable }` + 颜色 / swatch 元数据。
**FACT**：`orientation` 字段存在于**注册表元数据**，但 `WorldSnapshot` 只存 `{x,y,z,blockId}`，不序列化朝向（见 `V061_PERSISTENCE_COMPATIBILITY_REPORT.md`）。ADR-0011 决策 5「不引入朝向」指不新增快照字段；9 个新方块应统一 `orientation: "fixed"`（风格板 §2 已规定）。

## 2. 9 个候选 Block ID 与碰撞结论（FACT）

来源：`Castle_Academy_V0.6.1_Execution_Package/03_UI/V061_Block_Style_Board.md:13-21`、`Castle_Academy_V0.6.1_Execution_Package/01_SCOPE/V061_SCOPE_AND_ACCEPTANCE.md:38-46`。

| # | 候选 ID | 儿童可见名 | 双态 |
|---|---|---|---|
| 1 | `power_source_low_voltage` | 电源 | 恒供（不做灭态） |
| 2 | `wire_basic` | 电线 | ✅ 逐段点亮 |
| 3 | `switch_open` | 开关（断开） | 不适用 |
| 4 | `switch_closed` | 开关（合上） | ✅ |
| 5 | `lamp_basic` | 灯 | ✅ |
| 6 | `signal_beacon` | 信标 | ✅ |
| 7 | `water_pump_basic` | 水泵 | ✅ |
| 8 | `water_valve_open` | 阀门（开） | 形状 + 文字 |
| 9 | `water_valve_closed` | 阀门（闭） | 不适用 |

碰撞检查脚本（本轮实际运行）：`node -e` 读取 `blocks.ts` 提取 25 个 ID，与 9 个候选比对 →
`COLLISIONS=[]`、`ALL_UNIQUE=true`、`EXISTING=25 CANDIDATES=9`。

**FACT 结论**：零碰撞，可「只追加」。注意 `water_pump_basic` / `water_valve_*` 与既有 `water_source` / `water_pipe_blue` / `drain_channel` 同属水命名域但字符串不同；`power_source_low_voltage` 含 `low_voltage` 技术命名，按 ADR-0013 决策 9/10 **不得暴露给儿童**。

## 3. Atlas 唯一瓦片容量（Q-4 核心证据）

代码事实（`src/rendering/textureGenerator.ts`）：

- `:517-518` `ATLAS_COLS = 8`、`ATLAS_ROWS = 8` → **64 格上限**，128×128 canvas。
- `:534-565` `buildBlockAtlas()`：按 `GENERATORS` 的**函数引用 identity** 去重（`slotByFn` Map），相同绘制函数共享一格；`next >= 64` 时 `:547` 抛 `Block atlas overflow`。
- `:390-468` `GENERATORS`：`${blockId}:${top|side|bottom}` → 绘制函数。

本轮实际执行的静态解析（不修改任何文件）：

```bash
node -e "... 读取 GENERATORS 块，按 '\"key\": value' 解析 ..."
# KEYS=75 NAMED_UNIQUE=28 INLINE_ARROWS=3
# UNIQUE_TILES_UPPER_BOUND=31
```

| 项 | 值 | 标注 |
|---|---|---|
| `GENERATORS` 键数 | 75 | FACT |
| 命名绘制函数（去重） | 28 | FACT |
| 独立 inline 箭头函数 | 3（`glass:top` / `glass:side` / `glass:bottom`，`:409-411`） | FACT |
| **运行时等价的唯一瓦片数** | **31** | **FACT（静态解析）**：`slotByFn` 按函数对象去重，3 个箭头是 3 个不同对象，即便 `glass:top` 与 `glass:bottom` 绘制内容相同也各占一格 |
| 上限 | 64 | FACT |
| **余量** | **33** | FACT |

28 个命名函数：
`grassTop, grassSide, soilBottom, darkSoil, layeredStone, honeyOak, clayBrick, foundationConcrete, windowFrameSide, stairStoneSide, gravel, warmSandstone, slateTile, walnutTimber, limestoneBrick, mossRock, plasterWall, timberFrameSide, tunnelLining, pillarSide, archKeystoneSide, footingCarvedSide, waterSourceTop, waterSourceSide, drainChannelTop, drainChannelSide, waterPipeSide, waterPipeCap`。

**UNKNOWN（须 V061-007 实测）**：本轮未运行时调用 `buildBlockAtlas()`（Phase 0 只读、不创建临时测试）；31 是按 `slotByFn` 语义对源码的静态等价推导。实现期必须记录运行时 `next` 实测值并写入进度日志。

**DEV-607 偏差登记**：ADR-0013 §3 与风格板 §2 起草期写「约 25 个唯一瓦片 / 余量约 39」，是**估算**。实际 31 / 33，比估算少 6 格余量。按风格板「每类至少 top + side，bottom 可复用共享函数」的建议：
- 9 类 × 2 个新函数 = +18 → 49 / 64（安全）
- 最坏 9 类 × 3 个新函数 = +27 → 58 / 64（安全，仅余 6）
- 若采用双套纹理烘焙（9×3×2 = +54）→ 85 > 64 **必然溢出**

**Q-4 定案**：上限 64 不变、不扩容（扩容改 UV 归一化会引发全量视觉差异）；双态**不烘焙双套纹理**；新增纹理函数按「每类 ≤2 个唯一函数、bottom 复用既有共享函数」设计，目标 ≤49 格；V061-007 运行时实测 `next`，>64 立即停止并报告 BLOCKED。

## 4. 渲染契约（FACT）

`src/rendering/ThreeWorldRenderer.ts`：
- `:200-202` 3 个共享材质：`opaque`（MeshStandardMaterial+atlas）、`glass`（transparent 0.48）、`frameGlass`（transparent 0.9）。
- `:213` 部分方块另有独立材质；`:222` `fallbackMaterial`；`:175` `groundMaterial`。
- `:52` `materials: Map<BlockId, THREE.Material>`，`:336-340` `resolveMaterial()` 缺失时回退。
- `:351-352` 每个 mesh 用 `resolveGeometry(blockId)` + `resolveMaterial(blockId)`。

**约束（ADR-0013 决策 4 / 停止条件）**：不得修改 3 个共享材质本身（会让所有方块一起发光），不得引入 shader overhaul，通电态不得写回 `WorldState`。Q-1 定案见 `V061_OPEN_QUESTIONS_AND_RISKS.md` §1。

## 5. 风格板与参考图（FACT）

- `03_UI/V061_Block_Style_Board.md`：9 类方块双态规格、16×16 / `texelSize:16`、明度差 ≥15%、`orientation: "fixed"`、不烘焙两套纹理。
- `03_UI/references/e1~e9.svg`：E1 热栏电力组、E2 连通、E3 断口、E4 开关双态、E5 多源冲突、E6 泵水联动、E7 三级提示、E8 剖面电线可见性、E9 双态风格板。

## 6. 差异表（本文件范围）

| 目标 | 现有 | 结论 |
|---|---|---|
| 9 个方块定义 | `blocks.ts` 注册表 | 只追加，零碰撞 |
| 9 类纹理 | `GENERATORS` 75 键 / 31 瓦片 | 追加键，复用既有绘制函数作 bottom |
| 双态视觉 | 3 共享材质 + per-block mesh | 派生 overlay 网格 / 独立材质实例，**不改共享材质** |
| 图集上限 | 8×8=64，溢出抛错 | 不扩容，V061-007 实测 |
