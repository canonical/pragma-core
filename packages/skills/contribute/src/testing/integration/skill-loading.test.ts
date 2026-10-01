/**
 * Every skill in this package, held to the rules that make it load and trigger.
 *
 * A harness reads a skill only when its `SKILL.md` opens with YAML frontmatter that
 * carries a `name` and a `description`, and chooses it by the description alone. These
 * skills are for the two pragma repositories only, so each description names both, and
 * each body stays under the 500 lines Anthropic's authoring guidance sets.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const SKILLS_DIR = new URL("../../../skills/", import.meta.url);
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const MAX_DESCRIPTION = 1024;
const MAX_LINES = 500;

/**
 * Read a skill's `SKILL.md` and the YAML block that opens it, if there is one.
 *
 * @note Impure: reads the file from disk, which is what the test checks.
 */
function readSkill(folder: string): { text: string; yaml: string | undefined } {
  const text = readFileSync(new URL(`${folder}/SKILL.md`, SKILLS_DIR), "utf-8");
  return { text, yaml: text.match(FRONTMATTER)?.at(1) };
}

/** Parse a skill's frontmatter, or return an empty record when there is none. */
function parseFrontmatter(yaml: string | undefined): Record<string, unknown> {
  return yaml === undefined
    ? {}
    : (Bun.YAML.parse(yaml) as Record<string, unknown>);
}

const folders = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("skill loading", () => {
  it("finds the skills", () => {
    expect(folders.length).toBeGreaterThan(0);
  });

  for (const folder of folders) {
    describe(folder, () => {
      it("opens with YAML frontmatter that parses", () => {
        const { yaml } = readSkill(folder);
        expect(yaml).toBeDefined();
        expect(() => parseFrontmatter(yaml)).not.toThrow();
      });

      it("is named after its folder", () => {
        expect(parseFrontmatter(readSkill(folder).yaml).name).toBe(folder);
      });

      it("has a description that names both repositories", () => {
        const description = String(
          parseFrontmatter(readSkill(folder).yaml).description ?? "",
        );
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
        expect(description).toContain("canonical/pragma-core");
        expect(description).toContain("canonical/pragma-web");
      });

      it(`stays under ${MAX_LINES} lines`, () => {
        expect(readSkill(folder).text.split("\n").length).toBeLessThan(
          MAX_LINES,
        );
      });
    });
  }
});
