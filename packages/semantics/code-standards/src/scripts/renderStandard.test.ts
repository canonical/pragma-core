import { describe, expect, it } from "vitest";
import renderStandard from "./renderStandard.js";

const base = { id: "cs:x", name: "X", description: "Ex.", categoryRef: "cs:r" };

describe("renderStandard", () => {
  it("renders the name, identifier, description and examples", () => {
    expect(
      renderStandard({
        ...base,
        dos: [{ description: "Do", language: "css", code: "a {}" }],
        donts: [{ description: "", language: "", code: "b" }],
      }).join("\n"),
    ).toBe(
      "## X\n\n**Identifier:** `cs:x`\n\nEx.\n\n### Do\n\nDo\n```css\na {}\n```\n\n### Don't\n\n```\nb\n```\n\n---\n",
    );
  });

  it("falls back to the identifier, and leaves out empty sections", () => {
    expect(
      renderStandard({
        ...base,
        name: "",
        dos: [{ description: "Only words", language: "", code: "" }],
        donts: [],
      }).join("\n"),
    ).toBe("## cs:x\n\nEx.\n\n### Do\n\nOnly words\n\n---\n");
  });
});
