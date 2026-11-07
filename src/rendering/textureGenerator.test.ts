import { describe, expect, it } from "vitest";

/**
 * 纹理生成器注册表完整性测试（node 环境）。
 * generateCanvas 依赖 document.createElement（浏览器 API），
 * node 环境只验证 GENERATORS 键的完整性，不实际生成 canvas。
 * 实际纹理生成在 E2E（浏览器）中验证。
 */

// 通过 hasTextureSet 间接验证注册表
import { hasTextureSet, TEXTURE_SIZE, BLOCK_IDS_WITH_TEXTURES } from "./textureGenerator";

describe("textureGenerator registry (V042-007)", () => {
  it("纹理尺寸为 16×16", () => {
    expect(TEXTURE_SIZE).toBe(16);
  });

  it("垂直切片 8 块全部有纹理集", () => {
    const slice = ["grass", "dirt", "stone", "wood", "brick", "foundation_concrete", "window_frame", "stair_stone"];
    for (const id of slice) {
      expect(hasTextureSet(id)).toBe(true);
    }
  });

  it("全部 22 个 V0.3+V0.4.2 块都有纹理集", () => {
    const all = [
      "grass", "dirt", "stone", "wood", "sand", "brick", "glass",
      "sandstone_warm", "rock_moss", "gravel", "wood_walnut", "brick_limestone",
      "tile_slate", "foundation_concrete", "footing_carved", "wall_plaster",
      "wall_timber_frame", "tunnel_lining", "pillar_corner", "arch_keystone",
      "stair_stone", "window_frame",
    ];
    for (const id of all) {
      expect(hasTextureSet(id), `missing texture set for ${id}`).toBe(true);
    }
  });

  it("导出的带纹理块 ID 列表与 22 块一致", () => {
    expect(BLOCK_IDS_WITH_TEXTURES.length).toBe(22);
    expect(BLOCK_IDS_WITH_TEXTURES).toContain("grass");
    expect(BLOCK_IDS_WITH_TEXTURES).toContain("window_frame");
    expect(BLOCK_IDS_WITH_TEXTURES).toContain("stair_stone");
  });

  it("未知块无纹理集（回退纯色）", () => {
    expect(hasTextureSet("unknown_block")).toBe(false);
  });
});
