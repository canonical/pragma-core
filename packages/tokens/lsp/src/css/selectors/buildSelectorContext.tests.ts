import { describe, expect, it } from "vitest";
import type { AtRuleContext } from "../../types/index.js";
import buildSelectorContext from "./buildSelectorContext.js";

describe("buildSelectorContext", () => {
  it("builds a global context for :root", () => {
    const ctx = buildSelectorContext(":root", []);
    expect(ctx.selector).toBe(":root");
    expect(ctx.scopeType).toBe("global");
    expect(ctx.isGlobal).toBe(true);
    expect(ctx.isScoped).toBe(false);
    expect(ctx.atRules).toEqual([]);
  });

  it("builds a universal context for *", () => {
    const ctx = buildSelectorContext("*", []);
    expect(ctx.scopeType).toBe("universal");
    expect(ctx.isGlobal).toBe(true);
    expect(ctx.isScoped).toBe(false);
  });

  it("builds a class-scoped context", () => {
    const ctx = buildSelectorContext(".button", []);
    expect(ctx.scopeType).toBe("class");
    expect(ctx.isGlobal).toBe(false);
    expect(ctx.isScoped).toBe(true);
  });

  it("builds a media-scoped context", () => {
    const atRules: AtRuleContext[] = [
      { name: "media", prelude: "(min-width: 1024px)" },
    ];
    const ctx = buildSelectorContext(":root", atRules);
    expect(ctx.scopeType).toBe("media");
    expect(ctx.isGlobal).toBe(false);
    expect(ctx.isScoped).toBe(true);
    expect(ctx.atRules).toEqual(atRules);
  });
});
