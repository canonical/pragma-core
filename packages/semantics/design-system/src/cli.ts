#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { anatomies, extract, list, sync, transform } from "./commands/index.js";
import { validateConfig } from "./config/index.js";

const CONFIG_COMMANDS = ["list", "extract", "transform"] as const;
type ConfigCommand = (typeof CONFIG_COMMANDS)[number];

/** The value of a `--flag <value>` option, or undefined when the flag is absent. */
function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args.at(index + 1);
}

/**
 * Every value of a repeatable `--flag <value>` option, or undefined when the flag
 * is absent. Both spellings are accepted, and they mix freely:
 *
 *     --tier global --tier apps
 *     --tier global,apps
 *
 * A flag with nothing usable after it — the end of the line, or another flag —
 * yields an empty list rather than undefined, so the command refuses it instead of
 * reading `anatomies write --tier --apply` as "every tier" and writing the lot.
 */
function flagValues(args: string[], flag: string): string[] | undefined {
  if (!args.includes(flag)) {
    return undefined;
  }
  const values: string[] = [];
  for (const [index, arg] of args.entries()) {
    const value = arg === flag ? args.at(index + 1) : undefined;
    if (value === undefined || value.startsWith("--")) {
      continue;
    }
    values.push(...value.split(",").map((part) => part.trim()));
  }
  return values.filter((value) => value !== "");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.at(0);

  // `anatomies` takes a subcommand rather than a config path. `validate
  // --write-register` writes `anatomies/census.json` and `anatomies/register.yaml`;
  // `write --apply` and `restore --apply` write to the Coda document, behind their
  // gates. Nothing here writes `data/`.
  if (command === "anatomies") {
    const subcommand = args.at(1);
    if (!subcommand) {
      // One line per line: `console.log` joins its arguments with a space, so a
      // usage block written as one call prints as one run-on line.
      for (const line of [
        "Usage: bun src/cli.ts anatomies <validate|write|restore> [options]",
        "  validate [--write-register] [--only <uri>] [--json]      the law over the corpus",
        "  validate --authored [--tier <name>] [--json]             the law over the authored files, offline",
        "  write [--apply] [--only <uri>] [--tier <name>] [--json]  the authored files into the document",
        "  restore <snapshot> [--apply] [--json]                    a snapshot of those cells, put back",
        "",
        "  --tier takes one tier per occurrence or a comma-separated list, and names a",
        "  directory under anatomies/authored/: --tier global --tier apps,sites",
      ]) {
        console.log(line);
      }
      process.exit(1);
    }
    // The snapshot is positional, so a run with the flag and no path must not read
    // the flag as a filename.
    const positional = args.at(2);
    const result = await anatomies({
      subcommand,
      json: args.includes("--json"),
      writeRegister: args.includes("--write-register"),
      authored: args.includes("--authored"),
      apply: args.includes("--apply"),
      only: flagValue(args, "--only"),
      tiers: flagValues(args, "--tier"),
      snapshot:
        positional === undefined || positional.startsWith("--")
          ? undefined
          : positional,
    });
    console.log(result.output);
    process.exit(result.exitCode);
  }

  // `sync` has a distinct argument shape (<spec.json> [--apply]) and its own
  // gated-write semantics, so it is dispatched before the config-based commands.
  if (command === "sync") {
    const specPath = args.at(1);
    if (!specPath) {
      console.log("Usage: bun src/cli.ts sync <target-spec.json> [--apply]");
      process.exit(1);
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await sync({ specPath, apply: args.includes("--apply"), stamp });
    return;
  }

  if (!command || !args.at(1)) {
    console.log("Usage: bun src/cli.ts <command> <config.json>");
    console.log(`Commands: ${CONFIG_COMMANDS.join(", ")}, sync`);
    process.exit(1);
  }

  if (!(CONFIG_COMMANDS as readonly string[]).includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.log(`Available commands: ${CONFIG_COMMANDS.join(", ")}, sync`);
    process.exit(1);
  }

  const configPath = args.at(1) ?? "";
  const content = await readFile(configPath, "utf-8");
  const config = validateConfig(JSON.parse(content));

  switch (command as ConfigCommand) {
    case "list":
      await list(config);
      break;
    case "extract":
      await extract(config);
      break;
    case "transform":
      await transform(config);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
