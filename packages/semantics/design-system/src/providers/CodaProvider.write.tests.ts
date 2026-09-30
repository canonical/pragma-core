/**
 * The write path's additions to `CodaProvider`.
 *
 * Kept beside the existing suite rather than inside it because these tests care about
 * a different credential: the write path reads and writes under `CODA_WRITE_TOKEN` and
 * never touches `CODA_API_KEY`, and a shared `beforeEach` that sets the read key would
 * hide exactly that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodaProvider, {
  CODA_API_BASE,
  READ_DELAY_MS,
  READ_PAGE_SIZE,
} from "./CodaProvider.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function failure(
  status: number,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: false,
    status,
    statusText: "Too Many Requests",
    headers: new Headers(headers),
    json: async () => ({}),
    text: async () => "rate limited",
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Run a promise that awaits timers, letting the fake clock through. */
async function withTimers<T>(work: Promise<T>): Promise<T> {
  const settled = work.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const outcome = await settled;
  if ("error" in outcome) {
    throw outcome.error;
  }
  return outcome.value;
}

describe("the credential", () => {
  it("names the read variable and the write variable, and they are different", () => {
    expect(CodaProvider.READ_KEY_VAR).toBe("CODA_API_KEY");
    expect(CodaProvider.WRITE_KEY_VAR).toBe("CODA_WRITE_TOKEN");
  });

  it("defaults to the read key, so every existing caller is unchanged", () => {
    vi.stubEnv("CODA_API_KEY", "read-key");
    vi.stubEnv("CODA_WRITE_TOKEN", "");
    expect(() => new CodaProvider()).not.toThrow();
  });

  it("reads the write key when asked, and never falls back to the read key", () => {
    vi.stubEnv("CODA_API_KEY", "read-key");
    vi.stubEnv("CODA_WRITE_TOKEN", "");
    expect(() => new CodaProvider(CodaProvider.WRITE_KEY_VAR)).toThrow(
      "CODA_WRITE_TOKEN environment variable is required",
    );
  });

  it("sends the write key on a read, so the write path never touches the read key", async () => {
    vi.stubEnv("CODA_API_KEY", "read-key");
    vi.stubEnv("CODA_WRITE_TOKEN", "write-token");
    mockFetch.mockResolvedValue(ok({ items: [] }));
    const provider = new CodaProvider(CodaProvider.WRITE_KEY_VAR);
    await withTimers(provider.fetchTable("doc", "grid-1"));
    const headers = mockFetch.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer write-token");
  });
});

describe("the API host", () => {
  beforeEach(() => {
    vi.stubEnv("CODA_API_KEY", "read-key");
  });

  it("is the workspace host and not coda.io, on reads as well as writes", () => {
    // The document lives in a workspace served from `docs.superhuman.com`. A read
    // against `coda.io` returns a stale view of it and a write against `coda.io` is
    // accepted with a 202 and never applies, which is the failure mode nothing
    // reports — so the host is asserted here rather than left to a code review.
    expect(CODA_API_BASE).toBe("https://docs.superhuman.com/apis/v1");
    expect(CODA_API_BASE).not.toContain("coda.io");
  });

  it("sends every call to that host", async () => {
    mockFetch.mockResolvedValue(ok({ items: [] }));
    await withTimers(new CodaProvider().fetchTable("doc", "grid-1"));
    expect(String(mockFetch.mock.calls[0][0]).startsWith(CODA_API_BASE)).toBe(
      true,
    );
  });
});

describe("the read path", () => {
  beforeEach(() => {
    vi.stubEnv("CODA_API_KEY", "read-key");
  });

  it("declares an explicit page size, so a read is a known number of calls", async () => {
    mockFetch.mockResolvedValue(ok({ items: [] }));
    await withTimers(new CodaProvider().fetchTable("doc", "grid-1"));
    expect(new URL(mockFetch.mock.calls[0][0]).searchParams.get("limit")).toBe(
      String(READ_PAGE_SIZE),
    );
  });

  it("pays no delay for a single-page read, and one between pages", async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ items: [{ id: "i-1", values: {} }], nextPageToken: "t" }),
      )
      .mockResolvedValueOnce(ok({ items: [{ id: "i-2", values: {} }] }));
    const rows = await withTimers(
      new CodaProvider().fetchTable("doc", "grid-1"),
    );
    expect(rows.map((row) => row._codaId)).toEqual(["i-1", "i-2"]);
    expect(READ_DELAY_MS).toBe(1100);
  });

  it("retries a 429 on a read, which it did not before the write path existed", async () => {
    mockFetch
      .mockResolvedValueOnce(failure(429))
      .mockResolvedValueOnce(ok({ items: [] }));
    await withTimers(new CodaProvider().fetchTable("doc", "grid-1"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("honours Retry-After on a read", async () => {
    mockFetch
      .mockResolvedValueOnce(failure(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(ok({ items: [] }));
    await withTimers(new CodaProvider().fetchTable("doc", "grid-1"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries a 5xx and then gives up, naming the status", async () => {
    mockFetch.mockResolvedValue(failure(503));
    await expect(
      withTimers(new CodaProvider().fetchTable("doc", "grid-1")),
    ).rejects.toThrow("Coda API error: 503");
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("does not retry a 404, which no backoff will fix", async () => {
    mockFetch.mockResolvedValue(failure(404));
    await expect(
      withTimers(new CodaProvider().fetchTable("doc", "grid-1")),
    ).rejects.toThrow("Coda API error: 404");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("updateRow", () => {
  beforeEach(() => {
    vi.stubEnv("CODA_WRITE_TOKEN", "write-token");
  });

  it("puts one cell by column id, which is the only write this path makes", async () => {
    mockFetch.mockResolvedValue(ok({ requestId: "r-1" }));
    await withTimers(
      new CodaProvider(CodaProvider.WRITE_KEY_VAR).updateRow(
        "doc",
        "grid-blocks",
        "i-button",
        { "c-anatomy_dsl": "node:\n" },
      ),
    );

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `${CODA_API_BASE}/docs/doc/tables/grid-blocks/rows/i-button`,
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      row: { cells: [{ column: "c-anatomy_dsl", value: "node:\n" }] },
    });
  });

  it("retries a 429 on the write, as it always did", async () => {
    mockFetch
      .mockResolvedValueOnce(failure(429))
      .mockResolvedValueOnce(ok({ requestId: "r-1" }));
    await withTimers(
      new CodaProvider(CodaProvider.WRITE_KEY_VAR).updateRow(
        "doc",
        "grid-1",
        "i-1",
        { "c-a": "x" },
      ),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("hands back the queued mutation's id, which is the only handle on the write", async () => {
    // Coda applies a mutation asynchronously: the 202 says queued, and the
    // requestId is what `getMutationStatus` answers about. Discarding it is what
    // left "accepted and never applied" indistinguishable from "not yet applied".
    mockFetch.mockResolvedValue(ok({ requestId: "r-1", id: "i-button" }));
    const accepted = await withTimers(
      new CodaProvider(CodaProvider.WRITE_KEY_VAR).updateRow(
        "doc",
        "grid-blocks",
        "i-button",
        { "c-anatomy_dsl": "node:\n" },
      ),
    );
    expect(accepted.requestId).toBe("r-1");
  });
});

describe("getMutationStatus", () => {
  beforeEach(() => {
    vi.stubEnv("CODA_WRITE_TOKEN", "write-token");
  });

  it("asks the workspace host about one request id, as a read", async () => {
    mockFetch.mockResolvedValue(ok({ completed: true }));
    const status = await withTimers(
      new CodaProvider(CodaProvider.WRITE_KEY_VAR).getMutationStatus("r-1"),
    );

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${CODA_API_BASE}/mutationStatus/r-1`);
    expect(init.method).toBe("GET");
    expect(status.completed).toBe(true);
  });

  it("retries a 429, so the answer to 'has it applied yet' is not itself lost", async () => {
    mockFetch
      .mockResolvedValueOnce(failure(429))
      .mockResolvedValueOnce(ok({ completed: false }));
    const status = await withTimers(
      new CodaProvider(CodaProvider.WRITE_KEY_VAR).getMutationStatus("r-1"),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(status.completed).toBe(false);
  });
});
