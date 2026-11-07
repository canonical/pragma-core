import type { Example, Standard } from "./types.js";

/** Renders an example as its description and its fenced code. */
const renderExample = (example: Example): string =>
  [
    example.description,
    example.code && `\`\`\`${example.language}\n${example.code}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n");

/** Returns the Markdown lines of one standard's section. */
export default function renderStandard(standard: Standard): string[] {
  const lines = [`## ${standard.name || standard.id}`, ""];

  if (standard.name) {
    lines.push(`**Identifier:** \`${standard.id}\``, "");
  }

  lines.push(standard.description, "");

  for (const [heading, examples] of [
    ["Do", standard.dos],
    ["Don't", standard.donts],
  ] as const) {
    if (examples.length > 0) {
      lines.push(`### ${heading}`, "");
      for (const example of examples) {
        lines.push(renderExample(example), "");
      }
    }
  }

  lines.push("---", "");
  return lines;
}
