#!/usr/bin/env bun
/**
 * Code standards scripts entry point.
 * Routes to specific scripts based on command.
 */

const command = process.argv[2];

switch (command) {
  case "docs":
  case "generate-docs":
    await import("./generate-docs.js");
    break;
  default:
    console.log("Usage: bun src/scripts/index.ts <command>");
    console.log("");
    console.log("Commands:");
    console.log(
      "  docs [output-dir]  Generate markdown docs (default: ./docs)",
    );
}
