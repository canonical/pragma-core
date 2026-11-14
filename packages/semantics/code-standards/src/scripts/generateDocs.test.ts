import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import generateDocs from "./generateDocs.js";

/** Writes `files` as the data folder, runs the generator, and returns its output. */
const run = (files: Readonly<Record<string, string>>) => {
  const root = mkdtempSync(join(tmpdir(), "generateDocs-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const outputDir = join(root, "docs");
  mkdirSync(dataDir);
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dataDir, name), text);
  }
  const log: string[] = [];
  const generate = () =>
    generateDocs({ dataDir, outputDir, log: (line) => log.push(line) });
  const read = (file: string) => readFileSync(join(outputDir, file), "utf8");
  return {
    generate,
    read,
    log,
    listPages: () => readdirSync(outputDir).toSorted(),
  };
};

const formatStandard = (id: string, category: string) => `
${id} a cs:CodeStandard ;
    cs:hasCategory ${category} ;
    cs:description "${id}." .
`;

describe("generateDocs", () => {
  it("writes a page per category file and an index", () => {
    const { generate, read, log, listPages } = run({
      "alpha.ttl": `cs:alpha a cs:Category ;
    rdfs:label "Alpha"@en ;
    cs:slug "alpha" .

cs:alpha.sub a cs:Category ;
    rdfs:label "Sub"@en ;
    skos:broader cs:alpha .

cs:alpha.empty a cs:Category ;
    rdfs:label "Empty"@en ;
    skos:broader cs:alpha .
${formatStandard("cs:alpha.one", "cs:alpha")}${formatStandard("cs:alpha.two", "cs:alpha.sub")}${formatStandard("cs:alpha.three", "cs:elsewhere")}`,
      "beta.ttl": `cs:beta a cs:Category ;
    rdfs:label "Beta"@en ;
    skos:broader cs:alpha .
${formatStandard("cs:beta.one", "cs:beta")}`,
      "standards-only.ttl": formatStandard("cs:lonely", "cs:alpha"),
      "categories-only.ttl": `cs:gamma a cs:Category ;
    rdfs:label "Gamma"@en .`,
      "notes.md": "Not Turtle.",
    });

    generate();

    expect(listPages()).toEqual(["alpha.md", "beta.md", "index.md"]);
    expect(read("alpha.md")).toContain("## cs:alpha.three");
    expect(read("alpha.md")).toContain("# Sub\n\n## cs:alpha.two");
    expect(read("alpha.md")).not.toContain("# Empty");
    expect(read("index.md")).toBe(
      [
        "# Code Standards",
        "",
        "Standards documentation generated from the code-standards ontology.",
        "",
        "## Categories",
        "",
        "- [Alpha](./alpha.md) (3)",
        "  - Sub",
        "- [Beta](./beta.md) (1)",
        "",
      ].join("\n"),
    );
    expect(log).toHaveLength(3);
  });

  it("names the file and standard it cannot read", () => {
    const { generate } = run({
      "broken.ttl": `cs:root a cs:Category ;
    rdfs:label "Root"@en .

cs:x a cs:CodeStandard ;
    cs:hasCategory cs:root ;
    cs:description "Never closed ;`,
    });

    expect(generate).toThrow("broken.ttl: cs:x: Unterminated literal");
  });
});
