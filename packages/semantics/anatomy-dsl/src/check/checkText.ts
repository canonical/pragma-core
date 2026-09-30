import { LineCounter, parseDocument } from "yaml";
import { parseAnatomyYAML } from "../parse.js";
import { AnatomyValueError } from "../value.js";
import locateStyleValue from "./locateStyleValue.js";
import type { Problem } from "./types.js";

/**
 * Check anatomy YAML text with `parseAnatomyYAML`, the parser every consumer
 * of an anatomy uses, and return the first problem it finds, with the line
 * and column of a rejected style value. Returns undefined when the text
 * parses.
 */
export default function checkText(text: string): Problem | undefined {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
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
