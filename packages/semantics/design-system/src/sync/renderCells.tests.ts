import { describe, expect, it } from "vitest";
import type { BindingFinding } from "../transform/tokenBindings.js";
import type { CellPlan, Verb } from "./planCells.js";
import renderCells from "./renderCells.js";

/** A plan, with everything empty but what a case is about. */
function plan(
  overrides: Partial<CellPlan> = {},
  verb: Verb = "write",
): CellPlan {
  return {
    verb,
    considered: 0,
    unchanged: [],
    updates: [],
    missing: [],
    only: null,
    tiers: null,
    ...overrides,
  };
}

const UPDATE = {
  uri: "global.component.button",
  rowId: "i-1",
  before: "node:\n  uri: a\n",
  after: "node:\n  uri: b\n  styles: {}\n",
  source: "anatomies/authored/global/global.component.button.yaml",
};

describe("renderCells", () => {
  it("leads with the counts, so they can be read before anything else", () => {
    const output = renderCells({
      plan: plan({ considered: 3, unchanged: ["a", "b"], updates: [UPDATE] }),
      refusals: [],
      apply: false,
    });

    expect(output).toContain("authored       3");
    expect(output).toContain("unchanged      2");
    expect(output).toContain("to update      1");
    expect(output).toContain("missing        0");
  });

  it("describes each update compactly: the row, the two lengths and the first difference", () => {
    const output = renderCells({
      plan: plan({ considered: 1, updates: [UPDATE] }),
      refusals: [],
      apply: false,
    });

    expect(output).toContain(
      "~ global.component.button (row i-1) 3 → 4 lines, first differs at line 2",
    );
    expect(output).toContain("-   uri: a");
    expect(output).toContain("+   uri: b");
  });

  it("says why a missing row is missing, in the words of the direction", () => {
    const missing = [
      {
        uri: "global.component.ghost",
        source: "anatomies/authored/global/global.component.ghost.yaml",
      },
    ];

    expect(
      renderCells({ plan: plan({ missing }), refusals: [], apply: false }),
    ).toContain("the file is stale or the uri is wrong");
    expect(
      renderCells({
        plan: plan({ missing }, "restore"),
        refusals: [],
        apply: false,
      }),
    ).toContain("deleted since the snapshot was taken");
  });

  it("samples the cells already in step rather than listing hundreds of them", () => {
    const output = renderCells({
      plan: plan({
        considered: 7,
        unchanged: ["a", "b", "c", "d", "e", "f", "g"],
      }),
      refusals: [],
      apply: false,
    });

    expect(output).toContain("= a");
    expect(output).toContain("= e");
    expect(output).not.toContain("= f");
    expect(output).toContain("… and 2 more");
  });

  it("omits a section that has nothing in it", () => {
    const output = renderCells({ plan: plan(), refusals: [], apply: false });
    expect(output).not.toContain("cells to update:");
    expect(output).not.toContain("cells already in step:");
    expect(output).not.toContain("warnings");
    expect(output).not.toContain("findings");
  });

  it("separates the warnings that print from the findings that refuse", () => {
    const findings: BindingFinding[] = [
      { code: "AT11", severity: "warning", message: "a state differs" },
      { code: "X1", severity: "finding", message: "no such symbol" },
    ];
    const output = renderCells({
      plan: plan(),
      findings,
      refusals: [],
      apply: false,
    });

    expect(output).toContain("warnings — printed, and the run proceeds:");
    expect(output).toContain("⚠ AT11 a state differs");
    expect(output).toContain("findings — every one of these refuses --apply:");
    expect(output).toContain("✗ X1 no such symbol");
  });

  it("names the anatomy when the run is scoped to one", () => {
    expect(
      renderCells({
        plan: plan({ only: "global.component.button", considered: 1 }),
        refusals: [],
        apply: false,
      }),
    ).toContain("Anatomy cells — global.component.button, one anatomy");
  });

  it("names the tiers in force in the header, so the counts are read against them", () => {
    expect(
      renderCells({
        plan: plan({ tiers: ["global", "apps"], considered: 2 }),
        refusals: [],
        apply: false,
      }),
    ).toContain(
      "Anatomy cells — the authored anatomies against uiBlocks.anatomy_dsl (tiers: global, apps)",
    );
  });

  it("names the tiers alongside the one anatomy when both narrow the run", () => {
    expect(
      renderCells({
        plan: plan({
          only: "global.component.button",
          tiers: ["global"],
          considered: 1,
        }),
        refusals: [],
        apply: false,
      }),
    ).toContain(
      "Anatomy cells — global.component.button, one anatomy (tiers: global)",
    );
  });

  it("closes with the dry-run line, and says which verb would follow", () => {
    expect(renderCells({ plan: plan(), refusals: [], apply: false })).toContain(
      "✓ dry run: nothing written. Re-run with --apply to write.",
    );
    expect(
      renderCells({ plan: plan({}, "restore"), refusals: [], apply: false }),
    ).toContain("Re-run with --apply to restore.");
  });

  it("closes with every refusal, each on its own line", () => {
    const output = renderCells({
      plan: plan(),
      refusals: ["CI is set.", "the plan is empty"],
      apply: true,
    });

    expect(output).toContain("✗ --apply refused:");
    expect(output).toContain("  ✗ CI is set.");
    expect(output).toContain("  ✗ the plan is empty");
  });

  it("leads with the apply's own log, and closes saying the gates were open", () => {
    const output = renderCells({
      plan: plan({ considered: 1, updates: [UPDATE] }),
      refusals: [],
      apply: true,
      log: ["✓ snapshot written: anatomies/snapshots/stamp-uiBlocks.json"],
    });

    expect(output.split("\n")[0]).toBe(
      "✓ snapshot written: anatomies/snapshots/stamp-uiBlocks.json",
    );
    expect(output).toContain("✓ every gate open — write applied.");
  });
});
