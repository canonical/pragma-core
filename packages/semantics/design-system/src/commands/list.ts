import type { Config } from "../config/types.js";
import { CodaProvider } from "../providers/index.js";

/**
 * List tables output structure
 */
export interface ListOutput {
  document: string;
  tables: Array<{ id: string; name: string }>;
}

/**
 * Lists all tables in the configured document
 */
export default async function list(config: Config): Promise<void> {
  const provider = new CodaProvider();

  const tables = await provider.listTables(config.document);

  const result: ListOutput = {
    document: config.document,
    tables,
  };

  console.log(JSON.stringify(result, null, 2));
}
