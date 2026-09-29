import { describe, expect, it } from "vitest";
import classifySubjectUri from "./classifySubjectUri.js";

describe("classifySubjectUri", () => {
  const cases = [
    // A trailing blank row in a Coda grid: buildUri returns "".
    { uri: "", verdict: "empty" },
    // Present but degenerate: the shapes that made data/*.ttl unparseable.
    { uri: "ds:global..", verdict: "malformed" },
    { uri: "ds:global...", verdict: "malformed" },
    { uri: "ds:.subcomponent.accordion-item", verdict: "malformed" },
    { uri: "ds:", verdict: "malformed" },
    { uri: "https://ds.canonical.com/global..", verdict: "malformed" },
    // Emittable.
    { uri: "ds:global.component.button", verdict: "valid" },
    {
      uri: "https://ds.canonical.com/global.component.button",
      verdict: "valid",
    },
    // Non-ds values are not this guard's business.
    { uri: "https://example.com/thing", verdict: "valid" },
  ] as const;

  for (const { uri, verdict } of cases) {
    it(`classifies "${uri}" as ${verdict}`, () => {
      expect(classifySubjectUri(uri)).toBe(verdict);
    });
  }
});
