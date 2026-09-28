/** Check whether a specifier is a bare specifier (package name, not a path). */
export default function isBareSpecifier(specifier: string): boolean {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return false;
  if (specifier.startsWith("/")) return false;
  if (/^https?:\/\//.test(specifier)) return false;
  if (specifier.startsWith("data:")) return false;
  return true;
}
