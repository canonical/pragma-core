#!/usr/bin/env bun
/**
 * Transforms code standards from TTL to readable markdown per category.
 * Usage: bun src/scripts/generate-docs.ts [output-dir]
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const DATA_DIR = join(import.meta.dir, "../../data");
const DEFAULT_OUTPUT = "./docs";

interface Example {
  description: string;
  language: string;
  code: string;
}

interface Standard {
  id: string;
  name: string;
  description: string;
  categoryRef: string;
  dos: Example[];
  donts: Example[];
}

interface Category {
  id: string;
  label: string;
  slug: string;
  broader: string | null;
  scopeNote: string;
  standards: Standard[];
}

// Extract a single string literal (single-line or triple-quoted)
/**
 * Extract a standard's display label.
 *
 * Deliberately NOT `extractLiteral`: that helper tries the triple-quoted form
 * first, and a standard whose own subject matter is Turtle carries `rdfs:label`
 * inside its `cs:code` examples — so the greedy form can pick an example's label
 * over the subject's own. A label is always a single-line literal with an
 * optional language tag, and the migration writes it as the first predicate
 * after `a cs:CodeStandard`, so the first single-line match is the right one.
 */
function extractLabel(block: string): string {
  const match = block.match(/rdfs:label\s+"([^"\n]*)"(?:@[A-Za-z-]+)?/);
  return match?.[1]?.trim() ?? "";
}

function extractLiteral(content: string, predicate: string): string {
  const regex = new RegExp(`${predicate}\\s+"""([\\s\\S]*?)"""`, "g");
  const match = regex.exec(content);
  if (match?.[1]) return match[1].trim();

  const singleLine = new RegExp(`${predicate}\\s+"([^"]*)"`, "g");
  const singleMatch = singleLine.exec(content);
  return singleMatch?.[1]?.trim() ?? "";
}

/**
 * Parse all categories from a TTL file.
 */
function parseCategories(content: string): {
  id: string;
  label: string;
  slug: string;
  broader: string | null;
  scopeNote: string;
}[] {
  const categories: {
    id: string;
    label: string;
    slug: string;
    broader: string | null;
    scopeNote: string;
  }[] = [];

  const catRegex = /^(cs:[A-Za-z0-9_.]+)\s+a\s+cs:Category\b/gm;
  let match = catRegex.exec(content);

  while (match !== null) {
    const id = match[1] ?? "";
    const startIdx = match.index;

    // Find the block ending with " ."
    let endIdx = content.indexOf("\n\n", startIdx);
    if (endIdx === -1) endIdx = content.length;
    const block = content.slice(startIdx, endIdx);

    const label = block.match(/rdfs:label\s+"([^"]+)"(?:@en)?/)?.[1] ?? "";
    const slug = block.match(/cs:slug\s+"([^"]+)"/)?.[1] ?? "";
    const broader =
      block.match(/skos:broader\s+(cs:[A-Za-z0-9_.]+)/)?.[1] ?? null;
    const scopeNote =
      block.match(/skos:scopeNote\s+"([^"]+)"(?:@en)?/)?.[1] ?? "";

    categories.push({ id, label, slug, broader, scopeNote });
    match = catRegex.exec(content);
  }

  return categories;
}

/**
 * Parse blank node examples from a standard block for a given predicate (cs:do or cs:dont).
 */
function parseExamples(
  block: string,
  predicate: "cs:do" | "cs:dont",
): Example[] {
  const examples: Example[] = [];

  // Match blank node patterns: predicate [ ... ]
  // We need to handle nested triple-quoted strings inside the blank node
  const escapedPred = predicate.replace(".", "\\.");
  const regex = new RegExp(`${escapedPred}\\s*\\[`, "g");
  let match = regex.exec(block);

  while (match !== null) {
    const startIdx = match.index + match[0].length;

    // Find the matching closing bracket, accounting for nested triple-quoted strings
    let depth = 1;
    let i = startIdx;
    let inTripleQuote = false;

    while (i < block.length && depth > 0) {
      if (!inTripleQuote) {
        if (block.slice(i, i + 3) === '"""') {
          inTripleQuote = true;
          i += 3;
          continue;
        }
        if (block[i] === "[") depth++;
        if (block[i] === "]") depth--;
      } else {
        if (block.slice(i, i + 3) === '"""') {
          inTripleQuote = false;
          i += 3;
          continue;
        }
      }
      i++;
    }

    const blankNodeContent = block.slice(startIdx, i - 1);

    const description = extractLiteral(blankNodeContent, "cs:description");
    const language = extractLiteral(blankNodeContent, "cs:language");
    const code = extractLiteral(blankNodeContent, "cs:code");

    examples.push({ description, language, code });
    match = regex.exec(block);
  }

  return examples;
}

function parseStandards(content: string): Standard[] {
  const lines = content.split("\n");
  const starts: number[] = [];
  const subjectPattern =
    /^[A-Za-z][\w-]*:[A-Za-z0-9_.-]+\s+a\s+cs:CodeStandard/;
  let inTripleQuote = false;
  let offset = 0;

  for (const line of lines) {
    if (!inTripleQuote && subjectPattern.test(line)) {
      starts.push(offset);
    }

    const tripleQuotes = line.match(/"""/g)?.length ?? 0;
    if (tripleQuotes % 2 === 1) {
      inTripleQuote = !inTripleQuote;
    }

    offset += line.length + 1;
  }

  const blocks = starts.map((start, index) => {
    const end = starts[index + 1] ?? content.length;
    return content.slice(start, end);
  });
  const standards: Standard[] = [];

  for (const block of blocks) {
    if (!block.includes("a cs:CodeStandard")) continue;
    if (!block.includes("cs:hasCategory")) continue;

    const id =
      block
        .match(/^([A-Za-z][\w-]*:[A-Za-z0-9_.-]+)\s+a\s+cs:CodeStandard/m)?.[1]
        ?.trim() || "";
    const categoryRef =
      block.match(/cs:hasCategory\s+(cs:[A-Za-z0-9_.]+)/)?.[1] ?? "";
    const name = extractLabel(block);
    const description = extractLiteral(block, "cs:description");
    const dos = parseExamples(block, "cs:do");
    const donts = parseExamples(block, "cs:dont");

    if (id) {
      standards.push({ id, name, description, categoryRef, dos, donts });
    }
  }

  return standards.sort((a, b) => a.id.localeCompare(b.id));
}

function renderExample(example: Example): string {
  const parts: string[] = [];

  if (example.description) {
    parts.push(example.description);
  }

  if (example.code) {
    const lang = example.language || "";
    parts.push(`\`\`\`${lang}\n${example.code}\n\`\`\``);
  }

  return parts.join("\n");
}

function renderStandard(std: Standard): string[] {
  const lines: string[] = [];

  lines.push(`## ${std.name || std.id}`, "");

  if (std.name) {
    lines.push(`**Identifier:** \`${std.id}\``, "");
  }

  lines.push(std.description, "");

  if (std.dos.length > 0) {
    lines.push("### Do", "");
    for (const ex of std.dos) {
      lines.push(renderExample(ex), "");
    }
  }
  if (std.donts.length > 0) {
    lines.push("### Don't", "");
    for (const ex of std.donts) {
      lines.push(renderExample(ex), "");
    }
  }
  lines.push("---", "");

  return lines;
}

interface DocCategory {
  label: string;
  slug: string;
  totalStandards: number;
  subcategories: string[];
}

function generateMarkdown(root: Category, subcategories: Category[]): string {
  const lines: string[] = [
    `# ${root.label} Standards`,
    "",
    `Standards for ${root.slug} development.`,
    "",
  ];

  if (root.scopeNote) {
    lines.push(`> **Scope:** ${root.scopeNote}`, "");
  }

  // Render standards that belong directly to the root category
  for (const std of root.standards) {
    lines.push(...renderStandard(std));
  }

  // Render each subcategory as a section
  for (const sub of subcategories.sort((a, b) =>
    a.label.localeCompare(b.label),
  )) {
    if (sub.standards.length === 0) continue;

    lines.push(`# ${sub.label}`, "");

    if (sub.scopeNote) {
      lines.push(`> **Scope:** ${sub.scopeNote}`, "");
    }

    for (const std of sub.standards) {
      lines.push(...renderStandard(std));
    }
  }

  return lines.join("\n");
}

function main() {
  const outputDir = process.argv[2] || DEFAULT_OUTPUT;
  mkdirSync(outputDir, { recursive: true });

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".ttl"));
  const docCategories: DocCategory[] = [];

  for (const file of files) {
    const content = readFileSync(join(DATA_DIR, file), "utf-8");
    const cats = parseCategories(content);
    const standards = parseStandards(content);

    if (cats.length === 0 || standards.length === 0) continue;

    // Find root category (no broader) — fallback to first (cats is non-empty here)
    const root = cats.find((c) => c.broader === null) ?? cats[0];
    if (!root) continue;
    const subcats = cats.filter((c) => c.broader !== null);

    // Assign standards to their categories
    const catMap = new Map<string, Category>();
    for (const cat of cats) {
      catMap.set(cat.id, { ...cat, standards: [] });
    }

    for (const std of standards) {
      const cat = catMap.get(std.categoryRef);
      if (cat) {
        cat.standards.push(std);
      } else {
        catMap.get(root.id)?.standards.push(std);
      }
    }

    const rootCat = catMap.get(root.id);
    if (!rootCat) continue;
    const subCats = subcats.flatMap((s) => {
      const c = catMap.get(s.id);
      return c ? [c] : [];
    });

    const markdown = generateMarkdown(rootCat, subCats);
    const slug = root.slug || basename(file, ".ttl");
    const outFile = join(outputDir, `${slug}.md`);
    writeFileSync(outFile, markdown);
    console.log(`Generated ${outFile} (${standards.length} standards)`);

    docCategories.push({
      label: root.label,
      slug,
      totalStandards: standards.length,
      subcategories: subCats
        .filter((s) => s.standards.length > 0)
        .map((s) => s.label),
    });
  }

  // Generate index
  const indexLines = [
    "# Code Standards",
    "",
    "Standards documentation generated from the code-standards ontology.",
    "",
    "## Categories",
    "",
  ];

  for (const c of docCategories.sort((a, b) =>
    a.label.localeCompare(b.label),
  )) {
    indexLines.push(`- [${c.label}](./${c.slug}.md) (${c.totalStandards})`);
    for (const sub of c.subcategories) {
      indexLines.push(`  - ${sub}`);
    }
  }

  indexLines.push("");

  writeFileSync(join(outputDir, "index.md"), indexLines.join("\n"));
  console.log(`Generated ${join(outputDir, "index.md")}`);
}

main();
