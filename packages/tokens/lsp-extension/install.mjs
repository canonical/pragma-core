#!/usr/bin/env node

/**
 * Install the Terrazzo LSP VS Code extension from the bundled VSIX.
 *
 * Resolves the VSIX path relative to this script via `import.meta.url`,
 * which always points to the real file — not the symlink in `.bin/`.
 *
 * @note Impure — spawns a child process and writes to stdout.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Editor CLIs that accept `--install-extension`, in preference order.
 * VS Code ships `code`; VSCodium ships `codium`; some distro builds of
 * Code - OSS ship `code-oss`.
 */
const EDITOR_COMMANDS = ["code", "codium", "code-oss"];

/** Return the first editor CLI on PATH, or `null` if none responds. */
function findEditorCommand() {
  for (const command of EDITOR_COMMANDS) {
    try {
      execFileSync(command, ["--version"], { stdio: "ignore" });
      return command;
    } catch {}
  }
  return null;
}

const packageDir = dirname(fileURLToPath(import.meta.url));
const vsixPath = join(packageDir, "terrazzo-lsp.vsix");

if (!existsSync(vsixPath)) {
  console.error(
    `VSIX not found at ${vsixPath}.\nRebuild with: bun run package`,
  );
  process.exit(1);
}

const editor = findEditorCommand();
if (!editor) {
  console.error(
    `No editor CLI found on PATH (tried: ${EDITOR_COMMANDS.join(", ")}).\n` +
      `Install the shell command for your editor, then install manually:\n` +
      `  <editor> --install-extension ${vsixPath}\n` +
      `Or use the GUI: Extensions -> ... -> Install from VSIX...`,
  );
  process.exit(1);
}

try {
  execFileSync(editor, ["--install-extension", vsixPath], {
    stdio: "inherit",
  });
} catch {
  console.error(
    `Auto-install with "${editor}" failed.\n` +
      `Install via the GUI instead: Extensions -> ... -> Install from VSIX...\n` +
      `  VSIX: ${vsixPath}`,
  );
  process.exit(1);
}

let installedPath = "";
try {
  installedPath = execFileSync(
    editor,
    ["--locate-extension", "canonical.terrazzo-lsp-extension"],
    {
      encoding: "utf8",
    },
  ).trim();
} catch {}

console.log(`
Terrazzo LSP extension installed to ${installedPath || "VS Code extensions directory"}

To get started:

  bun add @canonical/design-tokens --dev
  npm i @canonical/design-tokens --save-dev

Then copy this minimal config to terrazzo-lsp.config.json at the root of your project:

  {
    "artifacts": ["@canonical/design-tokens/dist/tokens.json"]
  }
`);
