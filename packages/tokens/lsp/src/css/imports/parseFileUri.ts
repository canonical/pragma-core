/** Convert a file:// URI to an absolute filesystem path. */
import { fileURLToPath } from "node:url";

export default function parseFileUri(uri: string): string {
  return fileURLToPath(uri);
}
