/**
 * PROTECTED — MCP plan-first + confirm parity for `create`:
 * a tool call WITHOUT `confirm` returns a plan (`planOnly`/`confirmRequired`)
 * and writes nothing; WITH `confirm: true` it runs for real. The plan mirrors
 * the CLI `--dry-run` preview (both filter out Prompt effects).
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { asPragmaError } from "../../kernel/error/fromTaskError.js";
import { executeVerb } from "../../kernel/project/cli/dispatch.js";
import { mapExitCode } from "../../kernel/project/cli/exitCodes.js";
import { bootRuntime } from "../../kernel/runtime/boot.js";
import type { GlobalFlags } from "../../kernel/runtime/types.js";
import type { VerbSpec } from "../../kernel/spec/types.js";
import { projectMcp } from "../../testing/helpers/projectMcp.js";
import { createVerbs } from "./create.verb.js";
import { createModule } from "./index.js";

const FLAGS: GlobalFlags = {
  llm: false,
  autoLlm: false,
  format: "plain",
  verbose: false,
};
const freshCwd = (): string =>
  mkdtempSync(join(tmpdir(), "pragma-create-mcp-"));

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

describe("create over MCP (PROTECTED)", () => {
  it("exposes create_component as mutating but NON-destructive", async () => {
    const dir = freshCwd();
    const mcp = await projectMcp([createModule], dir);
    cleanup = mcp.cleanup;
    const tools = await mcp.listTools();
    const component = tools.find((t) => t.name === "create_component");
    expect(component).toBeDefined();
    expect(component?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
    // Explicit: create only writes NEW files. An unset destructiveHint on a
    // non-read-only tool defaults to `true`, so it must be emitted as false —
    // agents otherwise treat scaffolding as a destructive operation (D4).
    expect(component?.annotations?.destructiveHint).toBe(false);
  });

  it("schemas DERIVE from the prompts: framework is a required enum with no default; application args are the bare prompt names (L-CIS)", async () => {
    const dir = freshCwd();
    const mcp = await projectMcp([createModule], dir);
    cleanup = mcp.cleanup;
    const tools = await mcp.listTools();

    const component = tools.find((t) => t.name === "create_component");
    const componentSchema = component?.inputSchema as {
      properties?: Record<string, { enum?: string[]; default?: unknown }>;
      required?: string[];
    };
    // The framework enum derives from the tree segments — REQUIRED, no default.
    expect(componentSchema.properties?.framework?.enum).toEqual([
      "react",
      "svelte",
      "lit",
    ]);
    expect(componentSchema.properties?.framework?.default).toBeUndefined();
    expect(componentSchema.required ?? []).toContain("framework");
    // The svelte-only prompt joins the union.
    expect(Object.keys(componentSchema.properties ?? {})).toContain(
      "useTsStories",
    );

    const application = tools.find((t) => t.name === "create_application");
    const applicationSchema = application?.inputSchema as {
      properties?: Record<string, unknown>;
    };
    const names = Object.keys(applicationSchema.properties ?? {});
    // The B8 --with-X aliases are gone: prompt names ARE the arg names — and
    // ssr/router are gone WITH their prompts (always-on facts, not questions).
    expect(names).toEqual(
      expect.arrayContaining(["appPath", "forms", "relay", "runInstall"]),
    );
    expect(names).not.toContain("withSsr");
    expect(names).not.toContain("withRelay");
    expect(names).not.toContain("ssr");
    expect(names).not.toContain("router");
    expect(applicationSchema.properties?.framework).toMatchObject({
      enum: ["react", "svelte"],
      default: "react",
    });
    expect(applicationSchema.properties?.svelteForm).toBeUndefined();
    expect(applicationSchema.properties?.graphql).toBeUndefined();
  });

  it("plans and creates Svelte apps, defaults to React, and rejects Svelte Relay", async () => {
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const args = {
        framework: "svelte",
        appPath: "svelte-app",
        runInstall: false,
      };
      const plan = await mcp.callTool("create_application", args);
      expect(plan.ok).toBe(true);
      expect(JSON.stringify(plan)).toContain("+page.svelte");
      expect(existsSync(join(dir, "svelte-app"))).toBe(false);
      const applied = await mcp.callTool("create_application", {
        ...args,
        confirm: true,
      });
      expect(applied.ok).toBe(true);
      expect(
        existsSync(
          join(dir, "svelte-app/src/routes/(top-bar)/(public)/+page.svelte"),
        ),
      ).toBe(true);
      mkdirSync(join(dir, "src/routes/invoices"), { recursive: true });
      writeFileSync(
        join(dir, "src/routes/invoices/+page.svelte"),
        "<h1>Invoices</h1>",
      );
      const sveltePage = await mcp.callTool("create_page", {
        framework: "svelte",
        pagePath: "invoices/detail",
        confirm: true,
      });
      expect(sveltePage.ok).toBe(true);
      expect(
        existsSync(join(dir, "src/routes/invoices/detail/+page.svelte")),
      ).toBe(true);
      const rejected = await mcp.callTool("create_application", {
        ...args,
        appPath: "invalid",
        relay: true,
        confirm: true,
      });
      expect(rejected.ok).toBe(false);
      expect(JSON.stringify(rejected)).toContain(
        "Relay is not supported for Svelte",
      );
      expect(existsSync(join(dir, "invalid"))).toBe(false);
      const react = await mcp.callTool("create_application", {
        appPath: "react-app",
        runInstall: false,
        confirm: true,
      });
      expect(react.ok).toBe(true);
      expect(existsSync(join(dir, "react-app/src/routes.tsx"))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it("plan-first: no confirm → a plan, no files written", async () => {
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const result = await mcp.callTool("create_component", {
        framework: "react",
        componentPath: "src/components/Button",
      });
      expect(result.ok).toBe(true);
      expect(result.meta).toMatchObject({
        planOnly: true,
        confirmRequired: true,
      });
      const plan = (result.data as { plan: string[] }).plan;
      expect(plan.some((line) => line.includes("Button.tsx"))).toBe(true);
      expect(plan.some((line) => line.includes("Prompt"))).toBe(false);
      expect(readdirSync(dir)).toEqual([]); // nothing written
    } finally {
      process.chdir(prev);
    }
  });

  it("the plan payload is the FILTERED plan, not the interpreter transcript", async () => {
    // This payload is read by an LLM on a token budget. Every internal probe
    // and every repeat of the output directory spent tokens burying the real
    // artifacts, so the rows pass the shared `visiblePlanEffects` filter — the
    // same one the CLI preview applies — and stay `describeEffect` strings,
    // which is what makes them comparable to the CLI's own `--format json`
    // plan rather than to its terminal rendering.
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const result = await mcp.callTool("create_component", {
        framework: "react",
        componentPath: "Button",
        withStyles: false,
        withStories: false,
        withSsrTests: false,
      });
      const plan = (result.data as { plan: string[] }).plan;
      const body = plan.join("\n");
      // The interpreter's own bookkeeping is gone: no existence probes, and
      // no debug commentary (this run is not verbose).
      expect(body).not.toContain("Check exists:");
      expect(body).not.toContain("Log [debug]");
      // The output directory is planned ONCE, however many files it holds.
      expect(plan.filter((line) => line.startsWith("Created "))).toEqual([
        "Created Button/",
      ]);
      // What the generator meant to say survives; what it whispered does not.
      expect(plan.at(-1)).toContain("Log [info]: ");
      expect(readdirSync(dir)).toEqual([]); // nothing written
    } finally {
      process.chdir(prev);
    }
  });

  it("confirm: true → runs for real and writes files", async () => {
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const result = await mcp.callTool("create_component", {
        framework: "react",
        componentPath: "src/components/Button",
        withStyles: false,
        withStories: false,
        withSsrTests: false,
        confirm: true,
      });
      expect(result.ok).toBe(true);
      expect(existsSync(join(dir, "src/components/Button/Button.tsx"))).toBe(
        true,
      );
    } finally {
      process.chdir(prev);
    }
  });

  it("the MCP plan matches the CLI --dry-run preview", async () => {
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const mcpResult = await mcp.callTool("create_component", {
        framework: "react",
        componentPath: "src/components/Button",
        withStyles: false,
        withStories: false,
        withSsrTests: false,
      });
      const mcpPlan = (mcpResult.data as { plan: string[] }).plan;

      const cliOutcome = await executeVerb(
        createVerbs.component as VerbSpec,
        {
          framework: "react",
          componentPath: "src/components/Button",
          withStyles: false,
          withStories: false,
          withSsrTests: false,
        },
        { dryRun: true, undo: false, yes: false },
        bootRuntime({ ...FLAGS, format: "json" }, dir),
      );
      // The two STRUCTURED surfaces carry one plan, string for string. They
      // are compared against each other rather than against the terminal
      // rendering, which is deliberately a different shape: a person reads
      // kind-columned rows, a machine reads the described effects.
      const cliPlan = (
        JSON.parse(cliOutcome.stdout as string) as {
          data: { plan: string[] };
        }
      ).data.plan;
      expect(mcpPlan).toEqual(cliPlan);
    } finally {
      process.chdir(prev);
    }
  });
});

describe("create page (PROTECTED)", () => {
  it("rejects a Svelte route symlink escaping the workspace", async () => {
    const dir = freshCwd();
    const outside = freshCwd();
    mkdirSync(join(dir, "src/routes"), { recursive: true });
    writeFileSync(join(outside, "+page.svelte"), "<h1>Outside</h1>");
    symlinkSync(outside, join(dir, "src/routes/invoices"));
    const mcp = await projectMcp([createModule], dir);
    cleanup = mcp.cleanup;
    const result = await mcp.callTool("create_page", {
      framework: "svelte",
      pagePath: "invoices/detail",
      confirm: true,
    });
    expect(result.ok).toBe(false);
    expect(existsSync(join(outside, "detail/+page.svelte"))).toBe(false);
  });
  /** A scratch application holding the `invoices` domain a page is added to. */
  const appWithDomain = (): string => {
    const dir = freshCwd();
    mkdirSync(join(dir, "src/domains/invoices"), { recursive: true });
    writeFileSync(
      join(dir, "src/domains/invoices/routes.ts"),
      "export default {};\n",
    );
    return dir;
  };
  const pageFile = (dir: string) =>
    join(dir, "src/domains/invoices/DetailPage.tsx");

  it("MCP plan-first: a plan naming the page and the routing guide, nothing written; confirm: true writes it", async () => {
    const dir = appWithDomain();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;

      const planned = await mcp.callTool("create_page", {
        pagePath: "invoices/detail",
      });
      expect(planned.ok).toBe(true);
      expect(planned.meta).toMatchObject({
        planOnly: true,
        confirmRequired: true,
      });
      const plan = (planned.data as { plan: string[] }).plan;
      expect(plan.some((line) => line.includes("DetailPage.tsx"))).toBe(true);
      expect(plan.at(-1)).toContain(
        'import DetailPage from "./DetailPage.js";',
      );
      expect(existsSync(pageFile(dir))).toBe(false);

      const applied = await mcp.callTool("create_page", {
        pagePath: "invoices/detail",
        confirm: true,
      });
      expect(applied.ok).toBe(true);
      expect(readFileSync(pageFile(dir), "utf8")).toContain(
        "export default function DetailPage(): ReactElement {",
      );
      expect(
        readFileSync(join(dir, "src/domains/invoices/routes.ts"), "utf8"),
      ).toBe("export default {};\n");
    } finally {
      process.chdir(prev);
    }
  });

  it("the MCP plan matches the CLI --dry-run preview", async () => {
    const dir = appWithDomain();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const mcpResult = await mcp.callTool("create_page", {
        pagePath: "invoices/detail",
      });
      const cliOutcome = await executeVerb(
        createVerbs.page as VerbSpec,
        { pagePath: "invoices/detail" },
        { dryRun: true, undo: false, yes: false },
        bootRuntime({ ...FLAGS, format: "json" }, dir),
      );
      const cliPlan = (
        JSON.parse(cliOutcome.stdout as string) as {
          data: { plan: string[] };
        }
      ).data.plan;
      expect((mcpResult.data as { plan: string[] }).plan).toEqual(cliPlan);
    } finally {
      process.chdir(prev);
    }
  });

  it("CLI: --yes writes the page, --undo deletes it and nothing else", async () => {
    const dir = appWithDomain();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const run = (undo: boolean) =>
        executeVerb(
          createVerbs.page as VerbSpec,
          { pagePath: "invoices/detail" },
          { dryRun: false, undo, yes: true },
          bootRuntime(FLAGS, dir),
        );
      expect((await run(false)).exitCode).toBe(0);
      expect(existsSync(pageFile(dir))).toBe(true);
      expect((await run(true)).exitCode).toBe(0);
      expect(existsSync(pageFile(dir))).toBe(false);
      expect(
        readFileSync(join(dir, "src/domains/invoices/routes.ts"), "utf8"),
      ).toBe("export default {};\n");
    } finally {
      process.chdir(prev);
    }
  });

  it("CLI: a missing domain or a taken page name is INVALID_INPUT, exit 2", async () => {
    // What the CLI boundary makes of the run's failure: its error and exit.
    const refusal = async (dir: string) => {
      try {
        await executeVerb(
          createVerbs.page as VerbSpec,
          { pagePath: "invoices/detail" },
          { dryRun: false, undo: false, yes: true },
          bootRuntime(FLAGS, dir),
        );
      } catch (error) {
        const pragma = asPragmaError(error);
        return { pragma, exit: mapExitCode(pragma.code) };
      }
      throw new Error("the run did not refuse");
    };
    const prev = process.cwd();
    try {
      const empty = freshCwd();
      process.chdir(empty);
      const missing = await refusal(empty);
      expect(missing.pragma.code).toBe("INVALID_INPUT");
      expect(missing.exit).toBe(2);
      expect(missing.pragma.message).toContain('Domain "invoices" not found');
      expect(readdirSync(empty)).toEqual([]);

      const dir = appWithDomain();
      process.chdir(dir);
      writeFileSync(pageFile(dir), "hand-written\n");
      const taken = await refusal(dir);
      expect(taken.pragma.code).toBe("INVALID_INPUT");
      expect(taken.exit).toBe(2);
      expect(taken.pragma.message).toContain("already exists");
      expect(readFileSync(pageFile(dir), "utf8")).toBe("hand-written\n");
    } finally {
      process.chdir(prev);
    }
  });

  it("refuses when the domain does not exist, writing nothing", async () => {
    const dir = freshCwd();
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const mcp = await projectMcp([createModule], dir);
      cleanup = mcp.cleanup;
      const result = await mcp.callTool("create_page", {
        pagePath: "invoices/detail",
        confirm: true,
      });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).toContain("Create the domain first.");
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      process.chdir(prev);
    }
  });
});
