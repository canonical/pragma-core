/** Create a CSS declaration node. */
import type { CSSDeclaration } from "./types.js";

export default function createDeclaration(
  property: string,
  value: string,
  comment?: string,
): CSSDeclaration {
  return { type: "Declaration", property, value, comment };
}
