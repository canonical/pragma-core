import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACK_INDEX_VERSION } from "./graphpack/types.js";
import { packDir, packsCacheDir } from "./paths.js";

describe("packDir", () => {
  it("places a pack under its index format, then its content hash", () => {
    const hash = "a".repeat(64);
    expect(packDir(hash)).toBe(
      join(packsCacheDir(), `v${PACK_INDEX_VERSION}`, hash),
    );
  });
});
