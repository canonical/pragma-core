import { describe, expect, it } from "vitest";
import type { WorkerRequest } from "../types/index.js";
import {
  isCompletionRequest,
  isDefinitionRequest,
  isDiagnosticsRequest,
  isHoverRequest,
  isReferencesRequest,
} from "./typeGuards.js";

describe("request type guards", () => {
  const completionReq: WorkerRequest = {
    id: 1,
    type: "COMPLETION",
    uri: "file:///a.css",
    position: { line: 0, character: 5 },
  };

  const hoverReq: WorkerRequest = {
    id: 2,
    type: "HOVER",
    uri: "file:///a.css",
    position: { line: 0, character: 5 },
  };

  const defReq: WorkerRequest = {
    id: 3,
    type: "DEFINITION",
    uri: "file:///a.css",
    position: { line: 0, character: 5 },
  };

  const diagReq: WorkerRequest = {
    id: 4,
    type: "DIAGNOSTICS",
    uri: "file:///a.css",
    text: ".button { color: var(--x); }",
  };

  const referencesReq: WorkerRequest = {
    id: 5,
    type: "REFERENCES",
    uri: "file:///a.css",
    position: { line: 0, character: 5 },
  };

  it("isCompletionRequest identifies COMPLETION", () => {
    expect(isCompletionRequest(completionReq)).toBe(true);
    expect(isCompletionRequest(hoverReq)).toBe(false);
  });

  it("isHoverRequest identifies HOVER", () => {
    expect(isHoverRequest(hoverReq)).toBe(true);
    expect(isHoverRequest(completionReq)).toBe(false);
  });

  it("isDefinitionRequest identifies DEFINITION", () => {
    expect(isDefinitionRequest(defReq)).toBe(true);
    expect(isDefinitionRequest(hoverReq)).toBe(false);
  });

  it("isDiagnosticsRequest identifies DIAGNOSTICS", () => {
    expect(isDiagnosticsRequest(diagReq)).toBe(true);
    expect(isDiagnosticsRequest(hoverReq)).toBe(false);
  });

  it("isReferencesRequest identifies REFERENCES", () => {
    expect(isReferencesRequest(referencesReq)).toBe(true);
    expect(isReferencesRequest(hoverReq)).toBe(false);
  });
});
