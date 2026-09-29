/**
 * The repository's generators, one subcommand each. Every output is committed
 * and diffed in CI, so a change to an input that is not reflected in the
 * committed file is a red bar rather than a silent drift.
 *
 *   bun run generate            all of them, in dependency order
 *   bun run generate:registry   definitions/registry.ttl, src/registry.generated.ts
 *   bun run generate:shapes     the closed styleKey sh:in of definitions/shapes.ttl
 *   bun run generate goldens    examples/turtle/*.ttl from examples/yaml/*
 *
 * Not part of the published build (tsconfig.build.json excludes it): it reads
 * the repository, not the package.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { parseAnatomyYAML } from "./parse.js";
import {
  buildRegistry,
  IN_BEGIN,
  IN_END,
  OR_BEGIN,
  OR_END,
  serialiseRegistry,
  serialiseRegistryModule,
  serialiseStyleKeyIn,
  serialiseValueKindOr,
  splice,
} from "./registry.js";
import { anatomyToTTL } from "./transform.js";

const ROOT = resolve(import.meta.dirname, "..");
const EXAMPLES = resolve(ROOT, "examples");

/** Regenerate the nine golden Turtle files from their YAML pairs. */
export function generateGoldens(): string[] {
  const written: string[] = [];
  const names = readdirSync(resolve(EXAMPLES, "yaml"))
    .filter((f) => f.endsWith(".anatomy.yaml"))
    .map((f) => f.replace(/\.anatomy\.yaml$/, ""))
    .sort();
  for (const name of names) {
    const yaml = readFileSync(
      resolve(EXAMPLES, "yaml", `${name}.anatomy.yaml`),
      "utf8",
    );
    const ttl = anatomyToTTL(parseAnatomyYAML(parse(yaml)));
    writeFileSync(resolve(EXAMPLES, "turtle", `${name}.ttl`), ttl);
    written.push(`examples/turtle/${name}.ttl`);
  }
  return written;
}

/** `definitions/registry.ttl` and `src/registry.generated.ts` (§4.2). */
export function generateRegistry(): string[] {
  const registry = buildRegistry();
  writeFileSync(
    resolve(ROOT, "definitions", "registry.ttl"),
    serialiseRegistry(registry),
  );
  writeFileSync(
    resolve(ROOT, "src", "registry.generated.ts"),
    serialiseRegistryModule(registry),
  );
  return ["definitions/registry.ttl", "src/registry.generated.ts"];
}

/**
 * The two generated blocks of `definitions/shapes.ttl`: the closed `sh:in` of
 * `anatomy:styleKey`, and the `sh:or` that makes `anatomy:valueKind` a
 * constraint.
 */
export function generateShapes(): string[] {
  const path = resolve(ROOT, "definitions", "shapes.ttl");
  const registry = buildRegistry();
  let source = readFileSync(path, "utf8");
  source = splice(source, IN_BEGIN, IN_END, serialiseStyleKeyIn(registry));
  source = splice(source, OR_BEGIN, OR_END, serialiseValueKindOr(registry));
  writeFileSync(path, source);
  return ["definitions/shapes.ttl"];
}

const SUBCOMMANDS: Record<string, () => string[]> = {
  registry: generateRegistry,
  shapes: generateShapes,
  goldens: generateGoldens,
};

if (import.meta.main) {
  const requested = process.argv.slice(2);
  const names = requested.length > 0 ? requested : Object.keys(SUBCOMMANDS);
  for (const name of names) {
    const run = SUBCOMMANDS[name];
    if (!run) {
      console.error(
        `unknown generator "${name}" — one of ${Object.keys(SUBCOMMANDS).join(", ")}`,
      );
      process.exit(1);
    }
    for (const file of run()) {
      console.log(`wrote ${file}`);
    }
  }
}
