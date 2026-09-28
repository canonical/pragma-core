import { describe, expect, it } from "vitest";
import { formatDelta } from "./formatDelta.js";

describe("formatDelta", () => {
  it("formats positive delta", () => {
    expect(formatDelta(0.05)).toBe("0.05");
  });

  it("formats negative delta", () => {
    expect(formatDelta(-0.03)).toBe("-0.03");
  });

  it("rounds to 6 decimal places", () => {
    expect(formatDelta(0.1234567890123)).toBe("0.123457");
  });

  it("formats zero", () => {
    expect(formatDelta(0)).toBe("0");
  });
});
