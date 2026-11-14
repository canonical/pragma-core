import { describe, expect, it } from "vitest";
import renderCategoryPage from "./renderCategoryPage.js";
import type { Category } from "./types.js";

const createStandard = (id: string) => ({
  id,
  name: "",
  description: `${id}.`,
  categoryRef: "",
  dos: [],
  donts: [],
});

const createCategory = (
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
  it("renders the root, then the subcategories in the order given", () => {
    const page = renderCategoryPage(
      createCategory("Root", {
        scopeNote: "Root only.",
        standards: [createStandard("cs:r")],
      }),
      [
        createCategory("Alpha", {
          scopeNote: "Alpha only.",
          standards: [createStandard("cs:a")],
        }),
        createCategory("Zed", { standards: [createStandard("cs:z")] }),
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
