import type { DeclarationNode } from "../types/graph.js";

/** Build a `DeclarationNode` with sensible defaults. `cssVar` and `fileUri` are required. */
export default function makeDeclarationNode(
  overrides: Partial<DeclarationNode> & { cssVar: string; fileUri: string },
): DeclarationNode {
  return {
    line: 0,
    column: 0,
    rawValue: "red",
    cssType: "<color>",
    selector: {
      selector: ":root",
      atRules: [],
      scopeType: "global",
      isGlobal: true,
      isScoped: false,
    },
    ...overrides,
  };
}
