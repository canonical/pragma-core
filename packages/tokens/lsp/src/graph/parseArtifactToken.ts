/**
 * Convert one raw artifact token entry into the normalized `TokenNode` shape
 * used by the LSP graph.
 *
 * This is where artifact-only hints become CSS-aware runtime data: DTCG types
 * are narrowed to CSS value types, colour values are normalized into hex and
 * oklch side data, and relative paths are resolved against the artifact file.
 */

import * as path from "node:path";
import type { PlainColorObject } from "colorjs.io/fn";
import { parse, serialize, to } from "colorjs.io/fn";
import ensureColorSetup from "../css/colorSetup.js";
import * as values from "../css/values/index.js";
import type {
  CssValueType,
  DtcgType,
  OklchComponents,
  RawArtifactToken,
  TokenNode,
} from "../types/index.js";

/**
 * Parse a single artifact token entry into a TokenNode.
 *
 * @param artifactDir - Directory containing the artifact file.
 *   Used to resolve relative `cssOutputFile` paths to absolute paths.
 */
export default function parseArtifactToken(
  cssVar: string,
  raw: RawArtifactToken,
  packageSource = "",
  artifactDir = "",
): TokenNode {
  const dtcgType = (raw.type as DtcgType) ?? null;
  const aliasChain = raw.aliasChain ?? [];
  const tier = raw.tier ?? null;
  const valueLight = raw.valueLight ?? raw.value ?? null;
  const valueDark = raw.valueDark ?? raw.value ?? null;

  let cssType: CssValueType;
  if (raw.registered && raw.syntax) {
    cssType = values.parseSyntaxType(raw.syntax);
  } else if (dtcgType === "dimension") {
    const narrowFrom = raw.value ?? valueLight;
    cssType = narrowFrom
      ? values.resolveDimensionValue(narrowFrom)
      : values.mapDtcgType(dtcgType);
  } else {
    cssType = values.mapDtcgType(dtcgType);
  }

  const oklchLight = resolveOklch(valueLight);
  const oklchDark = resolveOklch(valueDark);
  const hexLight = resolveHex(valueLight);
  const hexDark = resolveHex(valueDark);

  // Resolve relative file paths to absolute using the artifact directory
  const sourceFile = resolvePath(raw.sourceFile, artifactDir);
  const cssOutputFile = resolvePath(raw.cssOutputFile, artifactDir);

  return {
    cssVar,
    provenance: { kind: "artifact", packageSource },
    id: raw.id ?? "",
    type: dtcgType,
    description: raw.description ?? "",
    aliasChain,
    isPrimary: aliasChain.length === 0,
    tier,
    visibility: raw.visibility ?? "public",
    derivedFrom: raw.derivedFrom ?? null,
    derivation: raw.derivation ?? null,
    extensions: raw.extensions ?? {},
    packageSource,
    cssType,
    valueLight,
    valueDark,
    isPaired: raw.isPaired ?? false,
    oklchLight,
    oklchDark,
    hexLight,
    hexDark,
    registered: raw.registered ?? false,
    syntax: raw.syntax ?? null,
    inherits: raw.inherits ?? null,
    initialValue: raw.initialValue ?? null,
    sourceFile,
    sourceLine: raw.sourceLine ?? null,
    cssOutputFile,
    cssOutputLine: raw.cssOutputLine ?? null,
  };
}

ensureColorSetup();

function resolveOklch(value: string | null): OklchComponents | null {
  if (!value) return null;
  try {
    const parsed = parse(value);
    const ok = to(parsed, "oklch") as PlainColorObject;
    const [l, c, h] = ok.coords;
    return { l: l ?? 0, c: c ?? 0, h: h ?? 0 };
  } catch {
    return null;
  }
}

function resolveHex(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = parse(value);
    return serialize(to(parsed, "srgb"), { format: "hex", collapse: false });
  } catch {
    return null;
  }
}

/** Resolve a file path from the artifact, making relative paths absolute. */
function resolvePath(
  filePath: string | undefined | null,
  artifactDir: string,
): string | null {
  if (!filePath) return null;
  // Already absolute
  if (path.isAbsolute(filePath)) return filePath;
  // Relative — resolve against the artifact directory
  if (artifactDir) return path.resolve(artifactDir, filePath);
  return filePath;
}
