import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import assertDefined from "./assertDefined.js";
import parseCategories from "./parseCategories.js";
import parseStandards from "./parseStandards.js";
import renderCategoryPage from "./renderCategoryPage.js";
import type { Category, GenerateDocsOptions } from "./types.js";

/** One line of the index: a page, its count of standards and its subcategories. */
interface IndexEntry {
  readonly label: string;
  readonly slug: string;
  readonly count: number;
  readonly subcategories: readonly string[];
}

/** Writes the page of one data file, and returns its index entry, if it has one. */
const writePage = (
  { dataDir, outputDir, log }: GenerateDocsOptions,
  file: string,
): IndexEntry[] => {
  const content = readFileSync(join(dataDir, file), "utf-8");
  let categories: ReturnType<typeof parseCategories>;
  let standards: ReturnType<typeof parseStandards>;
  try {
    categories = parseCategories(content);
    standards = parseStandards(content);
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
  if (categories.length === 0 || standards.length === 0) {
    return [];
  }

  const byId = new Map<string, Category>(
    categories.map((category) => [category.id, { ...category, standards: [] }]),
  );
  const rootInfo =
    categories.find((category) => category.broader === null) ??
    assertDefined(categories.at(0), "category");
  const root = assertDefined(byId.get(rootInfo.id), "root category");
  for (const standard of standards) {
    (byId.get(standard.categoryRef) ?? root).standards.push(standard);
  }
  const subcategories = categories
    .filter((category) => category.broader !== null && category !== rootInfo)
    .map((category) => assertDefined(byId.get(category.id), "subcategory"))
    .toSorted((a, b) => a.label.localeCompare(b.label));

  const slug = root.slug || basename(file, ".ttl");
  const page = join(outputDir, `${slug}.md`);
  writeFileSync(page, renderCategoryPage(root, subcategories));
  log(`Generated ${page} (${standards.length} standards)`);

  return [
    {
      label: root.label,
      slug,
      count: standards.length,
      subcategories: subcategories
        .filter((sub) => sub.standards.length > 0)
        .map((sub) => sub.label),
    },
  ];
};

/**
 * Writes a Markdown page per category file in `dataDir`, and an index, to
 * `outputDir`. Throws naming the file and standard it cannot read.
 */
export default function generateDocs(options: GenerateDocsOptions): void {
  mkdirSync(options.outputDir, { recursive: true });

  const entries = readdirSync(options.dataDir)
    .filter((file) => file.endsWith(".ttl"))
    .flatMap((file) => writePage(options, file))
    .toSorted((a, b) => a.label.localeCompare(b.label));

  const index = [
    "# Code Standards",
    "",
    "Standards documentation generated from the code-standards ontology.",
    "",
    "## Categories",
    "",
    ...entries.flatMap((entry) => [
      `- [${entry.label}](./${entry.slug}.md) (${entry.count})`,
      ...entry.subcategories.map((sub) => `  - ${sub}`),
    ]),
    "",
  ];
  const indexFile = join(options.outputDir, "index.md");
  writeFileSync(indexFile, index.join("\n"));
  options.log(`Generated ${indexFile}`);
}
