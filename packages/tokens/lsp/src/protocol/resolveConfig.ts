/**
 * Resolve raw user configuration into a fully-populated runtime config.
 *
 * Defaults are chosen to keep the server useful with zero setup: CSS files are
 * scanned from common source folders, diagnostics are enabled at conservative
 * severities, and hover metadata stays rich enough to explain provenance and
 * navigation context.
 *
 * @note impure — resolveFromNodeModules uses existsSync; loadConfigFile
 * reads config files from disk.
 */

import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import isBareSpecifier from "../css/imports/isBareSpecifier.js";
import createConfigCandidatePath from "../runtime/createConfigCandidatePath.js";
import type {
  ConfigFileResult,
  ConfigurableSeverity,
  DiagnosticCode,
  LogLevel,
  RawConfig,
  ResolvedConfig,
  ResolvedHoverConfig,
  ResolvedInlayHintsConfig,
} from "../types/index.js";
import { DiagnosticSeverity } from "../types/index.js";

const DEFAULT_SCAN_GLOBS = ["src/**/*.css", "src/**/*.scss"];

const DEFAULT_HOVER: ResolvedHoverConfig = {
  showColourSwatches: true,
  showSelectorContext: true,
  showProvenanceBadge: true,
  showAliasChain: true,
  showSourceLocation: true,
  showNavigationTier: true,
  showSpecReferences: true,
};

const DEFAULT_INLAY_HINTS: ResolvedInlayHintsConfig = {
  enabled: false,
  showColourSwatches: true,
};

const DEFAULT_SEVERITIES_BY_CODE: Record<
  DiagnosticCode,
  DiagnosticSeverity | null
> = {
  "css/unknown-var": null,
  "css/missing-fallback": DiagnosticSeverity.Warning,
  "css/stale-fallback": DiagnosticSeverity.Warning,
  "css/type-mismatch": DiagnosticSeverity.Error,
  "css/type-uncertain": DiagnosticSeverity.Information,
  "css/unreachable-token": DiagnosticSeverity.Warning,
  "css/primitive-token": DiagnosticSeverity.Warning,
  "css/scoped-usage": DiagnosticSeverity.Warning,
  "css/no-color-scheme": DiagnosticSeverity.Information,
  "dtcg/broken-alias": DiagnosticSeverity.Error,
  "dtcg/schema-violation": DiagnosticSeverity.Error,
  "dtcg/circular-alias": DiagnosticSeverity.Error,
  "dtcg/missing-type": DiagnosticSeverity.Information,
  "dtcg/draft-syntax": DiagnosticSeverity.Information,
};

const DEFAULT_SEVERITIES: ReadonlyMap<
  DiagnosticCode,
  DiagnosticSeverity | null
> = new Map(
  Object.entries(DEFAULT_SEVERITIES_BY_CODE) as Array<
    [DiagnosticCode, DiagnosticSeverity | null]
  >,
);

const CONFIG_KEY_TO_CODE: ReadonlyMap<string, DiagnosticCode> = new Map([
  ["unknownProperties", "css/unknown-var"],
  ["missingFallback", "css/missing-fallback"],
  ["staleFallback", "css/stale-fallback"],
  ["typeMismatch", "css/type-mismatch"],
  ["typeUncertain", "css/type-uncertain"],
  ["unreachableToken", "css/unreachable-token"],
  ["primitiveToken", "css/primitive-token"],
  ["scopedDeclaration", "css/scoped-usage"],
  ["lightDarkNoScheme", "css/no-color-scheme"],
  ["brokenAlias", "dtcg/broken-alias"],
  ["schemaViolation", "dtcg/schema-violation"],
  ["circularAlias", "dtcg/circular-alias"],
  ["inferredType", "dtcg/missing-type"],
  ["draftFormat", "dtcg/draft-syntax"],
]);

/** Resolve a raw config into a fully resolved config. */
export function resolveConfig(raw: RawConfig, rootDir: string): ResolvedConfig {
  return {
    artifactPaths: resolveArtifactPaths(raw, rootDir),
    distDir: raw.distDir ? join(rootDir, raw.distDir) : join(rootDir, "dist"),
    scanGlobs: raw.scanGlobs ?? DEFAULT_SCAN_GLOBS,
    globalStylesheets: resolveGlobalStylesheets(raw, rootDir),
    diagnostics: resolveDiagnostics(raw),
    diagnosticIgnoreGlobs: raw.diagnostics?.ignoreGlobs ?? [],
    hover: resolveHover(raw),
    inlayHints: resolveInlayHints(raw),
    logLevel: resolveLogLevel(raw.logLevel),
  };
}

function resolveArtifactPaths(raw: RawConfig, rootDir: string): string[] {
  if (!raw.artifacts) return [];
  const out: string[] = [];
  for (const artifact of raw.artifacts) {
    // Package specifiers resolve via the node_modules walk-up — a controlled
    // mechanism that may legitimately land in a parent's node_modules.
    if (isPackageSpecifier(artifact)) {
      out.push(resolveFromNodeModules(artifact, rootDir));
      continue;
    }
    // User-supplied relative/absolute paths must stay within the workspace
    // root so a checked-in config cannot make the server read arbitrary files.
    const resolved = join(rootDir, artifact);
    if (isWithinRoot(resolved, rootDir)) out.push(resolved);
  }
  return out;
}

/** Config-context bare specifier: a real package name, not a relative-ish path. */
function isPackageSpecifier(specifier: string): boolean {
  return (
    isBareSpecifier(specifier) &&
    !specifier.startsWith("node_modules/") &&
    !specifier.startsWith(".")
  );
}

/**
 * Whether `targetPath` resolves to a location inside `rootDir`. Stops a
 * checked-in `terrazzo-lsp.config.json` from pointing the server at files
 * outside the workspace (e.g. `../../../../etc/passwd` or an absolute
 * `/etc/shadow`). Package-specifier resolutions are exempt and checked
 * separately.
 */
function isWithinRoot(targetPath: string, rootDir: string): boolean {
  const root = resolve(rootDir);
  const target = resolve(targetPath);
  // Avoid a double separator when root is already a path root ("/" on POSIX,
  // "C:\\" on Windows): `root + sep` would be "//" and reject every in-root
  // path because `startsWith("//")` is never true.
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return target === root || target.startsWith(rootWithSep);
}

function resolveGlobalStylesheets(
  raw: RawConfig,
  rootDir: string,
): string[] | null {
  if (raw.globalStylesheets === undefined) return null;
  const out: string[] = [];
  for (const gs of raw.globalStylesheets) {
    // Bare specifier — resolve through the node_modules walk-up (trusted).
    if (isPackageSpecifier(gs)) {
      out.push(`file://${resolveFromNodeModules(gs, rootDir)}`);
      continue;
    }
    // file://, absolute, or relative — normalise to an absolute fs path and
    // require it to live within the workspace root before accepting it.
    const abs = gs.startsWith("file://")
      ? gs.slice("file://".length)
      : gs.startsWith("/")
        ? gs
        : join(rootDir, gs);
    if (isWithinRoot(abs, rootDir)) out.push(`file://${abs}`);
  }
  return out;
}

function resolveDiagnostics(
  raw: RawConfig,
): Map<DiagnosticCode, DiagnosticSeverity | null> {
  const result = new Map(DEFAULT_SEVERITIES);
  if (!raw.diagnostics) return result;
  for (const [configKey, code] of CONFIG_KEY_TO_CODE) {
    const value = raw.diagnostics[configKey as keyof typeof raw.diagnostics];
    if (typeof value === "string")
      result.set(code, parseSeverity(value as ConfigurableSeverity));
  }
  return result;
}

function parseSeverity(value: ConfigurableSeverity): DiagnosticSeverity | null {
  switch (value) {
    case "off":
      return null;
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
  }
}

function resolveHover(raw: RawConfig): ResolvedHoverConfig {
  if (!raw.hover) return { ...DEFAULT_HOVER };
  return {
    showColourSwatches:
      raw.hover.showColourSwatches ?? DEFAULT_HOVER.showColourSwatches,
    showSelectorContext:
      raw.hover.showSelectorContext ?? DEFAULT_HOVER.showSelectorContext,
    showProvenanceBadge:
      raw.hover.showProvenanceBadge ?? DEFAULT_HOVER.showProvenanceBadge,
    showAliasChain: raw.hover.showAliasChain ?? DEFAULT_HOVER.showAliasChain,
    showSourceLocation:
      raw.hover.showSourceLocation ?? DEFAULT_HOVER.showSourceLocation,
    showNavigationTier:
      raw.hover.showNavigationTier ?? DEFAULT_HOVER.showNavigationTier,
    showSpecReferences:
      raw.hover.showSpecReferences ?? DEFAULT_HOVER.showSpecReferences,
  };
}

function resolveInlayHints(raw: RawConfig): ResolvedInlayHintsConfig {
  if (!raw.inlayHints) return { ...DEFAULT_INLAY_HINTS };
  return {
    enabled: raw.inlayHints.enabled ?? DEFAULT_INLAY_HINTS.enabled,
    showColourSwatches:
      raw.inlayHints.showColourSwatches ??
      DEFAULT_INLAY_HINTS.showColourSwatches,
  };
}

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set([
  "off",
  "error",
  "warn",
  "info",
  "debug",
]);

function resolveLogLevel(value: string | undefined): LogLevel {
  if (value && VALID_LOG_LEVELS.has(value)) return value as LogLevel;
  return "info";
}

/**
 * Walk up from `startDir` toward the filesystem root, checking each
 * `node_modules/` directory for `specifier`.  Returns the first candidate
 * that exists on disk, falling back to `<startDir>/node_modules/<specifier>`
 * when nothing is found (so downstream code can report a clear "file not
 * found" on a sensible path).
 */
function resolveFromNodeModules(specifier: string, startDir: string): string {
  let dir = resolve(startDir);
  const fallback = join(dir, "node_modules", specifier);
  while (true) {
    const candidate = join(dir, "node_modules", specifier);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return fallback; // filesystem root — give up
    dir = parent;
  }
}

/**
 * Search for `terrazzo-lsp.config.json` starting from `startDir` and
 * walking up the directory tree.  Returns the parsed config and the
 * directory where it was found.
 *
 * If no config file is found anywhere, returns an empty config with
 * `configDir: null`.
 */
export async function loadConfigFile(
  startDir: string,
): Promise<ConfigFileResult> {
  let dir = startDir;
  const searchedPaths: string[] = [];
  while (true) {
    const candidatePath = createConfigCandidatePath(dir);
    searchedPaths.push(candidatePath);
    try {
      const raw = await fs.readFile(candidatePath, "utf-8");
      return {
        raw: JSON.parse(raw) as RawConfig,
        configDir: dir,
        searchedPaths,
      };
    } catch {
      // Not found here — try parent
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return { raw: {}, configDir: null, searchedPaths };
}
