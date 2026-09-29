import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import readAuthored, {
  AUTHORED_DIR,
  readAuthoredTiers,
  tierOf,
} from "./authored.js";

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "authored-test-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("readAuthored", () => {
  it("reads one file per anatomy, keyed by its own name, in a stable order", async () => {
    await mkdir(join(base, "global"), { recursive: true });
    await mkdir(join(base, "sites_webcomponentsprototype"), {
      recursive: true,
    });
    await writeFile(
      join(base, "global", "global.component.button.yaml"),
      "node:\n  uri: global.component.button\n",
      "utf-8",
    );
    await writeFile(
      join(base, "global", "NOTES.md"),
      "why the button is shaped this way\n",
      "utf-8",
    );
    await writeFile(
      join(base, "sites_webcomponentsprototype", "x.component.hero.yaml"),
      "node:\n  uri: x.component.hero\n",
      "utf-8",
    );

    const authored = readAuthored(base);

    // A note beside an anatomy is not an anatomy: only `.yaml` is read.
    expect(authored.map((entry) => entry.uri)).toEqual([
      "global.component.button",
      "x.component.hero",
    ]);
    expect(authored[0].block).toBe(`${NAMESPACES.ds}global.component.button`);
    expect(authored[0].text).toContain("uri: global.component.button");
    expect(authored[0].path).toContain("global.component.button.yaml");
  });

  it("propagates any other failure, so a wrong path is not read as empty", async () => {
    // A path that is a file rather than a directory is a mistake in the invocation,
    // and reading it as "nothing authored" would let a write plan zero changes for a
    // corpus it never looked at.
    const path = join(base, "not-a-directory");
    await writeFile(path, "", "utf-8");
    expect(() => readAuthored(path)).toThrow();
  });

  it("reads a missing directory as nothing authored, not as an error", () => {
    // A missing directory means nothing has been authored yet, and the caller says
    // that in its own words rather than propagating an ENOENT for a path the reader
    // did not ask about.
    expect(readAuthored(join(base, "never-written"))).toEqual([]);
    expect(AUTHORED_DIR).toBe("anatomies/authored");
  });

  it("reads only the tiers asked for, and opens no file outside them", async () => {
    await tiered();

    const authored = readAuthored(base, ["global", "apps"]);

    expect(authored.map((entry) => entry.uri)).toEqual([
      "apps.pattern.side_panel",
      "global.component.button",
    ]);
  });

  it("matches a tier whole, so `apps` is not `apps_lxd`", async () => {
    await tiered();

    expect(readAuthored(base, ["apps"]).map((entry) => entry.uri)).toEqual([
      "apps.pattern.side_panel",
    ]);
  });

  it("reads every tier when none is asked for", async () => {
    await tiered();

    expect(readAuthored(base)).toHaveLength(3);
  });
});

/** One anatomy in each of three tiers, two of which share a prefix. */
async function tiered(): Promise<void> {
  for (const uri of [
    "global.component.button",
    "apps.pattern.side_panel",
    "apps_lxd.component.instances",
  ]) {
    const tier = uri.split(".")[0] as string;
    await mkdir(join(base, tier), { recursive: true });
    await writeFile(
      join(base, tier, `${uri}.yaml`),
      `node:\n  uri: ${uri}\n`,
      "utf-8",
    );
  }
}

describe("tierOf", () => {
  it("is the first dotted segment, which is also the file's directory", () => {
    expect(tierOf("global.component.button")).toBe("global");
    expect(tierOf("apps_lxd.component.instances")).toBe("apps_lxd");
  });
});

describe("readAuthoredTiers", () => {
  it("names every tier the directory holds, once each and sorted", async () => {
    await tiered();

    expect(readAuthoredTiers(base)).toEqual(["apps", "apps_lxd", "global"]);
  });

  it("reads a missing directory as no tiers, and defaults to the committed one", () => {
    // The default is asserted as USED rather than as empty: a checkout with authored
    // files in it is a legitimate state, and the test must hold in both.
    expect(readAuthoredTiers(join(base, "never-written"))).toEqual([]);
    expect(readAuthoredTiers()).not.toContain("never-written");
  });
});
