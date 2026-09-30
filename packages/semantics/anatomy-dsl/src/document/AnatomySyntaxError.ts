/**
 * Anatomy text that is not well-formed YAML: an unclosed flow collection, a
 * duplicate key, a second document. Carries the line and column (both
 * 1-based) where the first such error starts, and its reason apart from the
 * location, for a caller that prints the location in its own form.
 */
export default class AnatomySyntaxError extends Error {
  constructor(
    readonly reason: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(`YAML syntax error at line ${line}, column ${col}: ${reason}`);
    this.name = "AnatomySyntaxError";
  }
}
