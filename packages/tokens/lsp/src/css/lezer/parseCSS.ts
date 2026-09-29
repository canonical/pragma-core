import type { TreeFragment } from "@lezer/common";
import { parser } from "@lezer/css";
import type { Tree } from "./types.js";

export default function parseCSS(
  source: string,
  fragments?: readonly TreeFragment[],
): Tree {
  return parser.parse(source, fragments);
}
