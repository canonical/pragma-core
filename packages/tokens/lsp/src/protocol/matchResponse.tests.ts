import { describe, expect, it } from "vitest";
import type { WorkerResponse } from "../types/index.js";
import matchResponse from "./matchResponse.js";

describe("matchResponse", () => {
  it("matches response to request by ID", () => {
    const response: WorkerResponse = {
      id: 42,
      type: "COMPLETION_RESULT",
      items: [],
    };
    expect(matchResponse(response, 42)).toBe(true);
    expect(matchResponse(response, 99)).toBe(false);
  });
});
