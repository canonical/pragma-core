import { describe, expect, it } from "vitest";
import validateCollectConfig from "./validateCollectConfig.js";

describe("validateCollectConfig", () => {
  const validConfig = {
    name: "Pragma React",
    platform: "react",
    link: "https://github.com/canonical/pragma",
    prefix: {
      short: "ds",
      namespace: "https://ds.canonical.com/data/",
    },
    pattern: "src/**/*.tsx",
  };

  it("should validate a minimal valid config", () => {
    const result = validateCollectConfig(validConfig);
    expect(result.name).toBe("Pragma React");
    expect(result.platform).toBe("react");
    expect(result.link).toBe("https://github.com/canonical/pragma");
    expect(result.prefix.short).toBe("ds");
    expect(result.prefix.namespace).toBe("https://ds.canonical.com/data/");
    expect(result.pattern).toBe("src/**/*.tsx");
  });

  it("should validate a config with all optional fields", () => {
    const fullConfig = {
      ...validConfig,
      description: "React implementation",
      documentation: "https://docs.example.com",
      tier: "ds:global",
      outputDir: "output",
    };
    const result = validateCollectConfig(fullConfig);
    expect(result.description).toBe("React implementation");
    expect(result.documentation).toBe("https://docs.example.com");
    expect(result.tier).toBe("ds:global");
    expect(result.outputDir).toBe("output");
  });

  it("should throw if config is not an object", () => {
    expect(() => validateCollectConfig(null)).toThrow(
      "Config must be an object",
    );
    expect(() => validateCollectConfig("string")).toThrow(
      "Config must be an object",
    );
    expect(() => validateCollectConfig(123)).toThrow(
      "Config must be an object",
    );
  });

  it("should throw if name is missing", () => {
    const config = { ...validConfig, name: undefined };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'name' string",
    );
  });

  it("should throw if name is empty", () => {
    const config = { ...validConfig, name: "" };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'name' string",
    );
  });

  it("should throw if platform is missing", () => {
    const config = { ...validConfig, platform: undefined };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'platform' string",
    );
  });

  it("should throw if link is missing", () => {
    const config = { ...validConfig, link: undefined };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'link' string",
    );
  });

  it("should throw if prefix is missing", () => {
    const config = { ...validConfig, prefix: undefined };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'prefix' object",
    );
  });

  it("should throw if prefix.short is missing", () => {
    const config = {
      ...validConfig,
      prefix: { namespace: "https://example.com/" },
    };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config prefix must have a 'short' string",
    );
  });

  it("should throw if prefix.namespace is missing", () => {
    const config = { ...validConfig, prefix: { short: "ds" } };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config prefix must have a 'namespace' string",
    );
  });

  it("should throw if pattern is missing", () => {
    const config = { ...validConfig, pattern: undefined };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config must have a 'pattern' string",
    );
  });

  it("should throw if description is not a string", () => {
    const config = { ...validConfig, description: 123 };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config 'description' must be a string if provided",
    );
  });

  it("should throw if documentation is not a string", () => {
    const config = { ...validConfig, documentation: 123 };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config 'documentation' must be a string if provided",
    );
  });

  it("should throw if tier is not a string", () => {
    const config = { ...validConfig, tier: 123 };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config 'tier' must be a string if provided",
    );
  });

  it("should throw if outputDir is not a string", () => {
    const config = { ...validConfig, outputDir: 123 };
    expect(() => validateCollectConfig(config)).toThrow(
      "Config 'outputDir' must be a string if provided",
    );
  });
});
