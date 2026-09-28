#!/usr/bin/env node

/**
 * Wrapper around `vsce package` that temporarily adjusts package.json
 * for vsce compatibility:
 *   - strips the npm scope from `name` (vsce rejects scoped names)
 *   - removes the `files` field (conflicts with .vscodeignore)
 *
 * The original package.json is always restored — even if vsce fails.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "package.json";
const raw = readFileSync(FILE, "utf8");
const pkg = JSON.parse(raw);

pkg.name = pkg.name.replace(/@.*\//, "");
delete pkg.files;
writeFileSync(FILE, JSON.stringify(pkg, null, 2) + "\n");

try {
  execFileSync(
    "vsce",
    ["package", "--no-dependencies", "-o", "terrazzo-lsp.vsix"],
    {
      stdio: "inherit",
    },
  );
} finally {
  writeFileSync(FILE, raw);
}
