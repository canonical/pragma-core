/**
 * The seam between the generators and the files they write.
 *
 * Both scripts end in `if (import.meta.main) main();`, and that line is
 * load-bearing rather than tidy: every other assertion about a committed
 * stratum reads the file from disk, so a module that wrote on import would
 * make those assertions self-fulfilling — the suite would rewrite the tree it
 * is checking and then agree with it. Measured: with the guard removed from
 * `catalogue.ts` and `data/s4.web.ttl` hand-edited, the suite passed and the
 * run silently restored the file.
 *
 * So the guard is asserted here, by importing both modules and requiring
 * `data/` to be untouched — same bytes, same mtimes. This file must not import
 * either module at the top level: the import is the thing under test, and a
 * static import would happen before the snapshot.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(PKG, "data");

/** Content and mtime per stratum: the bytes catch a rewrite of a hand-edited
 * file, the mtime catches a rewrite that happens to be byte-identical. */
function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(DATA)
    .filter((n) => n.endsWith(".ttl"))
    .sort()) {
    const path = join(DATA, f);
    out[f] = `${createHash("sha256")
      .update(readFileSync(path))
      .digest("hex")}@${statSync(path).mtimeMs}`;
  }
  return out;
}

describe("importing a generator writes nothing", () => {
  it("leaves every stratum as it found it", async () => {
    const before = snapshot();
    // Guards against a snapshot of an empty directory agreeing with itself.
    expect(Object.keys(before)).toEqual([
      "s1.ttl",
      "s2.ttl",
      "s3.ttl",
      "s4.web.ttl",
    ]);

    const catalogue = await import("./catalogue.js");
    const populate = await import("./populate.js");
    // The imports happened: without this, a module that failed to load would
    // leave the files alone and pass.
    expect(typeof catalogue.main).toBe("function");
    expect(typeof populate.main).toBe("function");

    expect(snapshot()).toEqual(before);
  });
});
