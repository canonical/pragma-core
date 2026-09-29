import { describe, expect, it } from "vitest";
import {
  dottedName,
  loadPlatformVariables,
  loadSymbolIndex,
  STATE_DERIVATIONS,
  STRATA,
} from "./symbols.js";

describe("dottedName", () => {
  it("takes the local name of a dt: IRI", () => {
    expect(dottedName("https://dt.canonical.com/color.text")).toBe(
      "color.text",
    );
  });

  it("refuses anything outside the dt namespace", () => {
    expect(dottedName("https://ds.canonical.com/global.component.button")).toBe(
      null,
    );
  });
});

describe("STRATA", () => {
  it("names S1, S2 and S4 and not S3, which no law here reads", () => {
    expect(Object.keys(STRATA)).toEqual(["s1", "s2", "s4"]);
    expect(Object.values(STRATA).join(" ")).not.toContain("s3");
  });
});

describe("loadSymbolIndex", () => {
  const index = loadSymbolIndex();

  it("resolves S1's authored symbols and S2's minted channels together", () => {
    // 720 authored plus the 25 channels coverage mints (ADR J §1.4, §3.2).
    expect(index.names.size).toBe(745);
    expect(index.names.has("color.text")).toBe(true);
    expect(index.names.has("modifier.color.text")).toBe(true);
  });

  it("leaves a channel with no covering family unresolved, which is the register's business", () => {
    expect(index.names.has("modifier.surface")).toBe(false);
    expect(index.names.has("hover.color.foreground.secondary")).toBe(false);
  });

  it("names the base symbol of every channel, in one hop", () => {
    expect(index.channelOf.size).toBe(25);
    expect(index.channelOf.get("modifier.color.text")).toBe("color.text");
  });

  it("memoizes, so the 1 MB parse happens once per process", () => {
    expect(loadSymbolIndex()).toBe(index);
  });
});

describe("loadPlatformVariables", () => {
  const variables = loadPlatformVariables();

  it("reads every web variable the catalogue declares", () => {
    expect(variables.size).toBe(1156);
  });

  it("carries dt:ofSymbol, which is the first case of the name lift", () => {
    expect(variables.get("--color-text")).toMatchObject({
      symbol: "color.text",
    });
  });

  it("restores a camelCase symbol from both spellings S4 emits for it", () => {
    expect(variables.get("--color-focus-ring")?.symbol).toBe("color.focusRing");
    expect(variables.get("--color-focusRing")?.symbol).toBe("color.focusRing");
  });

  it("marks a computed state variable and what it is computed from", () => {
    expect(variables.get("--hover--color-foreground-secondary")).toEqual({
      variable: "--hover--color-foreground-secondary",
      derivation: "hover",
      computedFrom: "--color-foreground-secondary",
    });
  });

  it("does not read a channel variable as a computed state variable", () => {
    // `dt:derives dt:derivation.channel-modifier` is on every channel, so a loader
    // that took the last `dt:derives` it saw would mis-classify all 25.
    expect(variables.get("--modifier-color-text")).toEqual({
      variable: "--modifier-color-text",
      symbol: "modifier.color.text",
    });
  });

  it("finds exactly the 30 computed state variables the catalogue holds", () => {
    const computed = [...variables.values()].filter(
      (variable) => variable.derivation !== undefined,
    );
    expect(computed).toHaveLength(30);
    for (const variable of computed) {
      expect(STATE_DERIVATIONS).toContain(variable.derivation);
      expect(variable.symbol).toBeUndefined();
    }
  });

  it("memoizes", () => {
    expect(loadPlatformVariables()).toBe(variables);
  });
});
