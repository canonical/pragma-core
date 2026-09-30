import { type Document, LineCounter, parseDocument } from "yaml";
import AnatomySyntaxError from "./AnatomySyntaxError.js";
import { MULTIPLE_DOCUMENTS_REASON } from "./constants.js";

/**
 * Parse anatomy text into a YAML document, and reject text that is not
 * well-formed YAML: the `yaml` package records a syntax error on the document
 * instead of throwing, and a duplicate key or a second `---` document is one
 * of those errors. The first error is thrown as an `AnatomySyntaxError` with
 * its line and column. Every consumer that parses anatomy text parses it
 * here, so they all reject the same text the same way.
 *
 * Pass a fresh `lineCounter` to map other offsets in the document to lines
 * and columns afterwards.
 *
 * @note Impure: records the text's line starts in `lineCounter`.
 * @throws AnatomySyntaxError when the text holds a YAML syntax error.
 */
export default function parseAnatomyDocument(
  text: string,
  lineCounter: LineCounter = new LineCounter(),
): Document {
  const document = parseDocument(text, { lineCounter, prettyErrors: false });
  const error = document.errors.at(0);
  if (error === undefined) return document;
  const { line, col } = lineCounter.linePos(error.pos[0]);
  const reason =
    error.code === "MULTIPLE_DOCS" ? MULTIPLE_DOCUMENTS_REASON : error.message;
  throw new AnatomySyntaxError(reason, line, col);
}
