/**
 * Provider-domain types — types used exclusively by the providers layer.
 *
 * Cross-domain types (TokenNode, DeclarationNode, Diagnostic, etc.) remain
 * in `types/` for shared access. This file holds types that only the
 * providers layer (and its tests) consume.
 *
 */

import type { DiagnosticCode } from "../diagnosticCodes.js";

// ---------------------------------------------------------------------------
// Tooltip options  (§9.1, §9.2)
// ---------------------------------------------------------------------------

/** Controls which sections are included in the tooltip. */
export interface TooltipOptions {
  /** Show the provenance badge line (includes resolved value). */
  showProvenanceBadge: boolean;
  /** Show the description text. */
  showDescription: boolean;
  /** Show resolution table, source location, and registration detail. */
  showMetadataFooter: boolean;
  /** Show declaration sites with selector context. */
  showSelectorContext: boolean;
}

// ---------------------------------------------------------------------------
// Semantic tokens  (§9.7)
// ---------------------------------------------------------------------------

/**
 * Semantic token type registered with the server.
 */
export const SEMANTIC_TOKEN_TYPES = ["designToken"] as const;

/**
 * Semantic token modifiers.
 *
 * Applied to `var(--x)` occurrences based on provenance and scope.
 */
export const SEMANTIC_TOKEN_MODIFIERS = [
  "artifact",
  "registered",
  "local",
  "external",
  "scoped",
] as const;

/** A single semantic token encoded for LSP delta response. */
export interface SemanticToken {
  /** 0-indexed line. */
  line: number;
  /** 0-indexed start character. */
  startChar: number;
  /** Length in characters. */
  length: number;
  /** Index into SEMANTIC_TOKEN_TYPES. */
  tokenType: number;
  /** Bitmask of SEMANTIC_TOKEN_MODIFIERS indices. */
  tokenModifiers: number;
}

/** Legend describing the token types and modifiers. */
export interface SemanticTokensLegend {
  tokenTypes: readonly string[];
  tokenModifiers: readonly string[];
}

// ---------------------------------------------------------------------------
// Workspace symbol  (§9.9)
// ---------------------------------------------------------------------------

/** Symbol kind (subset for design tokens). */
export enum SymbolKind {
  Variable = 13,
  Property = 7,
  Constant = 14,
}

// ---------------------------------------------------------------------------
// Navigation tier  (§8)
// ---------------------------------------------------------------------------

/**
 * Navigation tier for go-to-definition.
 */
export type NavigationTier =
  | { tier: 1; label: "source map" }
  | { tier: 2; label: "artifact direct" }
  | { tier: 3; label: "declaration" };

// ---------------------------------------------------------------------------
// JSON reporter  (§14.3)
// ---------------------------------------------------------------------------

/** JSON reporter output for `terrazzo-lsp check --reporter json`. */
export interface CheckReport {
  summary: CheckReportSummary;
  diagnostics: CheckReportDiagnostic[];
}

/** Summary section of the JSON check report. */
export interface CheckReportSummary {
  files: number;
  diagnostics: {
    error: number;
    warning: number;
    info: number;
    hint: number;
  };
  graph: {
    tokenNodes: number;
    fileNodes: number;
    declarationNodes: number;
    propertyNodes: number;
    importEdges: number;
  };
  navigationTier: number;
}

/** Single diagnostic entry in the JSON check report. */
export interface CheckReportDiagnostic {
  file: string;
  line: number;
  column: number;
  code: DiagnosticCode;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  fixable: boolean;
}
