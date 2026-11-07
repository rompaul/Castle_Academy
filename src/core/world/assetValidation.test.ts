import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, BLOCKS } from "./blocks";
import { hasFaceTexture } from "../../rendering/textureGenerator";

/**
 * V042-013 资产校验：块注册表 × 纹理注册表 × 资产清单 三方一致性。
 * 对应执行包要求：duplicate IDs、missing face texture、invalid manifest 校验。
 * 注：像素级 Canvas 生成依赖浏览器环境，此处校验注册表解析；
 * 实际渲染由 E2E 与游戏内截图（docs/v0.4/screenshots/）验证。
 */

const FACES = ["top", "side", "bottom"] as const;

describe("asset validation (V042-013)", () => {
  it("所有块 ID 唯一（无重复资产条目）", () => {
    const ids = BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个块的三个面都在纹理注册表中（无缺失面纹理）", () => {
    for (const block of BLOCKS) {
      for (const face of FACES) {
        expect(
          hasFaceTexture(block.id, face),
          `${block.id}:${face} 缺失纹理注册`
        ).toBe(true);
      }
    }
  });

  it("material 引用键与纹理注册表解析一致", () => {
    // material 键是文档性引用；真实解析走 generateTextureSet，
    // 这里校验 material 三面键已声明（不存在未声明面的块）
    for (const block of BLOCKS) {
      for (const face of FACES) {
        expect(
          (block.material as Record<string, unknown>)[face],
          `${block.id} material.${face} 未声明`
        ).toBeDefined();
      }
      expect(block.material.texelSize).toBe(16);
    }
  });

  it("ASSET_MANIFEST 与 BLOCKS 完全一致（无无效清单）", () => {
    expect(Object.keys(ASSET_MANIFEST.entries).sort()).toEqual(
      BLOCKS.map((b) => b.id).sort()
    );
    for (const block of BLOCKS) {
      const entry = ASSET_MANIFEST.entries[block.id];
      expect(entry.model).toEqual(block.model);
      expect(entry.material).toEqual(block.material);
      expect(entry.behavior).toEqual(block.behavior);
    }
  });

  it("透明块声明与行为一致（glass/window_frame）", () => {
    for (const block of BLOCKS) {
      const declaredTransparent = (block.material as { transparent?: boolean }).transparent === true;
      if (declaredTransparent) {
        expect(["glass", "window_frame"]).toContain(block.id);
      }
    }
    expect(ASSET_MANIFEST.entries.glass.material.transparent).toBe(true);
  });

  it("同一方块纹理键重复查询结果稳定（注册表确定性）", () => {
    for (const face of FACES) {
      expect(hasFaceTexture("brick", face)).toBe(true);
      expect(hasFaceTexture("brick", face)).toBe(true);
    }
    expect(hasFaceTexture("nonexistent_block", "top")).toBe(false);
  });
});
