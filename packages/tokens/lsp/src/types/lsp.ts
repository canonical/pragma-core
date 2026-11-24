/**
 * LSP feature types — artifact format, inline suppression, worker protocol
 * shapes, and plugin API.
 *
 * Provider-scoped types (semantic tokens, symbol kinds, navigation tiers,
 * check report, tooltip options) live in `providers/types.ts`.
 *
 */

import type { DiagnosticCode } from "../diagnosticCodes.js";
import type { SymbolKind } from "../providers/types.js";
import type { ResolvedConfig } from "./config.js";
import type { CssContext } from "./css.js";
import type { TokenGraphData, TokenNode } from "./graph.js";
import type {
  CodeAction,
  CompletionItem,
  Diagnostic,
  Location,
  MarkupContent,
  WorkspaceEdit,
} from "./protocol.js";

// ---------------------------------------------------------------------------
// Workspace symbol  (§9.9)
// ---------------------------------------------------------------------------

/**
 * Workspace symbol result.
 */
export interface WorkspaceSymbol {
  /** Display name (CSS var or token ID). */
  name: string;
  /** Symbol kind. */
  kind: SymbolKind;
  /** Location of the symbol definition. */
  location: Location;
  /** Container name (package, file, or scope). */
  containerName?: string;
}

// ---------------------------------------------------------------------------
// Rename  (§9.6)
// ---------------------------------------------------------------------------

/**
 * Result of a rename operation.
 */
export interface RenameResult {
  /** The workspace edit to apply. */
  edit: WorkspaceEdit;
  /** Whether a rebuild is required after rename. */
  requiresRebuild: boolean;
}

// ---------------------------------------------------------------------------
// Inline suppression  (§9.3)
// ---------------------------------------------------------------------------

/**
 * Inline suppression directive parsed from CSS comments.
 */
export type SuppressionDirective =
  | { kind: "disable"; rules: DiagnosticCode[] | "all"; line: number }
  | { kind: "enable"; rules: DiagnosticCode[] | "all"; line: number }
  | {
      kind: "disable-next-line";
      rules: DiagnosticCode[] | "all";
      line: number;
    }
  | {
      kind: "disable-line";
      rules: DiagnosticCode[] | "all";
      line: number;
    };

// ---------------------------------------------------------------------------
// Artifact format  (§16.3)
// ---------------------------------------------------------------------------

import type {
  ArtifactDeclaration,
  ArtifactTier,
  ArtifactToken,
  KnownTokenTier,
} from "@canonical/token-types";

/**
 * A raw artifact token as read from disk — the input contract to
 * `parseArtifactToken`. The parser fills or derives a small set of fields, and
 * an artifact document may omit or carry them: `cssVar` is the record KEY (the
 * parser injects it from the key rather than reading the token); `isPaired` is
 * derived (defaults false); `cssOutputFile` resolves through a path helper that
 * tolerates absence; `tier` is defaulted to null. Every other field keeps its
 * `@canonical/token-types` shape, so the input document still says exactly what
 * it carries.
 */
export type RawArtifactToken = Omit<
  ArtifactToken,
  "cssVar" | "isPaired" | "cssOutputFile" | "tier"
> &
  Partial<
    Pick<ArtifactToken, "cssVar" | "isPaired" | "cssOutputFile" | "tier">
  >;

/** A flat raw artifact: CSS var name → raw token. */
export type RawArtifact = Record<string, RawArtifactToken> | RawWrappedArtifact;

/** A raw artifact in the wrapped envelope form (version, generator, tokens). */
export type RawWrappedArtifact = {
  version: string;
  generator: string;
  tokens: Record<string, RawArtifactToken>;
};

/** @see ArtifactDeclaration from @canonical/token-types */
export type RawArtifactDeclaration = ArtifactDeclaration;
/** @see ArtifactTier from @canonical/token-types */
export type SharedArtifactTier = ArtifactTier;
/** @see KnownTokenTier from @canonical/token-types */
export type SharedKnownTokenTier = KnownTokenTier;

// ---------------------------------------------------------------------------
// Plugin contribution API  (§9.10)
// ---------------------------------------------------------------------------

/**
 * Plugin contribution API for project-maintained extensions.
 *
 * @experimental The plugin API is defined for future use.
 * Plugin development is deferred to a later phase.
 */
export interface TerrazzoLspPlugin {
  name: string;
  apiVersion: "1.0.0";

  /** Augment the graph after full construction (runs in the worker). */
  augmentGraph?(
    graph: TokenGraphData,
    config: ResolvedConfig,
  ): void | Promise<void>;

  /** Contribute completions. */
  provideCompletions?(
    context: CssContext,
    graph: TokenGraphData,
  ): CompletionItem[];

  /** Augment hover — may add sections, must not remove core sections. */
  augmentHover?(content: MarkupContent, token: TokenNode): MarkupContent;

  /** Contribute diagnostics. */
  provideDiagnostics?(
    uri: string,
    text: string,
    graph: TokenGraphData,
  ): Diagnostic[];

  /** Contribute code actions for diagnostics produced by this plugin. */
  provideCodeActions?(diagnostic: Diagnostic, uri: string): CodeAction[];
}
