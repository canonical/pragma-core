/** CSS type-system constants used by diagnostics and completion logic. */
import type { CssValueType } from "../../types/index.js";

export const SUBTYPE_RELATIONS: ReadonlyArray<
  readonly [CssValueType, CssValueType]
> = [
  ["<length>", "<length-percentage>"],
  ["<percentage>", "<length-percentage>"],
  ["<integer>", "<number>"],
  ["<number>", "<alpha-value>"],
  ["<percentage>", "<alpha-value>"],
  ["<gradient>", "<image>"],
  ["<url>", "<image>"],
] as const;

export const MATH_FUNCTIONS: ReadonlySet<string> = new Set([
  "calc",
  "min",
  "max",
  "clamp",
  "round",
  "mod",
  "rem",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "pow",
  "sqrt",
  "hypot",
  "log",
  "exp",
  "abs",
  "sign",
]);
