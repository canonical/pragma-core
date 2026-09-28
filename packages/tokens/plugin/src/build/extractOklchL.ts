import type { OklchColorValue } from "./types.js";

export function extractOklchL(value: unknown): number | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "colorSpace" in value &&
    (value as { colorSpace: string }).colorSpace === "oklch" &&
    "components" in value &&
    Array.isArray((value as { components: unknown[] }).components)
  ) {
    const l = (value as OklchColorValue).components[0];
    return typeof l === "number" ? l : null;
  }
  return null;
}
