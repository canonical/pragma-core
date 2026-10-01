import { type Document, LineCounter } from "yaml";
import {
  type AnatomySyntaxError,
  parseAnatomyDocument,
} from "../document/index.js";
import { parseAnatomyYAML } from "../parse.js";
import { AnatomyValueError } from "../value.js";
import locateStyleValue from "./locateStyleValue.js";
import type { Problem } from "./types.js";

/**
 * Check anatomy YAML text with `parseAnatomyDocument` and `parseAnatomyYAML`,
 * the parsers every consumer of an anatomy uses, and return the first problem
 * they find, with the line and column of a YAML syntax error or of a rejected
 * style value. Returns undefined when the text parses.
 */
export default function checkText(text: string): Problem | undefined {
  const lineCounter = new LineCounter();
  let document: Document;
  try {
    document = parseAnatomyDocument(text, lineCounter);
  } catch (error) {
    const { reason, line, col } = error as AnatomySyntaxError;
    return { message: reason, line, col };
  }
  try {
    parseAnatomyYAML(document.toJS());
    return undefined;
  } catch (error) {
    const message = (error as Error).message;
    if (!(error instanceof AnatomyValueError)) return { message };
    const offset = locateStyleValue(document, error);
    return offset === undefined
      ? { message }
      : { message, ...lineCounter.linePos(offset) };
  }
}
