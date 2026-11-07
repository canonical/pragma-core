#!/usr/bin/env bun
/** Writes the docs: `bun src/scripts/generate-docs.ts [output-dir] [data-dir]`. */

import { join } from "node:path";
import generateDocs from "./generateDocs.js";

generateDocs({
  outputDir: process.argv.at(2) || "./docs",
  dataDir: process.argv.at(3) || join(import.meta.dir, "../../data"),
  log: console.log,
});
