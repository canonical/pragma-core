import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import readAuthored from "../anatomies/authored.js";
import checkAuthored from "./checkAuthored.js";

let base: string;
let authoredDir: string;
let dataDir: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "check-authored-test-"));
  authoredDir = join(base, "authored", "global");
  dataDir = join(base, "data");
  await mkdir(authoredDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  // The graph the `uri:` check resolves against. One subject is enough: the block
  // set is what makes a reference dangling or not.
  await writeFile(
    join(dataDir, "global.ttl"),
    '@prefix ds: <https://ds.canonical.com/>.\n\nds:global.component.button a ds:Component;\n    ds:name "Button".\n',
    "utf-8",
  );
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/** Write one authored file, and read the directory back the way the write does. */
async function authored(files: Record<string, string>) {
  for (const [uri, text] of Object.entries(files)) {
    await writeFile(join(authoredDir, `${uri}.yaml`), text, "utf-8");
  }
  return readAuthored(join(base, "authored"));
}

/** A register file with the rows given, and its path. */
async function register(rows: string): Promise<string> {
  const path = join(base, "register.yaml");
  await writeFile(path, `categories: {}\nrows:\n${rows}`, "utf-8");
  return path;
}

function run(entries: Awaited<ReturnType<typeof authored>>, registerPath = "") {
  return checkAuthored(entries, {
    dataDir,
    registerPath:
      registerPath === "" ? join(base, "absent.yaml") : registerPath,
  });
}

const codes = (findings: { code: string }[]) =>
  findings.map((finding) => finding.code);

describe("checkAuthored", () => {
  it("reports nothing for a file whose every symbol resolves", async () => {
    const entries = await authored({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: color.text\n",
    });

    expect(run(entries)).toEqual([]);
  });

  it("refuses a symbol that resolves against nothing and no register row admits", async () => {
    const entries = await authored({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
    });

    const findings = run(entries);
    expect(findings.some((finding) => finding.severity === "finding")).toBe(
      true,
    );
    expect(findings.map((finding) => finding.message).join("\n")).toContain(
      "modifier.color.nothing",
    );
  });

  it("admits that same symbol once the register carries its row", async () => {
    // The register is the law's exception clause, and it is read here rather than
    // reimplemented: one register, one meaning, whichever command consults it.
    const entries = await authored({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
    });
    const path = await register(
      [
        "  - uri: global.component.button",
        "    node: $root",
        "    key: typography.color",
        "    state: default",
        "    value: modifier.color.nothing",
        "    category: X7",
        "    considered: []",
        "    date: 2026-09-13",
        "",
      ].join("\n"),
    );

    expect(run(entries, path)).toEqual([]);
  });

  it("refuses a uri: that names no block, in the graph or in the files", async () => {
    const entries = await authored({
      "global.component.button":
        'node:\n  uri: global.component.button\n  edges:\n    - node: { uri: global.component.gone }\n      relation: { cardinality: "1" }\n',
    });

    expect(codes(run(entries))).toContain("X11");
  });

  it("resolves a uri: that names another authored file, on the run that adds both", async () => {
    // The `uri:` check resolves against the committed graph PLUS the files being
    // written. Without that, two anatomies that reference each other could never be
    // authored: whichever went first would be dangling.
    const entries = await authored({
      "global.component.button":
        'node:\n  uri: global.component.button\n  edges:\n    - node: { uri: global.component.card }\n      relation: { cardinality: "1" }\n',
      "global.component.card": "node:\n  uri: global.component.card\n",
    });

    expect(codes(run(entries))).not.toContain("X11");
  });

  it("refuses a file that does not parse as an anatomy", async () => {
    const entries = await authored({
      "global.component.button": "- not an anatomy\n",
    });

    expect(codes(run(entries))).toContain("X16");
  });

  it("reads the committed graph when no directory is given", () => {
    // The default seam. Over no authored files, so the assertion is that reading the
    // committed corpus is what it does — not that the corpus says anything.
    expect(checkAuthored([])).toEqual([]);
  });
});
