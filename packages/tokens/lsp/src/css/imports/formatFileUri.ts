/** Convert an absolute filesystem path to a file:// URI. */
import { pathToFileURL } from "node:url";

export default function formatFileUri(fsPath: string): string {
  return pathToFileURL(fsPath).href;
}
