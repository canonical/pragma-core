import { TreeFragment } from "@lezer/common";
import type { ChangedRange, Tree } from "./types.js";

export default function applyTreeChanges(
  tree: Tree,
  changes: readonly ChangedRange[],
): readonly TreeFragment[] {
  return TreeFragment.applyChanges(TreeFragment.addTree(tree), changes);
}
