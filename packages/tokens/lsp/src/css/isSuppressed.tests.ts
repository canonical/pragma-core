import { describe, expect, it } from "vitest";
import isSuppressed from "./values/isSuppressed.js";

describe("isSuppressed", () => {
  it("returns false when no directives", () => {
    expect(isSuppressed("css/type-mismatch", 5, [])).toBe(false);
  });

  it("suppresses all rules with disable-all", () => {
    const directives = [
      { kind: "disable" as const, rules: "all" as const, line: 0 },
    ];
    expect(isSuppressed("css/type-mismatch", 5, directives)).toBe(true);
    expect(isSuppressed("css/missing-fallback", 10, directives)).toBe(true);
  });

  it("suppresses specific rules only", () => {
    const directives = [
      {
        kind: "disable" as const,
        rules: ["css/type-mismatch" as const],
        line: 0,
      },
    ];
    expect(isSuppressed("css/type-mismatch", 5, directives)).toBe(true);
    expect(isSuppressed("css/missing-fallback", 5, directives)).toBe(false);
  });

  it("re-enables rules with enable", () => {
    const directives = [
      { kind: "disable" as const, rules: "all" as const, line: 0 },
      { kind: "enable" as const, rules: "all" as const, line: 5 },
    ];
    expect(isSuppressed("css/type-mismatch", 3, directives)).toBe(true);
    expect(isSuppressed("css/type-mismatch", 7, directives)).toBe(false);
  });

  it("suppresses only the next line with disable-next-line", () => {
    const directives = [
      { kind: "disable-next-line" as const, rules: "all" as const, line: 3 },
    ];
    expect(isSuppressed("css/type-mismatch", 4, directives)).toBe(true);
    expect(isSuppressed("css/type-mismatch", 3, directives)).toBe(false);
    expect(isSuppressed("css/type-mismatch", 5, directives)).toBe(false);
  });

  it("suppresses only the same line with disable-line", () => {
    const directives = [
      { kind: "disable-line" as const, rules: "all" as const, line: 7 },
    ];
    expect(isSuppressed("css/type-mismatch", 7, directives)).toBe(true);
    expect(isSuppressed("css/type-mismatch", 6, directives)).toBe(false);
    expect(isSuppressed("css/type-mismatch", 8, directives)).toBe(false);
  });

  it("handles targeted disable-next-line", () => {
    const directives = [
      {
        kind: "disable-next-line" as const,
        rules: ["css/stale-fallback" as const],
        line: 2,
      },
    ];
    expect(isSuppressed("css/stale-fallback", 3, directives)).toBe(true);
    expect(isSuppressed("css/type-mismatch", 3, directives)).toBe(false);
  });

  it("handles nested disable/enable for specific rules", () => {
    const directives = [
      {
        kind: "disable" as const,
        rules: ["css/type-mismatch" as const],
        line: 0,
      },
      {
        kind: "disable" as const,
        rules: ["css/missing-fallback" as const],
        line: 2,
      },
      {
        kind: "enable" as const,
        rules: ["css/type-mismatch" as const],
        line: 5,
      },
    ];
    // type-mismatch suppressed 0-5, re-enabled after 5
    expect(isSuppressed("css/type-mismatch", 3, directives)).toBe(true);
    expect(isSuppressed("css/type-mismatch", 7, directives)).toBe(false);
    // missing-fallback suppressed from line 2 onward
    expect(isSuppressed("css/missing-fallback", 7, directives)).toBe(true);
  });
});
