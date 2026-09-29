import { describe, expect, it } from "vitest";
import type { AuthoredAnatomy } from "../anatomies/authored.js";
import { indexBlocks, type LiveBlocks } from "./liveBlocks.js";
import planCells, {
  type CellUpdate,
  describeDiff,
  planDesiredCells,
} from "./planCells.js";

const BUTTON = "node:\n  uri: global.component.button\n";

/** An authored file, as `readAuthored` returns one. */
function authored(uri: string, text: string): AuthoredAnatomy {
  return {
    uri,
    block: `https://ds.canonical.com/${uri}`,
    path: `anatomies/authored/${uri.split(".")[0]}/${uri}.yaml`,
    text,
  };
}

/** A live table from `uri` to what its cell holds. */
function live(rows: Record<string, string>): LiveBlocks {
  return indexBlocks(
    Object.entries(rows).map(([uri, anatomyDsl], index) => ({
      rowId: `i-${index + 1}`,
      uri,
      anatomyDsl,
    })),
  );
}

/** An update, for `describeDiff` alone. */
function update(before: string, after: string): CellUpdate {
  return {
    uri: "global.component.button",
    rowId: "i-1",
    before,
    after,
    source: "fixture.yaml",
  };
}

describe("planCells", () => {
  it("plans an update for a cell whose text differs from its file", () => {
    const plan = planCells(
      [authored("global.component.button", BUTTON)],
      live({ "global.component.button": "the old literal" }),
    );

    expect(plan.verb).toBe("write");
    expect(plan.considered).toBe(1);
    expect(plan.updates).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-1",
        before: "the old literal",
        after: BUTTON,
        source: "anatomies/authored/global/global.component.button.yaml",
      },
    ]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.missing).toEqual([]);
    expect(plan.only).toBeNull();
  });

  it("plans nothing for a cell that already holds its file, to the byte", () => {
    // Equality is over the whole text, trailing newline included: the file is the
    // cell, verbatim, and a write that changed nothing but the whitespace would
    // still be a write against the document's own history.
    const plan = planCells(
      [authored("global.component.button", BUTTON)],
      live({ "global.component.button": BUTTON }),
    );

    expect(plan.unchanged).toEqual(["global.component.button"]);
    expect(plan.updates).toEqual([]);
  });

  it("reports an authored file whose uri names no live row, and never creates one", () => {
    // The roster of blocks is the pull sync's. A file naming a row that is not there
    // is a stale file or a wrong `uri:`, and both are the repository's to fix.
    const plan = planCells(
      [authored("global.component.ghost", BUTTON)],
      live({ "global.component.button": "x" }),
    );

    expect(plan.missing).toEqual([
      {
        uri: "global.component.ghost",
        source: "anatomies/authored/global/global.component.ghost.yaml",
      },
    ]);
    expect(plan.updates).toEqual([]);
  });

  it("restricts the plan to one anatomy under --only, which is the canary", () => {
    const plan = planCells(
      [
        authored("global.component.button", BUTTON),
        authored("global.component.card", "node:\n"),
      ],
      live({
        "global.component.button": "old",
        "global.component.card": "old",
      }),
      "global.component.button",
    );

    expect(plan.considered).toBe(1);
    expect(plan.updates.map((cell) => cell.uri)).toEqual([
      "global.component.button",
    ]);
    expect(plan.only).toBe("global.component.button");
  });

  it("narrows the plan to the tiers in force, and says which they are", () => {
    // The tier is the uri's first dotted segment, which is also the directory the
    // file was read from. Two tiers are written this round and a third is not: its
    // file stays authored, reviewed and lawful, and no cell of it is sent.
    const plan = planCells(
      [
        authored("global.component.button", BUTTON),
        authored("apps.pattern.side_panel", "node:\n"),
        authored("apps_lxd.component.instances", "node:\n"),
      ],
      live({
        "global.component.button": "old",
        "apps.pattern.side_panel": "old",
        "apps_lxd.component.instances": "old",
      }),
      undefined,
      ["global", "apps"],
    );

    expect(plan.considered).toBe(2);
    expect(plan.updates.map((cell) => cell.uri)).toEqual([
      "global.component.button",
      "apps.pattern.side_panel",
    ]);
    expect(plan.tiers).toEqual(["global", "apps"]);
  });

  it("matches a tier whole, never as a prefix of a longer one", () => {
    // `apps` and `apps_lxd` are two tiers and two directories, and the underscore is
    // part of the name rather than a separator: a run that covers `apps` must not
    // reach into `apps_lxd`, which this round leaves authored and unwritten.
    const plan = planCells(
      [
        authored("apps.pattern.side_panel", "node:\n"),
        authored("apps_lxd.component.instances", "node:\n"),
      ],
      live({
        "apps.pattern.side_panel": "old",
        "apps_lxd.component.instances": "old",
      }),
      undefined,
      ["apps"],
    );

    expect(plan.considered).toBe(1);
    expect(plan.updates.map((cell) => cell.uri)).toEqual([
      "apps.pattern.side_panel",
    ]);
  });

  it("composes with --only, which picks one anatomy out of the tiers in force", () => {
    const plan = planCells(
      [
        authored("global.component.button", BUTTON),
        authored("global.component.card", "node:\n"),
        authored("apps.pattern.side_panel", "node:\n"),
      ],
      live({
        "global.component.button": "old",
        "global.component.card": "old",
        "apps.pattern.side_panel": "old",
      }),
      "global.component.button",
      ["global"],
    );

    expect(plan.considered).toBe(1);
    expect(plan.only).toBe("global.component.button");
    expect(plan.tiers).toEqual(["global"]);
    expect(plan.updates.map((cell) => cell.uri)).toEqual([
      "global.component.button",
    ]);
  });

  it("considers nothing when --only names an anatomy outside the tiers in force", () => {
    // The tier narrowing is applied FIRST, so an `--only` reaching past it considers
    // nothing rather than writing a cell the header does not claim.
    const plan = planCells(
      [
        authored("global.component.button", BUTTON),
        authored("apps.pattern.side_panel", "node:\n"),
      ],
      live({
        "global.component.button": "old",
        "apps.pattern.side_panel": "old",
      }),
      "apps.pattern.side_panel",
      ["global"],
    );

    expect(plan.considered).toBe(0);
    expect(plan.updates).toEqual([]);
  });

  it("plans every tier when none is named, and says so with a null", () => {
    const plan = planCells(
      [
        authored("global.component.button", BUTTON),
        authored("apps_lxd.component.instances", "node:\n"),
      ],
      live({
        "global.component.button": "old",
        "apps_lxd.component.instances": "old",
      }),
    );

    expect(plan.considered).toBe(2);
    expect(plan.tiers).toBeNull();
  });

  it("copies the tiers rather than keeping the caller's array", () => {
    // The plan is read after the run — rendered, and printed as JSON — so it must
    // not be a view on an array the caller is free to go on editing.
    const tiers = ["global"];
    const plan = planCells(
      [authored("global.component.button", BUTTON)],
      live({ "global.component.button": "old" }),
      undefined,
      tiers,
    );
    tiers.push("apps");

    expect(plan.tiers).toEqual(["global"]);
  });

  it("considers nothing when --only names no authored anatomy", () => {
    const plan = planCells(
      [authored("global.component.button", BUTTON)],
      live({ "global.component.button": "old" }),
      "global.component.nothing",
    );
    expect(plan.considered).toBe(0);
  });
});

describe("planDesiredCells", () => {
  it("plans a restore the same way, and says which direction it is", () => {
    const plan = planDesiredCells(
      [
        {
          uri: "global.component.button",
          text: "what the snapshot recorded",
          source: "anatomies/snapshots/stamp-uiBlocks.json",
        },
      ],
      live({ "global.component.button": "what it says now" }),
      "restore",
    );

    expect(plan.verb).toBe("restore");
    expect(plan.updates[0].after).toBe("what the snapshot recorded");
    expect(plan.updates[0].before).toBe("what it says now");
    // A snapshot is of the whole table, so a restore has no tiers to narrow to: it
    // puts back what it recorded, tier by tier as the document held it.
    expect(plan.tiers).toBeNull();
  });
});

describe("describeDiff", () => {
  it("names the first line that differs, and both line counts", () => {
    const diff = describeDiff(
      update("node:\n  uri: a\n  styles: {}\n", "node:\n  uri: b\n"),
    );
    expect(diff).toEqual({
      beforeLines: 4,
      afterLines: 3,
      line: 2,
      before: "  uri: a",
      after: "  uri: b",
    });
  });

  it("reads a line past the end of the shorter side as nothing", () => {
    // An append: every line agrees until the new side has one the old side does not,
    // and that line is the difference rather than an out-of-range read.
    expect(describeDiff(update("node:", "node:\n  uri: a"))).toEqual({
      beforeLines: 1,
      afterLines: 2,
      line: 2,
      before: "",
      after: "  uri: a",
    });
    expect(describeDiff(update("node:\n  uri: a", "node:"))).toEqual({
      beforeLines: 2,
      afterLines: 1,
      line: 2,
      before: "  uri: a",
      after: "",
    });
  });

  it("runs off the end of two identical texts rather than inventing a difference", () => {
    // Not a case the plan produces — two identical texts are an unchanged cell and
    // never an update. Asserted anyway, because the alternative to walking off the
    // end is reporting line 1 as different, and a diff that lies about a cell it was
    // handed by mistake is worse than one that points past it.
    expect(describeDiff(update("node:\n", "node:\n"))).toEqual({
      beforeLines: 2,
      afterLines: 2,
      line: 3,
      before: "",
      after: "",
    });
  });
});

describe("sameCell", () => {
  it("treats a cell that differs from its file by one trailing newline as the same", async () => {
    const { sameCell } = await import("./planCells.js");
    expect(sameCell("node:\n  uri: x", "node:\n  uri: x\n")).toBe(true);
    expect(sameCell("node:\n  uri: x\n", "node:\n  uri: x")).toBe(true);
    expect(sameCell("node:\n  uri: x", "node:\n  uri: y\n")).toBe(false);
  });
});
