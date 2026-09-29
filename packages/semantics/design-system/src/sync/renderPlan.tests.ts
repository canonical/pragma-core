import { describe, expect, it } from "vitest";
import renderPlan from "./renderPlan.js";
import type { SyncPlan } from "./types.js";

const EMPTY: SyncPlan = { ops: [], violations: [], unmanaged: [] };

describe("renderPlan", () => {
  it("summarises change vs unchanged counts", () => {
    const plan: SyncPlan = {
      ...EMPTY,
      ops: [
        {
          kind: "rename",
          rowId: "i-1",
          before: { name: "Text", tier: "Global/Form", type: "Component" },
          after: { name: "TextField", tier: "Global/Form", type: "Component" },
          changedFields: ["name"],
        },
        {
          kind: "keep",
          rowId: "i-2",
          before: { name: "Form", tier: "Global/Form", type: "Pattern" },
          after: { name: "Form", tier: "Global/Form", type: "Pattern" },
          changedFields: [],
        },
      ],
    };

    const out = renderPlan(plan);
    expect(out).toContain("1 change(s), 1 unchanged");
    expect(out).toContain("~ rename Text [Global/Form/Component] → TextField");
  });

  it("renders the ✓ verdict when there are no violations", () => {
    expect(renderPlan(EMPTY)).toContain("✓ no guardrail violations");
  });

  it("renders the ✗ verdict and lists each violation", () => {
    const plan: SyncPlan = {
      ...EMPTY,
      violations: ["X: bad tier", "Y: missing row"],
    };
    const out = renderPlan(plan);
    expect(out).toContain("✗ 2 guardrail violation(s)");
    expect(out).toContain("✗ X: bad tier");
    expect(out).toContain("✗ Y: missing row");
  });

  it("lists unmanaged in-scope rows", () => {
    const plan: SyncPlan = {
      ...EMPTY,
      unmanaged: [
        { rowId: "i-9", name: "Button", tier: "Global", type: "Component" },
      ],
    };
    const out = renderPlan(plan);
    expect(out).toContain("Unmanaged in-scope rows (not in spec): 1");
    expect(out).toContain("? Button [Global/Component] i-9");
  });

  it("renders create and merge ops with their distinctive glyphs", () => {
    const plan: SyncPlan = {
      ...EMPTY,
      ops: [
        {
          kind: "create",
          rowId: null,
          before: null,
          after: {
            name: "SelectField",
            tier: "Global/Form",
            type: "Component",
          },
          note: "code-only input", // exercises noteSuffix's truthy branch
          changedFields: [],
        },
        {
          kind: "merge",
          rowId: "i-3",
          before: {
            name: "CustomChoices",
            tier: "Global/Form",
            type: "Component",
          },
          after: null,
          mergeInto: "i-2",
          changedFields: [],
        },
      ],
    };

    const out = renderPlan(plan);
    expect(out).toContain("+ create SelectField");
    expect(out).toContain("— code-only input"); // note rendered
    expect(out).toContain("− merge  CustomChoices → i-2");
  });

  it("renders fallback branches for degenerate ops", () => {
    const plan: SyncPlan = {
      ...EMPTY,
      ops: [
        // keep with no after → empty name/tier fallback
        {
          kind: "keep",
          rowId: "i-1",
          before: null,
          after: null,
          changedFields: [],
        },
        // merge with no before → falls back to rowId
        {
          kind: "merge",
          rowId: "i-2",
          before: null,
          after: null,
          mergeInto: "i-9",
          changedFields: [],
        },
        // mutate with neither before nor after → "(missing)" → "(removed)"
        {
          kind: "rename",
          rowId: "i-3",
          before: null,
          after: null,
          changedFields: [],
        },
        // create with no after → empty name + undefined tier/type fallback
        {
          kind: "create",
          rowId: null,
          before: null,
          after: null,
          changedFields: [],
        },
      ],
    };

    const out = renderPlan(plan);
    expect(out).toContain("= keep");
    expect(out).toContain("− merge  i-2 → i-9");
    expect(out).toContain("(missing) → (removed)");
    expect(out).toContain("+ create  ["); // null-after create renders empty name
  });
});
