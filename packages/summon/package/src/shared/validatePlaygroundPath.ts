/**
 * The directory a playground is created in: relative, free of `..`, and made
 * of segments that start with a letter and use only letters, digits and
 * hyphens. The last segment, lowercased, becomes the package name, so it must
 * also be a valid npm name. The generator writes a whole tree under it, so it
 * must stay inside the working directory.
 */
const SEGMENT = /^[A-Za-z][A-Za-z0-9-]*$/;

const EXAMPLE = "my-playground or prototypes/navigation";

export default function validatePlaygroundPath(value: unknown): true | string {
  if (typeof value !== "string" || value.trim() === "") {
    return `Playground directory is required (for example ${EXAMPLE})`;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return "Playground directory must be a relative path, not absolute";
  }
  const segments = trimmed.replace(/\\/g, "/").replace(/\/+$/, "").split("/");
  if (segments.some((segment) => segment === "..")) {
    return 'Playground directory must not contain ".."';
  }
  for (const segment of segments) {
    if (!SEGMENT.test(segment)) {
      return (
        `Playground directory segment "${segment}" must start with a letter ` +
        `and use only letters, digits, and hyphens (for example ${EXAMPLE})`
      );
    }
  }
  return true;
}
