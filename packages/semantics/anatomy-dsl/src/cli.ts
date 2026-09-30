#!/usr/bin/env node
import { runCheck } from "./check/index.js";

process.exitCode = await runCheck(process.argv.slice(2), console);
