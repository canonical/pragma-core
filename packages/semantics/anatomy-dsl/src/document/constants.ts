/**
 * Why text that holds a second YAML document is rejected. The `yaml`
 * package's own message for it advises its multi-document API, which is no
 * repair for an anatomy: an anatomy is one document.
 */
export const MULTIPLE_DOCUMENTS_REASON =
  "an anatomy is one YAML document, and a second `---` starts another";
