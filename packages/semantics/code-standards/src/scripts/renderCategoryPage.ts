import renderStandard from "./renderStandard.js";
import type { Category } from "./types.js";

/** Renders a category's opening lines, its scope note and its standards. */
const renderSection = (category: Category, opening: string[]): string[] => [
  ...opening,
  ...(category.scopeNote ? [`> **Scope:** ${category.scopeNote}`, ""] : []),
  ...category.standards.flatMap(renderStandard),
];

/** Returns the Markdown page of a root category and its subcategories, in the order given. */
export default function renderCategoryPage(
  root: Category,
  subcategories: readonly Category[],
): string {
  return [
    ...renderSection(root, [
      `# ${root.label} Standards`,
      "",
      `Standards for ${root.slug} development.`,
      "",
    ]),
    ...subcategories.flatMap((sub) =>
      renderSection(sub, [`# ${sub.label}`, ""]),
    ),
  ].join("\n");
}
