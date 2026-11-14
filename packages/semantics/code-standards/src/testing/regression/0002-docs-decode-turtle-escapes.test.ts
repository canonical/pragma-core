import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/generate-docs.ts", import.meta.url),
);

describe("0002: generated docs decode Turtle escapes", () => {
  it("keeps a description whole past its escaped quotes, and decodes code", () => {
    const root = mkdtempSync(join(tmpdir(), "generate-docs-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const data = join(root, "data");
    const out = join(root, "docs");
    mkdirSync(data);
    writeFileSync(
      join(data, "sample.ttl"),
      `cs:sample a cs:Category ;
    rdfs:label "Sample"@en ;
    cs:slug "sample" .

cs:sample.rule a cs:CodeStandard ;
    cs:hasCategory cs:sample ;
    cs:description "Set \\"placing\\" on the root." ;
    cs:do [ cs:code """/a\\\\.b/""" ] .
`,
    );
    const run = spawnSync("bun", [script, out, data], { encoding: "utf8" });
    const page = readFileSync(join(out, "sample.md"), "utf8");

    expect(run.status).toBe(0);
    expect(page).toContain('\nSet "placing" on the root.\n');
    expect(page).toContain("\n/a\\.b/\n");
  });
});
