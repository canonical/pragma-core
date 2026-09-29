/**
 * `@types/vscode` must not exceed the VS Code floor the extension declares.
 *
 * `vsce package` enforces this, but `vsce` only runs from the `prepack`
 * lifecycle — that is, at publish time. So a bump that breaks it passes every
 * CI job and fails the release, which is exactly what happened when
 * `@types/vscode` moved to ~1.136.0 against an `engines.vscode` of ^1.91.0.
 *
 * The rule itself is not arbitrary: the types describe the API surface the
 * code is allowed to use, so they must track the OLDEST VS Code supported,
 * never the newest available. Raising them is a decision to drop support for
 * every editor older than the new floor, and that decision belongs in
 * `engines.vscode` first.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const engines = pkg.engines?.vscode;
const types = pkg.devDependencies?.["@types/vscode"];

if (!engines || !types) {
  console.error(
    "check-engines: expected both engines.vscode and @types/vscode",
  );
  process.exit(1);
}

/** [major, minor] from a range like `^1.91.0` or `~1.136.0`. */
const parse = (range) => {
  const m = /(\d+)\.(\d+)/.exec(range);
  if (!m)
    throw new Error(`check-engines: cannot read a version from "${range}"`);
  return [Number(m[1]), Number(m[2])];
};

const [engineMajor, engineMinor] = parse(engines);
const [typesMajor, typesMinor] = parse(types);

const exceeds =
  typesMajor > engineMajor ||
  (typesMajor === engineMajor && typesMinor > engineMinor);

if (exceeds) {
  console.error(
    `check-engines: @types/vscode ${types} is newer than engines.vscode ${engines}.\n` +
      `  vsce will refuse to package this, at publish time and not before.\n` +
      `  Either lower @types/vscode to ~${engineMajor}.${engineMinor}.0, or raise\n` +
      `  engines.vscode — which drops support for every editor below the new floor.`,
  );
  process.exit(1);
}

console.log(
  `check-engines: @types/vscode ${types} within engines.vscode ${engines}`,
);
