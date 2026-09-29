import { describe, expect, it } from "vitest";
import {
  productContexts,
  productInput,
  resolveProductAxis,
} from "./productAxis.js";
import type { ResolverLike } from "./shims.js";

const resolver = (modifiers: Record<string, unknown>): ResolverLike => ({
  apply: () => ({}),
  source: { modifiers: modifiers as never },
});

describe("product axis", () => {
  it("uses the shared product axis", () => {
    const current = resolver({ product: { contexts: {} } });
    expect(resolveProductAxis(current)).toBe("product");
    expect(productInput(current, "os")).toEqual({ product: "os" });
  });

  it("supports the former typography axis only when product is absent", () => {
    const legacy = resolver({
      typography: { contexts: { app: [], docs: [], site: [] } },
    });
    expect(resolveProductAxis(legacy)).toBe("typography");
    expect(productInput(legacy, "app")).toEqual({ typography: "app" });
    expect(productContexts(legacy)).toEqual(["app", "docs", "site"]);
  });
});
