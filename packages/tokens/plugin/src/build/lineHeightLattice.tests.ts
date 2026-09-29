import { describe, expect, it } from "vitest";
import type { LineHeightException } from "../plugin/types.js";
import { validateLineHeightLattice } from "./lineHeightLattice.js";
import type { ResolverLike, TokenLike } from "./shims.js";

const SECONDARY_MEMBERS = [
  "typography.text.secondary",
  "typography.text.secondary.bold",
  "typography.text.secondary.code",
  "typography.text.secondary.prose",
  "typography.text.secondary.prose.bold",
];

const exception: LineHeightException = {
  product: "site",
  rootRole: "typography.text.secondary",
  members: SECONDARY_MEMBERS,
  baselineCount: { numerator: 5, denominator: 2 },
  reason: "Preserve reviewed 14px/20px secondary text.",
  visualEvidence: {
    singleLine: "A single line exits on the half phase.",
    multiline: "Successive lines alternate phases.",
  },
};

function typography(lineHeight: number): TokenLike {
  return {
    $type: "typography",
    $extensions: {
      "com.canonical.typography": {
        $value: {
          lineHeightDimension: { value: lineHeight, unit: "rem" },
        },
      },
    },
    source: {
      filename: "/global/semantic/modifier/typography/global.tokens.json",
    },
  };
}

function resolver(siteLineHeight: number): ResolverLike {
  return {
    apply(input) {
      const product = input.product ?? "site";
      const baseline = product === "site" ? 0.5 : 0.25;
      const lineHeight = product === "site" ? siteLineHeight : 1.25;
      return {
        "spacing.baseline": {
          $type: "dimension",
          $value: { value: baseline, unit: "rem" },
        },
        ...Object.fromEntries(
          SECONDARY_MEMBERS.map((id) => [id, typography(lineHeight)]),
        ),
      };
    },
    source: {
      modifiers: {
        product: {
          contexts: { global: [], app: [], docs: [], site: [], os: [] },
        },
      },
    },
  };
}

describe("validateLineHeightLattice", () => {
  it("accepts whole counts and the five-member Site secondary half-step family", () => {
    expect(() =>
      validateLineHeightLattice(resolver(1.25), undefined, [exception]),
    ).not.toThrow();
  });

  it("rejects an unmanifested half step", () => {
    expect(() => validateLineHeightLattice(resolver(1.25), undefined)).toThrow(
      /Unauthorised half-step line height root:typography\.text\.secondary/,
    );
  });

  it("rejects an arbitrary five-percent change without snapping", () => {
    expect(() =>
      validateLineHeightLattice(resolver(1.3125), undefined, [exception]),
    ).toThrow(/neither whole nor an authorised half/);
  });

  it("uses exact comparison rather than an epsilon", () => {
    expect(() =>
      validateLineHeightLattice(resolver(1.2500001), undefined, [exception]),
    ).toThrow(/neither whole nor an authorised half/);
  });

  it("rejects stale exception members that resolve to a whole count", () => {
    expect(() =>
      validateLineHeightLattice(resolver(1.5), undefined, [exception]),
    ).toThrow(/Stale line-height exception/);
  });

  it("rejects incomplete phase evidence", () => {
    expect(() =>
      validateLineHeightLattice(resolver(1.25), undefined, [
        {
          ...exception,
          visualEvidence: { singleLine: "", multiline: "" },
        },
      ]),
    ).toThrow(/requires product, rootRole, reason, and single\/multiline/);
  });

  it("keeps the missing-baseline compatibility path for third-party sets", () => {
    expect(() =>
      validateLineHeightLattice({ apply: () => ({}) }, undefined),
    ).not.toThrow();
  });

  it("requires the canonical baseline when the package contract opts in", () => {
    expect(() =>
      validateLineHeightLattice({ apply: () => ({}) }, undefined, [], true),
    ).toThrow(/Missing required spacing\.baseline/);
  });

  it("requires every built-in product context when the package contract opts in", () => {
    const missingOs = resolver(1.25);
    missingOs.source = {
      modifiers: {
        product: {
          contexts: { global: [], app: [], docs: [], site: [] },
        },
      },
    };

    expect(() =>
      validateLineHeightLattice(missingOs, undefined, [exception], true),
    ).toThrow(/Missing required product contexts for spacing\.baseline: os/);
  });

  it("does not let the generic context fallback satisfy the canonical contract", () => {
    const undeclared = resolver(1.25);
    undeclared.source = undefined;

    expect(() =>
      validateLineHeightLattice(undeclared, undefined, [exception], true),
    ).toThrow(
      /Missing required product contexts for spacing\.baseline: app, docs, site, os/,
    );
  });

  it("validates the emitted root permutation independently of explicit Site", () => {
    const rootInvalid = resolver(1.25);
    const apply = rootInvalid.apply.bind(rootInvalid);
    rootInvalid.apply = (input) => {
      if (input.product) return apply(input);
      return {
        ...apply(input),
        "typography.heading.rootProbe": typography(1.3125),
      };
    };

    expect(() =>
      validateLineHeightLattice(rootInvalid, undefined, [exception], true),
    ).toThrow(
      /Invalid line-height lattice point root:typography\.heading\.rootProbe/,
    );
  });
});
