import type { WorkerRequest } from "../types/index.js";

export function isCompletionRequest(
  req: WorkerRequest,
): req is WorkerRequest & { type: "COMPLETION" } {
  return req.type === "COMPLETION";
}

export function isDefinitionRequest(
  req: WorkerRequest,
): req is WorkerRequest & { type: "DEFINITION" } {
  return req.type === "DEFINITION";
}

export function isDiagnosticsRequest(
  req: WorkerRequest,
): req is WorkerRequest & { type: "DIAGNOSTICS" } {
  return req.type === "DIAGNOSTICS";
}

export function isHoverRequest(
  req: WorkerRequest,
): req is WorkerRequest & { type: "HOVER" } {
  return req.type === "HOVER";
}

export function isReferencesRequest(
  req: WorkerRequest,
): req is WorkerRequest & { type: "REFERENCES" } {
  return req.type === "REFERENCES";
}
