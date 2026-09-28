import { join } from "node:path";

const CONFIG_FILENAME = "terrazzo-lsp.config.json";

/** Build the config candidate path for a directory during config discovery. */
export default function createConfigCandidatePath(dir: string): string {
  return join(dir, CONFIG_FILENAME);
}
