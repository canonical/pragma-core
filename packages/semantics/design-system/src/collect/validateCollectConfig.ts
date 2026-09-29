import type { CollectConfig } from "./types.js";

/**
 * Validate and parse a design-system.json configuration
 */
export default function validateCollectConfig(data: unknown): CollectConfig {
  if (!data || typeof data !== "object") {
    throw new Error("Config must be an object");
  }

  const config = data as Record<string, unknown>;

  // Required fields
  if (typeof config.name !== "string" || !config.name) {
    throw new Error("Config must have a 'name' string");
  }

  if (typeof config.platform !== "string" || !config.platform) {
    throw new Error("Config must have a 'platform' string");
  }

  if (typeof config.link !== "string" || !config.link) {
    throw new Error("Config must have a 'link' string");
  }

  if (!config.prefix || typeof config.prefix !== "object") {
    throw new Error("Config must have a 'prefix' object");
  }

  const prefix = config.prefix as Record<string, unknown>;
  if (typeof prefix.short !== "string" || !prefix.short) {
    throw new Error("Config prefix must have a 'short' string");
  }

  if (typeof prefix.namespace !== "string" || !prefix.namespace) {
    throw new Error("Config prefix must have a 'namespace' string");
  }

  if (typeof config.pattern !== "string" || !config.pattern) {
    throw new Error("Config must have a 'pattern' string");
  }

  // Optional fields validation
  if (
    config.description !== undefined &&
    typeof config.description !== "string"
  ) {
    throw new Error("Config 'description' must be a string if provided");
  }

  if (
    config.documentation !== undefined &&
    typeof config.documentation !== "string"
  ) {
    throw new Error("Config 'documentation' must be a string if provided");
  }

  if (config.tier !== undefined && typeof config.tier !== "string") {
    throw new Error("Config 'tier' must be a string if provided");
  }

  if (config.outputDir !== undefined && typeof config.outputDir !== "string") {
    throw new Error("Config 'outputDir' must be a string if provided");
  }

  return {
    name: config.name,
    platform: config.platform,
    description: config.description as string | undefined,
    link: config.link,
    documentation: config.documentation as string | undefined,
    tier: config.tier as string | undefined,
    prefix: {
      short: prefix.short,
      namespace: prefix.namespace,
    },
    pattern: config.pattern,
    outputDir: config.outputDir as string | undefined,
  };
}
