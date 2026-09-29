import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import validateConfig from "./validateConfig.js";

describe("allowUnboundSymbols", () => {
  it("accepts the field, so the migration window has a switch", () => {
    const config = validateConfig({
      document: "doc-123",
      provider: "coda",
      allowUnboundSymbols: true,
    });
    expect(config.allowUnboundSymbols).toBe(true);
  });

  it("rejects a non-boolean, so a typo is not read as truthy", () => {
    expect(() =>
      validateConfig({
        document: "doc-123",
        provider: "coda",
        allowUnboundSymbols: "yes",
      }),
    ).toThrow("Invalid config");
  });

  it("leaves it undefined when absent, because ajv is built without useDefaults", () => {
    const config = validateConfig({ document: "doc-123", provider: "coda" });
    expect(config.allowUnboundSymbols).toBeUndefined();
    expect(config.allowUnboundSymbols === true).toBe(false);
  });

  it("is not set in the shipped source.json — the switch is never committed", () => {
    // ADR J §8.2: the flag exists for one window inside the Coda write, is a local
    // edit, and is red in CI by construction. This is that construction.
    const shipped = validateConfig(
      JSON.parse(readFileSync("source.json", "utf-8")),
    );
    expect(shipped.allowUnboundSymbols).toBeUndefined();
  });
});

describe("validateConfig", () => {
  it("should return valid config when data is valid", () => {
    const validConfig = {
      document: "doc-123",
      provider: "coda",
    };

    const result = validateConfig(validConfig);

    expect(result).toEqual(validConfig);
  });

  it("should throw for missing required fields", () => {
    const invalidConfig = {};

    expect(() => validateConfig(invalidConfig)).toThrow("Invalid config");
  });

  it("should throw for unsupported provider", () => {
    const invalidConfig = {
      document: "doc-123",
      provider: "notion",
    };

    expect(() => validateConfig(invalidConfig)).toThrow("Invalid config");
  });

  it("should throw for missing document", () => {
    const invalidConfig = {
      provider: "coda",
    };

    expect(() => validateConfig(invalidConfig)).toThrow("Invalid config");
  });

  it("should throw for missing provider", () => {
    const invalidConfig = {
      document: "doc-123",
    };

    expect(() => validateConfig(invalidConfig)).toThrow("Invalid config");
  });
});
