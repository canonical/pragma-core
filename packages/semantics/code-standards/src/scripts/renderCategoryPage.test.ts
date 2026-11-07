import { describe, expect, it } from "vitest";
import renderCategoryPage from "./renderCategoryPage.js";
import type { Category } from "./types.js";

const standard = (id: string) => ({
  id,
  name: "",
  description: `${id}.`,
  categoryRef: "",
  dos: [],
  donts: [],
});

const category = (
  label: string,
  overrides: Partial<Category> = {},
): Category => ({
  id: `cs:${label}`,
  label,
  slug: label.toLowerCase(),
  broader: null,
  scopeNote: "",
  standards: [],
  ...overrides,
});

describe("renderCategoryPage", () => {
  it("renders the root, then the subcategories with standards, sorted", () => {
    const page = renderCategoryPage(
      category("Root", {
        scopeNote: "Root only.",
        standards: [standard("cs:r")],
      }),
      [
        category("Zed", { standards: [standard("cs:z")] }),
        category("Empty"),
        category("Alpha", {
          scopeNote: "Alpha only.",
          standards: [standard("cs:a")],
        }),
      ],
    );

    expect(page).toBe(
      [
        "# Root Standards",
        "",
        "Standards for root development.",
        "",
        "> **Scope:** Root only.",
        "",
        "## cs:r",
        "",
        "cs:r.",
        "",
        "---",
        "",
        "# Alpha",
        "",
        "> **Scope:** Alpha only.",
        "",
        "## cs:a",
        "",
        "cs:a.",
        "",
        "---",
        "",
        "# Zed",
        "",
        "## cs:z",
        "",
        "cs:z.",
        "",
        "---",
        "",
      ].join("\n"),
    );
  });
});
