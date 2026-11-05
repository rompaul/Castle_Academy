import { describe, expect, it } from "vitest";
import { InventoryPlugin } from "./InventoryPlugin";

describe("InventoryPlugin", () => {
  it("selects known materials and rejects unknown ids", () => {
    const inventory = new InventoryPlugin();
    inventory.select("glass");
    expect(inventory.selectedBlock).toBe("glass");
    expect(() => inventory.select("invalid" as never)).toThrow(/Unknown block/);
  });
});
