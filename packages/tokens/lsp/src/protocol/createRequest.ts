import type { Position, WorkerRequest } from "../types/index.js";

let nextId = 1;

type RequestParams = {
  COMPLETION: { uri: string; position: Position };
  HOVER: { uri: string; position: Position };
  DEFINITION: { uri: string; position: Position };
  DIAGNOSTICS: { uri: string; text: string };
  REFERENCES: { uri: string; position: Position };
  OPEN_DOC: { uri: string; text: string };
  CHANGE_DOC: { uri: string; changes: Array<{ text: string }> };
  CLOSE_DOC: { uri: string };
  FILE_CHANGED: { uri: string };
  ARTIFACT_CHANGED: { path: string };
};

/**
 * Create a typed worker request with an auto-incrementing ID.
 * @note impure: increments the in-memory request id counter.
 */
export default function createRequest<T extends keyof RequestParams>(
  type: T,
  params: RequestParams[T],
): WorkerRequest & { type: T } {
  const id = nextId++;
  return { id, type, ...params } as WorkerRequest & { type: T };
}
