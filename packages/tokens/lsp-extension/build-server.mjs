#!/usr/bin/env node

/**
 * Bundle the language server into a self-contained `dist/esm/cli.js`.
 *
 * The server is spawned as a child process from a packaged extension, where
 * no `node_modules` is present: `.vscodeignore` excludes it from the VSIX and
 * `vsce package --no-dependencies` keeps it out. Copying
 * `@canonical/terrazzo-lsp/dist/esm` verbatim therefore ships a tree whose
 * bare specifiers (`colorjs.io/fn`, `@lezer/common`, `@lezer/css`) cannot be
 * resolved, and the server dies on load with ERR_MODULE_NOT_FOUND.
 *
 * Bundling inlines those dependencies so the shipped server needs nothing
 * beside it. The output path is unchanged, so `terrazzo-lsp.serverPath` and
 * the `dist/esm/cli.js` the extension spawns keep working.
 *
 * @note Impure — spawns a child process and writes to `dist/esm`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Anchor every path to this file, not to the caller's cwd.
const packageDir = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(
  packageDir,
  "node_modules/@canonical/terrazzo-lsp/dist/esm/cli.js",
);
const OUT_DIR = join(packageDir, "dist/esm");
const OUT_FILE = join(OUT_DIR, "cli.js");

rmSync(OUT_DIR, { force: true, recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

execFileSync(
  "bun",
  ["build", ENTRY, "--outfile", OUT_FILE, "--format=esm", "--target=node"],
  { stdio: "inherit" },
);

// The extension's own package.json has no `"type": "module"` — `main` is a CJS
// bundle — so Node would reparse the ESM server on every start. A scoped
// marker beside the bundle settles its module type without touching that.
writeFileSync(
  join(OUT_DIR, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
