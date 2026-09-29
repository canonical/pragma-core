import type { ErrorObject } from "ajv";
import Ajv from "ajv";
import schema from "./source.schema.json" with { type: "json" };
import type { Config } from "./types.js";

const ajv = new Ajv.default({ allErrors: true });
const validateSchema = ajv.compile<Config>(schema);

/**
 * Validate config data against the JSON Schema
 * @throws Error if validation fails
 */
export default function validateConfig(data: unknown): Config {
  if (!validateSchema(data)) {
    const errors = validateSchema.errors
      ?.map((e: ErrorObject) => `${e.instancePath} ${e.message}`)
      .join(", ");
    throw new Error(`Invalid config: ${errors}`);
  }
  return data as Config;
}
