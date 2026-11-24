import { afterEach, describe, expect, it } from "vitest";
import createTestStore from "../../testing/createTestStore.js";
import type { TestStoreResult } from "../../testing/types.js";
import createSparqlHandler from "./createSparqlHandler.js";

/** A handler response body parsed from JSON: either a query result or an error. */
type SparqlResponse =
  | { type: "select"; bindings: Array<{ [k: string]: string }> }
  | { type: "ask"; result: boolean }
  | { error: string };

/** Parse a handler response's JSON body with its response shape typed. */
async function readBody(response: Response): Promise<SparqlResponse> {
  return (await response.json()) as SparqlResponse;
}

/** Narrow a parsed body to a SELECT result, failing the test otherwise. */
function expectSelect(body: SparqlResponse): {
  type: "select";
  bindings: Array<{ [k: string]: string }>;
} {
  if (!("type" in body) || body.type !== "select") {
    throw new Error("expected a SELECT result body");
  }
  return body;
}

/** Narrow a parsed body to an ASK result, failing the test otherwise. */
function expectAsk(body: SparqlResponse): { type: "ask"; result: boolean } {
  if (!("type" in body) || body.type !== "ask") {
    throw new Error("expected an ASK result body");
  }
  return body;
}

/** Narrow a parsed body to an error payload, failing the test otherwise. */
function expectError(body: SparqlResponse): { error: string } {
  if ("error" in body) {
    return body;
  }
  throw new Error("expected an error body");
}

describe("createSparqlHandler", () => {
  let testResult: TestStoreResult | undefined;

  afterEach(() => {
    testResult?.cleanup();
    testResult = undefined;
  });

  it("handles GET with query parameter", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request(
      "http://localhost/sparql?query=SELECT%20%3Fname%20WHERE%20%7B%20%3Fs%20%3Chttp%3A%2F%2Fschema.org%2Fname%3E%20%3Fname%20%7D",
    );
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await readBody(response);
    const select = expectSelect(body);
    expect(select.bindings.length).toBeGreaterThan(0);
  });

  it("handles POST with application/sparql-query", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request("http://localhost/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/sparql-query" },
      body: 'ASK { ?s <http://schema.org/name> "Alice" }',
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await readBody(response);
    const ask = expectAsk(body);
    expect(ask.result).toBe(true);
  });

  it("handles POST with form-urlencoded", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request("http://localhost/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "query=SELECT+%3Fname+WHERE+%7B+%3Fs+%3Chttp%3A%2F%2Fschema.org%2Fname%3E+%3Fname+%7D",
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const body = await readBody(response);
    expectSelect(body);
  });

  it("returns 400 for missing query", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request("http://localhost/sparql");
    const response = await handler(request);

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(expectError(body).error).toContain("Missing query");
  });

  it("returns 405 for unsupported methods", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request("http://localhost/sparql", { method: "PUT" });
    const response = await handler(request);

    expect(response.status).toBe(405);
  });

  it("rejects queries exceeding max length", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store, {
      maxQueryLength: 10,
    });

    const request = new Request(
      `http://localhost/sparql?query=${"SELECT ?s WHERE { ?s ?p ?o }"}`,
    );
    const response = await handler(request);

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(expectError(body).error).toContain("maximum length");
  });

  it("includes CORS headers when enabled", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store, { cors: true });

    const request = new Request("http://localhost/sparql", {
      method: "OPTIONS",
    });
    const response = await handler(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 for invalid SPARQL", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request(
      "http://localhost/sparql?query=NOT+VALID+SPARQL",
    );
    const response = await handler(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for POST without content-type header", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    // Construct a POST request that truly has no Content-Type header.
    // Using a string body auto-sets text/plain, so we build manually.
    const request = new Request("http://localhost/sparql", {
      method: "POST",
    });
    const response = await handler(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for POST with unsupported content-type", async () => {
    testResult = await createTestStore();
    const handler = createSparqlHandler(testResult.store);

    const request = new Request("http://localhost/sparql", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "SELECT ?s WHERE { ?s ?p ?o }",
    });
    const response = await handler(request);

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(expectError(body).error).toContain("Missing query");
  });

  it("returns generic message when query throws a non-Error value", async () => {
    const fakeStore = {
      query() {
        throw "string error";
      },
      prefixes: {},
      api: () => undefined,
      reload: async () => {},
      dispose: () => {},
    };
    const handler = createSparqlHandler(
      fakeStore as unknown as import("../lib/types.js").Store,
    );

    const request = new Request(
      "http://localhost/sparql?query=SELECT+%3Fs+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D",
    );
    const response = await handler(request);

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(expectError(body).error).toBe("Query execution failed");
  });
});
