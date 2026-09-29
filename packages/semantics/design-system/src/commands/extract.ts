import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Config } from "../config/types.js";
import { CodaProvider } from "../providers/index.js";

/**
 * Extract output structure
 */
export interface ExtractOutput {
  document: string;
  extractedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

/**
 * Ensure directory exists for a file path
 */
async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

/**
 * Extracts table data from the configured document
 */
export default async function extract(config: Config): Promise<void> {
  if (!config.extract) {
    throw new Error("Extract config section is required");
  }

  const provider = new CodaProvider();

  const tables: Record<string, Array<Record<string, unknown>>> = {};

  for (const [tableName, tableId] of Object.entries(config.extract.tables)) {
    const rows = await provider.fetchTable(config.document, tableId);
    tables[tableName] = rows;
  }

  const result: ExtractOutput = {
    document: config.document,
    extractedAt: new Date().toISOString(),
    tables,
  };

  await ensureDir(config.extract.output);
  await writeFile(config.extract.output, JSON.stringify(result, null, 2));
  console.log(
    `Extracted ${Object.keys(result.tables).length} tables to ${config.extract.output}`,
  );
}
