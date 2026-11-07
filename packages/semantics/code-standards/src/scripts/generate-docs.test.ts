import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";

const script = fileURLToPath(new URL("./generate-docs.ts", import.meta.url));

const CATEGORY = `@prefix cs: <http://pragma.canonical.com/codestandards#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cs:sample a cs:Category ;
    rdfs:label "Sample"@en ;
    cs:slug "sample" .
`;

/** Runs the generator on `turtle` as the only data file. */
const generate = (turtle: string) => {
  const root = mkdtempSync(join(tmpdir(), "generate-docs-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const data = join(root, "data");
  const out = join(root, "docs");
  mkdirSync(data);
  writeFileSync(join(data, "sample.ttl"), turtle);
  const run = spawnSync("bun", [script, out, data], { encoding: "utf8" });
  const read = (file: string): string => readFileSync(join(out, file), "utf8");
  return { run, read };
};

describe("generate-docs", () => {
  it("renders a standard with its identifier, description and examples", () => {
    const { run, read } = generate(`${CATEGORY}
cs:sample.rule a cs:CodeStandard ;
    rdfs:label "A sample rule"@en ;
    cs:hasCategory cs:sample ;
    cs:description "Samples follow the rule." ;
    cs:do [
        cs:description "Follow the rule" ;
        cs:language "typescript" ;
        cs:code """
const followed = true;
    """
    ] ;
    cs:dont [
        cs:description "Break the rule" ;
        cs:code """
broken
    """
    ] .
`);

    expect(run.status).toBe(0);
    expect(read("sample.md")).toBe(`# Sample Standards

Standards for sample development.

## A sample rule

**Identifier:** \`cs:sample.rule\`

Samples follow the rule.

### Do

Follow the rule
\`\`\`typescript
const followed = true;
\`\`\`

### Don't

Break the rule
\`\`\`
broken
\`\`\`

---
`);
  });

  it("lists each category in the index with its count of standards", () => {
    const { run, read } = generate(`${CATEGORY}
cs:sample.one a cs:CodeStandard ;
    rdfs:label "One"@en ;
    cs:hasCategory cs:sample ;
    cs:description "One." .

cs:sample.two a cs:CodeStandard ;
    rdfs:label "Two"@en ;
    cs:hasCategory cs:sample ;
    cs:description "Two." .
`);

    expect(run.status).toBe(0);
    expect(read("index.md")).toContain("- [Sample](./sample.md) (2)\n");
  });
});
