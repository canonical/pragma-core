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
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const MAX_DESCRIPTION = 1024;
const MAX_LINES = 500;

const skillNames = readdirSync(SKILLS_DIR);

describe("skill files", () => {
  it("finds the skills", () => {
    expect(skillNames.length).toBeGreaterThan(0);
  });

  for (const folder of skillNames) {
    describe(folder, () => {
      const text = readFileSync(new URL(`${folder}/SKILL.md`, SKILLS_DIR), "utf-8");
      const match = text.match(FRONTMATTER);
      const frontmatter = match
        ? (Bun.YAML.parse(match[1] ?? "") as Record<string, unknown>)
        : {};

      it("opens with YAML frontmatter", () => {
        expect(match).not.toBeNull();
      });

      it("is named after its folder", () => {
        expect(frontmatter.name).toBe(folder);
      });

      it("has a description that names both repositories", () => {
        const description = String(frontmatter.description ?? "");
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
        expect(description).toContain("canonical/pragma-core");
        expect(description).toContain("canonical/pragma-web");
      });

      it(`stays under ${MAX_LINES} lines`, () => {
        expect(text.split("\n").length).toBeLessThan(MAX_LINES);
      });
    });
  }
});
