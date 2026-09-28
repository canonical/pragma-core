import type { PropertyNode } from "../types/graph.js";

/** Build a `PropertyNode` with sensible defaults. `cssVar` and `fileUri` are required. */
export default function makePropertyNode(
  overrides: Partial<PropertyNode> & { cssVar: string; fileUri: string },
): PropertyNode {
  return {
    line: 0,
    syntax: "<color>",
    inherits: true,
    initialValue: null,
    cssType: "<color>",
    ...overrides,
  };
}
