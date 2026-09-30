#!/usr/bin/env node
import { run } from "./check.js";

process.exitCode = await run(process.argv.slice(2), console);
