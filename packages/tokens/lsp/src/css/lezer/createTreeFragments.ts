import { TreeFragment } from "@lezer/common";
import type { Tree } from "./types.js";

export default function createTreeFragments(
  tree: Tree,
): readonly TreeFragment[] {
  return TreeFragment.addTree(tree);
}
