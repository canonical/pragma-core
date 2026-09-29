#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type CollectConfig,
  generateLibraryTurtle,
  generateObjectsTurtle,
  scanAnnotations,
  validateCollectConfig,
} from "./collect/index.js";

const CONFIG_FILENAME = "design-system.json";

async function main(): Promise<void> {
  const cwd = process.cwd();
  const configPath = join(cwd, CONFIG_FILENAME);

  // Load and validate config
  let configContent: string;
  try {
    configContent = await readFile(configPath, "utf-8");
  } catch {
    console.error(`Error: ${CONFIG_FILENAME} not found in current directory`);
    console.error(`Expected location: ${configPath}`);
    process.exit(1);
  }

  let config: CollectConfig;
  try {
    config = validateCollectConfig(JSON.parse(configContent));
  } catch (err) {
    console.error(`Error: Invalid ${CONFIG_FILENAME}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log(`Scanning ${config.pattern} for @implements annotations...`);

  // Scan for annotations
  const annotations = await scanAnnotations(config.pattern, cwd);

  if (annotations.length === 0) {
    console.log("No @implements annotations found.");
    console.log("");
    console.log("Add annotations to your component files like:");
    console.log("  // @implements ds:global.component.button");
    console.log("  // @implements ds:global.component.button@1.0.0");
    console.log("  // @implements ds:global.component.button [draft]");
    process.exit(0);
  }

  // Separate valid annotations from those with illegal prefixes
  const validAnnotations = annotations.filter(
    (ann) => ann.prefix === config.prefix.short,
  );
  const illegalAnnotations = annotations.filter(
    (ann) => ann.prefix !== config.prefix.short,
  );

  // Warn about illegal prefixes
  if (illegalAnnotations.length > 0) {
    console.warn(
      `\nWarning: Found ${illegalAnnotations.length} annotation(s) with illegal prefix (expected "${config.prefix.short}"):`,
    );
    for (const ann of illegalAnnotations) {
      const relativePath = ann.filePath.replace(`${cwd}/`, "");
      console.warn(`  - ${relativePath}: ${ann.blockUri}`);
    }
    console.warn(
      "These annotations will be skipped. Please update them to use the correct prefix.\n",
    );
  }

  console.log(`Found ${validAnnotations.length} valid implementation(s):`);
  for (const ann of validAnnotations) {
    const status = ann.isDraft ? " [draft]" : "";
    const version = ann.version ? `@${ann.version}` : "";
    console.log(`  - ${ann.blockUri}${version}${status}`);
  }

  // Use only valid annotations for generation
  const annotations_to_use = validAnnotations;

  // Generate Turtle files
  const outputDir = join(cwd, config.outputDir || "data");
  await mkdir(outputDir, { recursive: true });

  // Generate library TTL
  const libraryTtl = await generateLibraryTurtle(config);
  const libraryPath = join(outputDir, "implementationLibrary.ttl");
  await writeFile(libraryPath, libraryTtl, "utf-8");
  console.log(`Written: ${libraryPath}`);

  // Generate objects TTL
  const objectsTtl = await generateObjectsTurtle(
    config,
    annotations_to_use,
    cwd,
  );
  if (objectsTtl) {
    const objectsPath = join(outputDir, "implementationObjects.ttl");
    await writeFile(objectsPath, objectsTtl, "utf-8");
    console.log(`Written: ${objectsPath}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
