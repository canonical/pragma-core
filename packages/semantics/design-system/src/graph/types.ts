import type { Quad as N3Quad } from "n3";

/**
 * Re-export n3 Quad type for use across the codebase
 */
export type Quad = N3Quad;

/**
 * Literal value with optional language or datatype
 */
export interface Literal {
  value: string;
  language?: string;
  datatype?: string;
}

/**
 * Term can be a URI string or a Literal
 */
export type Term = string | Literal;
