import { describe, expect, it } from "vitest";
import { buildAssetKey } from "./index.js";

describe("buildAssetKey", () => {
  it("produces a predictable, lowercase, project-scoped key", () => {
    const key = buildAssetKey({ projectId: "proj_1", kind: "CHARACTER_REFERENCE", assetId: "asset_1", ext: "png" });
    expect(key).toBe("projects/proj_1/character-reference/asset_1.png");
  });
});
