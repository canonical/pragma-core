/** A do or don't example of a standard. */
export interface Example {
  readonly description: string;
  readonly language: string;
  readonly code: string;
}

/** A code standard, as its Turtle block declares it. */
export interface Standard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryRef: string;
  readonly dos: readonly Example[];
  readonly donts: readonly Example[];
}

/** A category, as its Turtle block declares it. */
export interface CategoryInfo {
  readonly id: string;
  readonly label: string;
  readonly slug: string;
  readonly broader: string | null;
  readonly scopeNote: string;
}

/** A category with the standards assigned to it. */
export interface Category extends CategoryInfo {
  readonly standards: Standard[];
}

/** A match found in Turtle text, from its start to just after its end. */
export interface Found {
  readonly index: number;
  readonly end: number;
  readonly text: string;
}

/** A subject line found in Turtle text: its IRI, its class and where it sits. */
export interface Subject extends Found {
  readonly id: string;
  readonly type: string;
}

/** Where `generateDocs` reads and writes, and where it reports each page. */
export interface GenerateDocsOptions {
  readonly dataDir: string;
  readonly outputDir: string;
  readonly log: (line: string) => void;
}
