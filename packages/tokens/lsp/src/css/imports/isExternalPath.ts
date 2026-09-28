/** Check whether a file path is under node_modules. */
export default function isExternalPath(filePath: string): boolean {
  return filePath.includes("/node_modules/");
}
