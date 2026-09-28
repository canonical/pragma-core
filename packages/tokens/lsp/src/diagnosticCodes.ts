export const DIAGNOSTIC_CODES = [
  "css/unknown-var",
  "css/missing-fallback",
  "css/stale-fallback",
  "css/type-mismatch",
  "css/type-uncertain",
  "css/unreachable-token",
  "css/primitive-token",
  "css/scoped-usage",
  "css/no-color-scheme",
  "dtcg/broken-alias",
  "dtcg/schema-violation",
  "dtcg/circular-alias",
  "dtcg/missing-type",
  "dtcg/draft-syntax",
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export const KNOWN_CODES: ReadonlySet<DiagnosticCode> = new Set(
  DIAGNOSTIC_CODES,
);
