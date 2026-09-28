import type { WorkerResponse } from "../types/index.js";

/** Check whether a response matches a request by ID. */
export default function matchResponse(
  response: WorkerResponse,
  requestId: number,
): boolean {
  return response.id === requestId;
}
