import { describe, expect, it } from "vitest";
import diffRoster from "./diffRoster.js";
import type { LiveEntry, TargetSpec } from "./types.js";

const SCOPE: TargetSpec["scope"] = {
  documentId: "doc",
  table: "grid-x",
  tiers: ["Global", "Global/Form"],
};

/** Build a target spec from entries, with the standard form-tier scope. */
function makeSpec(
  entries: TargetSpec["entries"],
  deferred?: TargetSpec["deferred"],
): TargetSpec {
  return { scope: SCOPE, entries, deferred };
}

describe("diffRoster", () => {
  it("derives a rename op with the changed field detected against live", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "Text", tier: "Global/Form", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "TextField", tier: "Global/Form", type: "Component" },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, live);

    expect(plan.violations).toEqual([]);
    const op = plan.ops.at(0);
    expect(op?.kind).toBe("rename");
    expect(op?.changedFields).toEqual(["name"]);
    expect(op?.before?.name).toBe("Text");
    expect(op?.after?.name).toBe("TextField");
  });

  it("detects a tier change as a move", () => {
    const live: LiveEntry[] = [
      {
        rowId: "i-1",
        name: "TextInput",
        tier: "Global/Form",
        type: "Component",
      },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "TextInput", tier: "Global", type: "Component" },
        op: "move",
      },
    ]);

    const op = diffRoster(spec, live).ops.at(0);
    expect(op?.changedFields).toEqual(["tier"]);
  });

  it("detects name and type changes together for rename+retype", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "Checkbox", tier: "Global", type: "Subcomponent" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "CheckboxInput", tier: "Global", type: "Component" },
        op: "rename+retype",
      },
    ]);

    const op = diffRoster(spec, live).ops.at(0);
    expect(op?.changedFields).toEqual(["name", "type"]);
  });

  it("flags a row id that is not present in live Coda", () => {
    const spec = makeSpec([
      {
        rowId: "i-missing",
        target: { name: "X", tier: "Global", type: "Component" },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, []);
    expect(
      plan.violations.some((v) => v.includes("not found in live Coda")),
    ).toBe(true);
  });

  it("flags a target tier outside the scope fence", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Global/Form", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "X", tier: "Apps/Launchpad", type: "Component" },
        op: "move",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) => v.includes("outside the scope fence")),
    ).toBe(true);
  });

  it("flags a target type that is not an ontology UIBlock subclass", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        // biome-ignore lint/suspicious/noExplicitAny: deliberately testing an illegal type
        target: { name: "X", tier: "Global", type: "Variant" as any },
        op: "retype",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("not an ontology UIBlock subclass"),
      ),
    ).toBe(true);
  });

  it("flags a merge whose target row is missing", () => {
    const live: LiveEntry[] = [
      {
        rowId: "i-1",
        name: "CustomChoices",
        tier: "Global/Form",
        type: "Component",
      },
    ];
    const spec = makeSpec([
      { rowId: "i-1", target: null, op: "merge", mergeInto: "i-absent" },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("mergeInto target i-absent not found"),
      ),
    ).toBe(true);
  });

  it("accepts a valid merge into an existing row", () => {
    const live: LiveEntry[] = [
      {
        rowId: "i-1",
        name: "CustomChoices",
        tier: "Global/Form",
        type: "Component",
      },
      { rowId: "i-2", name: "Choices", tier: "Global/Form", type: "Component" },
    ];
    const spec = makeSpec([
      { rowId: "i-1", target: null, op: "merge", mergeInto: "i-2" },
      {
        rowId: "i-2",
        target: {
          name: "ChoicesField",
          tier: "Global/Form",
          type: "Component",
        },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(plan.violations).toEqual([]);
  });

  it("refuses to touch a deferred (out-of-scope) row", () => {
    const live: LiveEntry[] = [
      { rowId: "i-defer", name: "FormLayout", tier: "Global", type: "Layout" },
    ];
    const spec = makeSpec(
      [
        {
          rowId: "i-defer",
          target: { name: "FormLayout", tier: "Global", type: "Layout" },
          op: "move",
        },
      ],
      { rowIds: ["i-defer"] },
    );

    const plan = diffRoster(spec, live);
    expect(plan.violations.some((v) => v.includes("deferred set"))).toBe(true);
  });

  it("flags a create op that wrongly carries a row id", () => {
    const spec = makeSpec([
      {
        rowId: "i-should-be-null",
        target: { name: "NewField", tier: "Global/Form", type: "Component" },
        op: "create",
      },
    ]);

    const plan = diffRoster(spec, []);
    expect(
      plan.violations.some((v) => v.includes("create op must have rowId null")),
    ).toBe(true);
  });

  it("reports in-scope live rows absent from the spec as unmanaged", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "Text", tier: "Global/Form", type: "Component" },
      { rowId: "i-2", name: "Button", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "TextField", tier: "Global/Form", type: "Component" },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(plan.unmanaged.map((r) => r.rowId)).toEqual(["i-2"]);
  });

  it("does not report out-of-scope live rows as unmanaged", () => {
    const live: LiveEntry[] = [
      {
        rowId: "i-app",
        name: "TextInput",
        tier: "Apps/Launchpad",
        type: "Component",
      },
    ];
    const plan = diffRoster(makeSpec([]), live);
    expect(plan.unmanaged).toEqual([]);
  });

  it("flags a current tier outside the scope fence (before side)", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Apps/Launchpad", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "X", tier: "Global/Form", type: "Component" },
        op: "move",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) => v.includes('current tier "Apps/Launchpad"')),
    ).toBe(true);
  });

  it("flags a merge op with no mergeInto", () => {
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Global/Form", type: "Component" },
    ];
    const spec = makeSpec([{ rowId: "i-1", target: null, op: "merge" }]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) => v.includes("merge op missing mergeInto")),
    ).toBe(true);
  });

  it("labels a violation by current name when target is null (merge)", () => {
    // target: null forces the label to fall through to entry.current?.name.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "OldName", tier: "Global/Form", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        current: { name: "OldName", tier: "Global/Form", type: "Component" },
        target: null,
        op: "merge",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(plan.violations.some((v) => v.startsWith("OldName:"))).toBe(true);
  });

  it("flags a non-create op carrying rowId null (would be silently skipped)", () => {
    // A rename with rowId null resolves to op.rowId === null: the executor would
    // no-op it, so the diff must surface a violation.
    const live: LiveEntry[] = [];
    const spec = makeSpec([
      {
        rowId: null,
        target: { name: "X", tier: "Global", type: "Component" },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(plan.violations.some((v) => v.includes("op has rowId null"))).toBe(
      true,
    );
  });

  it("flags a non-merge op carrying target null (would be silently skipped)", () => {
    // A rename with target null resolves to op.after === null: nothing to write.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([{ rowId: "i-1", target: null, op: "rename" }]);

    const plan = diffRoster(spec, live);
    expect(plan.violations.some((v) => v.includes("op has target null"))).toBe(
      true,
    );
  });

  it("flags a keep op whose target actually changes a field", () => {
    // keep must change nothing; here the name differs, so the declared op is wrong.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "OLD", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "NEW", tier: "Global", type: "Component" },
        op: "keep",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("declared keep but has name change(s)"),
      ),
    ).toBe(true);
  });

  it("flags a rename whose Δ changes type but not name", () => {
    // changedFields is non-empty (type) but lacks name, so the rename is mis-declared.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "X", tier: "Global", type: "Subcomponent" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "X", tier: "Global", type: "Component" },
        op: "rename",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("declared rename but the name does not change"),
      ),
    ).toBe(true);
  });

  it("flags a retype whose Δ changes name but not type", () => {
    // changedFields is non-empty (name) but lacks type, so the retype is mis-declared.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "OLD", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "NEW", tier: "Global", type: "Component" },
        op: "retype",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("declared retype but the type does not change"),
      ),
    ).toBe(true);
  });

  it("flags a move whose Δ changes name but not tier", () => {
    // changedFields is non-empty (name) but lacks tier, so the move is mis-declared.
    const live: LiveEntry[] = [
      { rowId: "i-1", name: "OLD", tier: "Global", type: "Component" },
    ];
    const spec = makeSpec([
      {
        rowId: "i-1",
        target: { name: "NEW", tier: "Global", type: "Component" },
        op: "move",
      },
    ]);

    const plan = diffRoster(spec, live);
    expect(
      plan.violations.some((v) =>
        v.includes("declared move but the tier does not change"),
      ),
    ).toBe(true);
  });

  it("labels a violation by rowId when both target and current are null (merge)", () => {
    // No target and no `current`: the label must fall through to entry.rowId.
    const live: LiveEntry[] = [];
    const spec = makeSpec([
      { rowId: "i-x", target: null, op: "merge", mergeInto: "i-absent" },
    ]);

    const plan = diffRoster(spec, live);
    expect(plan.violations.some((v) => v.startsWith("i-x:"))).toBe(true);
  });

  it("downgrades a create to keep when its target already exists live", () => {
    // create + a live row matching name/tier/type: reconcile converges to keep
    // (covers findMatchingRow's match path and the keep downgrade).
    const live: LiveEntry[] = [
      {
        rowId: "i-1",
        name: "NewField",
        tier: "Global/Form",
        type: "Component",
      },
    ];
    const spec = makeSpec([
      {
        rowId: null,
        target: { name: "NewField", tier: "Global/Form", type: "Component" },
        op: "create",
      },
    ]);

    const plan = diffRoster(spec, live);
    const op = plan.ops.at(0);
    expect(op?.kind).toBe("keep");
    expect(op?.rowId).toBe("i-1");
    expect(plan.violations).toEqual([]);
  });

  it("labels a violation '?' when rowId, target, and current are all nullish", () => {
    // Exhausts the label fallback chain (target?.name ?? current?.name ??
    // rowId ?? "?") to its terminal "?" arm.
    const spec = makeSpec([
      { rowId: null, target: null, op: "merge", mergeInto: "i-absent" },
    ]);

    const plan = diffRoster(spec, []);
    expect(plan.violations.some((v) => v.startsWith("?:"))).toBe(true);
  });
});
