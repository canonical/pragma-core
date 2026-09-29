import { describe, expect, it } from "vitest";
import createRequest from "./createRequest.js";

describe("createRequest", () => {
  it("creates a COMPLETION request with incrementing ID", () => {
    const r1 = createRequest("COMPLETION", {
      uri: "file:///a.css",
      position: { line: 0, character: 5 },
    });
    const r2 = createRequest("COMPLETION", {
      uri: "file:///b.css",
      position: { line: 1, character: 10 },
    });

    expect(r1.type).toBe("COMPLETION");
    expect(r1.uri).toBe("file:///a.css");
    expect(r2.id).toBeGreaterThan(r1.id);
  });

  it("creates a HOVER request", () => {
    const req = createRequest("HOVER", {
      uri: "file:///a.css",
      position: { line: 3, character: 15 },
    });
    expect(req.type).toBe("HOVER");
    expect(req.position.line).toBe(3);
  });

  it("creates a DIAGNOSTICS request", () => {
    const req = createRequest("DIAGNOSTICS", {
      uri: "file:///a.css",
      text: "body { }",
    });
    expect(req.type).toBe("DIAGNOSTICS");
    expect(req.text).toBe("body { }");
  });

  it("creates an OPEN_DOC request", () => {
    const req = createRequest("OPEN_DOC", {
      uri: "file:///a.css",
      text: "body { }",
    });
    expect(req.type).toBe("OPEN_DOC");
  });

  it("creates a FILE_CHANGED request", () => {
    const req = createRequest("FILE_CHANGED", {
      uri: "file:///a.css",
    });
    expect(req.type).toBe("FILE_CHANGED");
  });
});
