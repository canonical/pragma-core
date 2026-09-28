/**
 * VS Code extension for Terrazzo LSP.
 *
 * Activates the language server on CSS/SCSS files and provides
 * completions, hover, diagnostics, and go-to-definition.
 *
 * The extension spawns the LSP server as a child process (via the
 * detected runtime — bun or node >= 22) and communicates over stdio.
 * It registers a {@link LanguageClient} scoped to CSS and SCSS
 * document selectors and watches tokens.json for workspace-level
 * token changes.
 *
 * @note This module is impure — it creates child processes and
 * registers VS Code disposables.
 */
import * as path from "node:path";
import detectRuntime from "@canonical/terrazzo-lsp/runtime/detectRuntime";
import type { ExtensionContext, LogOutputChannel } from "vscode";
import { window, workspace } from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/** Activate the extension. */
export async function activate(context: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration("terrazzo-lsp");
  const customServerPath = config.get<string>("serverPath", "");
  const runtimeOverride = config.get<string>("runtime", "");
  // `{ log: true }` yields a LogOutputChannel. vscode-languageclient >= 10
  // logs through `.error()`/`.warn()`/`.info()` and subscribes to
  // `.onDidChangeLogLevel()`, none of which exist on a plain OutputChannel.
  const outputChannel: LogOutputChannel = window.createOutputChannel(
    "Terrazzo LSP",
    { log: true },
  );
  context.subscriptions.push(outputChannel);

  const runtime = await detectRuntime(runtimeOverride);
  if (!runtime) {
    window.showErrorMessage(
      "Terrazzo LSP requires bun or node >= 22. Install one of them, or set terrazzo-lsp.runtime to an explicit runtime.",
    );
    return;
  }

  const serverScript = customServerPath
    ? path.resolve(
        workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
        customServerPath,
      )
    : context.asAbsolutePath(path.join("dist", "esm", "cli.js"));

  const serverOptions: ServerOptions = {
    run: {
      command: runtime,
      args: [serverScript, "--stdio"],
    },
    debug: {
      command: runtime,
      args: [serverScript, "--stdio"],
    },
  };

  const traceLevel = config.get<string>("trace.server", "off");

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "css" },
      { scheme: "file", language: "scss" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/tokens.json"),
    },
    initializationOptions: {
      verbose: traceLevel === "verbose",
    },
    outputChannel,
  };

  client = new LanguageClient(
    "terrazzo-lsp",
    "Terrazzo LSP",
    serverOptions,
    clientOptions,
  );

  try {
    await client.start();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(
      `[terrazzo-lsp] Failed to start language server: ${detail}`,
    );
    window.showErrorMessage(`Terrazzo LSP failed to start: ${detail}`);
    // Avoid leaving an orphaned server child process behind on a failed start.
    await client.stop().catch(() => {});
    client = undefined;
    return;
  }
  context.subscriptions.push({ dispose: () => client?.stop() });
}

/** Deactivate the extension. */
export function deactivate(): Promise<void> | undefined {
  return client?.stop();
}
