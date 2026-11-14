#!/usr/bin/env bun
/** Writes the docs: `bun src/scripts/generate-docs.ts [output-dir] [data-dir]`. */

import { fileURLToPath } from "node:url";
import generateDocs from "./generateDocs.js";

generateDocs({
  outputDir: process.argv.at(2) || "./docs",
  dataDir:
    process.argv.at(3) || fileURLToPath(new URL("../../data", import.meta.url)),
  log: console.log,
});
