/** A CSS declaration node. */
export interface CSSDeclaration {
  type: "Declaration";
  property: string;
  value: string;
  comment?: string;
}

/** A CSS rule node with nested children. */
export interface CSSRule {
  type: "Rule";
  prelude: string[];
  children: (CSSRule | CSSDeclaration)[];
}

/** Any CSS AST node handled by the printer helpers. */
export type CSSNode = CSSRule | CSSDeclaration;

/** Printer options for CSS AST serialization. */
export interface PrintOptions {
  indentChar?: string;
  indentLv?: number;
}
