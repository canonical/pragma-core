/**
 * @note impure — reads process.pid, accesses process.version, creates graph worker.
 */
import { parseFileUri } from "../../css/index.js";
import { VERSION } from "../../version.js";
import createGraphWorker from "../createGraphWorker.js";
import getServerCapabilities from "../getServerCapabilities.js";
import handleWorkerResponse from "./handleWorkerResponse.js";
import { LogMessageType } from "./LogMessageType.js";
import type {
  ForwardedWorkerRequest,
  LspMessage,
  LspServerState,
  LspTransport,
  WithoutId,
} from "./types.js";

export default async function routeLspRequest(
  state: LspServerState,
  message: LspMessage,
  transport: LspTransport,
): Promise<void> {
  const { id, method, params } = message;

  if (method === "initialize") {
    const rootDir = resolveRootDir(state.fallbackRootDir, params);
    const debug = isVerbose(params)
      ? (entry: string) =>
          transport.sendNotification("window/logMessage", {
            type: LogMessageType.Info,
            message: entry,
          })
      : () => {};

    state.worker = createGraphWorker({
      allowDegraded: state.allowDegraded,
      debug,
      log: (entry: string) =>
        transport.sendNotification("window/logMessage", {
          type: LogMessageType.Info,
          message: entry,
        }),
      postMessage: (response) =>
        handleWorkerResponse(response, state.pendingRequests, transport),
      rootDir,
    });
    state.initialized = true;
    transport.sendResponse(id, {
      capabilities: getServerCapabilities(state.allowDegraded),
      serverInfo: { name: "terrazzo-lsp", version: VERSION },
    });
    return;
  }

  if (method === "initialized") return;

  if (method === "shutdown") {
    state.shutdownRequested = true;
    transport.sendResponse(id, null);
    return;
  }

  if (method === "exit") {
    process.exit(state.shutdownRequested ? 0 : 1);
  }

  if (!state.initialized || !state.worker || !method) return;

  switch (method) {
    case "textDocument/completion":
      await dispatchRequest(state, id, method, {
        type: "COMPLETION",
        uri: readDocumentUri(params),
        position: readPosition(params),
      });
      return;
    case "textDocument/hover":
      await dispatchRequest(state, id, method, {
        type: "HOVER",
        uri: readDocumentUri(params),
        position: readPosition(params),
      });
      return;
    case "textDocument/definition":
      await dispatchRequest(state, id, method, {
        type: "DEFINITION",
        uri: readDocumentUri(params),
        position: readPosition(params),
      });
      return;
    case "textDocument/references":
      await dispatchRequest(state, id, method, {
        type: "REFERENCES",
        uri: readDocumentUri(params),
        position: readPosition(params),
      });
      return;
    case "textDocument/rename":
      await dispatchRequest(state, id, method, {
        type: "RENAME",
        uri: readDocumentUri(params),
        position: readPosition(params),
        newName: (params?.newName as string) ?? "",
      });
      return;
    case "textDocument/semanticTokens/full":
      await dispatchRequest(state, id, method, {
        type: "SEMANTIC_TOKENS",
        uri: readDocumentUri(params),
      });
      return;
    case "workspace/symbol":
      await dispatchRequest(state, id, method, {
        type: "WORKSPACE_SYMBOL",
        query: (params?.query as string) ?? "",
      });
      return;
    case "textDocument/documentColor":
      await dispatchRequest(state, id, method, {
        type: "DOCUMENT_COLOR",
        uri: readDocumentUri(params),
      });
      return;
    case "textDocument/colorPresentation":
      transport.sendResponse(id, [{ label: "var()" }]);
      return;
    case "textDocument/prepareRename":
      await dispatchRequest(state, id, method, {
        type: "PREPARE_RENAME",
        uri: readDocumentUri(params),
        position: readPosition(params),
      });
      return;
    case "textDocument/documentLink":
      await dispatchRequest(state, id, method, {
        type: "DOCUMENT_LINK",
        uri: readDocumentUri(params),
      });
      return;
    case "textDocument/inlayHint":
      await dispatchRequest(state, id, method, {
        type: "INLAY_HINT",
        uri: readDocumentUri(params),
        range: (params?.range as {
          start: { line: number; character: number };
          end: { line: number; character: number };
        }) ?? {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      });
      return;
    case "textDocument/codeAction": {
      const context = params?.context as
        | { diagnostics?: unknown[] }
        | undefined;
      // LSP guarantees diagnostics shape; we trust the client payload here
      const diagnostics =
        (context?.diagnostics as
          | import("../../types/index.js").Diagnostic[]
          | undefined) ?? [];
      await dispatchRequest(state, id, method, {
        type: "CODE_ACTION",
        uri: readDocumentUri(params),
        diagnostics,
      });
      return;
    }
    case "completionItem/resolve": {
      const data = params?.data as { uri?: string } | undefined;
      const item: import("../../types/index.js").CompletionItem = {
        label: (params?.label as string) ?? "",
        kind: (params?.kind as number) ?? 6,
        ...(params?.detail ? { detail: params.detail as string } : {}),
        ...(params?.documentation
          ? {
              documentation:
                params.documentation as import("../../types/index.js").MarkupContent,
            }
          : {}),
      };
      await dispatchRequest(state, id, method, {
        type: "COMPLETION_RESOLVE",
        uri: data?.uri ?? "",
        item,
      });
      return;
    }
    case "textDocument/didOpen": {
      const textDocument = params?.textDocument as
        | { uri: string; text: string }
        | undefined;
      if (!textDocument) return;
      await dispatchRequest(state, id, method, {
        type: "OPEN_DOC",
        uri: textDocument.uri,
        text: textDocument.text,
      });
      return;
    }
    case "textDocument/didChange": {
      const changeParams = params as
        | {
            textDocument: { uri: string };
            contentChanges: Array<{ text: string }>;
          }
        | undefined;
      if (!changeParams) return;
      await dispatchRequest(state, id, method, {
        type: "CHANGE_DOC",
        uri: changeParams.textDocument.uri,
        changes: changeParams.contentChanges,
      });
      return;
    }
    case "workspace/didChangeWatchedFiles": {
      const watched = params as
        | { changes?: Array<{ uri?: string }> }
        | undefined;
      // `changes` is externally supplied: a truthy non-array would reach the
      // loop below and throw rather than be ignored.
      if (!Array.isArray(watched?.changes)) return;
      // The client watches the built artifact and nothing else — the
      // extension registers `**/tokens.json` as its only
      // `synchronize.fileEvents` watcher — so every change arriving here is
      // an artifact change. Widening that glob would need an
      // artifact-versus-source split, which only the worker can make: the
      // resolved `artifactPaths` live in its config, not in this state.
      for (const change of watched.changes) {
        const path = toFilePath(change.uri);
        if (!path) continue;
        await dispatchRequest(state, id, method, {
          type: "ARTIFACT_CHANGED",
          path,
          uri: change.uri as string,
        });
      }
      return;
    }
    case "textDocument/didClose": {
      const textDocument = params?.textDocument as { uri: string } | undefined;
      if (!textDocument) return;
      await state.worker.handleRequest({
        id: nextRequestId(state),
        type: "CLOSE_DOC",
        uri: textDocument.uri,
      });
      return;
    }
  }
}

/**
 * Convert a watched-file URI to a filesystem path, or undefined when it is
 * not one. A client may report a change under a non-file scheme, and a throw
 * here would take down the whole notification rather than skip one entry.
 */
function toFilePath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    return parseFileUri(uri);
  } catch {
    return undefined;
  }
}

/**
 * Worker request types that correspond to LSP *notifications* (didOpen /
 * didChange). They produce a publishDiagnostics notification rather than an
 * id-correlated response, so they must not be registered in `pendingRequests`
 * (doing so leaks an entry whenever a debounced diagnostics pass is superseded).
 */
const NOTIFICATION_REQUESTS: ReadonlySet<string> = new Set([
  "OPEN_DOC",
  "CHANGE_DOC",
  "ARTIFACT_CHANGED",
]);

async function dispatchRequest(
  state: LspServerState,
  id: string | number | undefined,
  method: string,
  request: WithoutId<ForwardedWorkerRequest>,
): Promise<void> {
  const worker = state.worker;
  if (!worker) return;

  const workerId = nextRequestId(state);
  const isNotification = NOTIFICATION_REQUESTS.has(request.type);
  if (!isNotification) {
    state.pendingRequests.set(workerId, { id: id ?? workerId, method });
  }
  try {
    await worker.handleRequest({
      id: workerId,
      ...request,
    } as ForwardedWorkerRequest);
  } catch (error) {
    // A throwing handler must not leak the correlation entry. Drop it and
    // rethrow so the top-level handler can answer the client (avoiding a hang).
    state.pendingRequests.delete(workerId);
    throw error;
  }
}

function isVerbose(params: Record<string, unknown> | undefined): boolean {
  const initializationOptions = params?.initializationOptions as
    | Record<string, unknown>
    | undefined;
  return (
    initializationOptions?.verbose === true ||
    process.env.TERRAZZO_LSP_DEBUG === "1"
  );
}

function nextRequestId(state: LspServerState): number {
  state.requestSeq += 1;
  return state.requestSeq;
}

function readDocumentUri(params: Record<string, unknown> | undefined): string {
  return (params?.textDocument as { uri: string } | undefined)?.uri ?? "";
}

function readPosition(params: Record<string, unknown> | undefined): {
  line: number;
  character: number;
} {
  return (
    (params?.position as { line: number; character: number } | undefined) ?? {
      line: 0,
      character: 0,
    }
  );
}

function resolveRootDir(
  fallbackRootDir: string,
  params: Record<string, unknown> | undefined,
): string {
  const rootUri = params?.rootUri as string | undefined;
  const rootPath = params?.rootPath as string | undefined;
  if (rootUri) {
    return rootUri.startsWith("file://")
      ? decodeURIComponent(rootUri.slice(7))
      : rootUri;
  }
  return rootPath ?? fallbackRootDir;
}
