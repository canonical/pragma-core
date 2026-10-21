import { createOperationDescriptor, getRequest } from "relay-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, productListQuery } from "#domains/catalog/ProductList.js";
import warmCatalog from "#domains/catalog/warmCatalog.js";
import { createEnvironment } from "#relay/environment.js";
import { getPrefetchEnvironment } from "#relay/prefetchEnvironment.js";
import { executeLocalOperation } from "#relay/schema.js";
import type { RelayRecords } from "#relay/types.js";
import {
  prefetchRouteData,
  type RouteDisposition,
  resolveRouteDisposition,
} from "./entry.js";

// The router copies each route record when it is created, so a test cannot
// swap a matched route's warm afterwards. The catalog warm is wrapped in a
// spy that runs the real warm unless a test overrides one call.
vi.mock("#domains/catalog/warmCatalog.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("#domains/catalog/warmCatalog.js")>();

  return { default: vi.fn(actual.default) };
});

/** The operation the catalog route's warm fetches. */
const catalogOperation = createOperationDescriptor(
  getRequest(productListQuery),
  { count: PAGE_SIZE },
);

/** The GraphQL endpoint the network-bound cases point the environment at. */
const ENDPOINT = "https://api.example.test/graphql";

/** Read the viewer name the catalog operation finds in `records`. */
const readViewerName = (records: RelayRecords | undefined) => {
  const { data } = createEnvironment({ records }).lookup(
    catalogOperation.fragment,
  );
  const viewer = (data as { readonly viewer?: { readonly name?: unknown } })
    .viewer;

  return viewer?.name;
};

/**
 * Answer the catalog operation from the local schema as an endpoint would,
 * with the viewer renamed to `viewerName`.
 */
const answerCatalogAs = async (viewerName: string) => {
  const { node, variables } = catalogOperation.request;
  const { data } = await executeLocalOperation({
    text: String(node.params.text),
    variables,
  });
  const { viewer } = data as { readonly viewer: Record<string, unknown> };

  return Response.json({ data: { viewer: { ...viewer, name: viewerName } } });
};

/** The `console.warn` calls that report a failed prefetch. */
const countPrefetchWarnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.filter(([message]) =>
    String(message).startsWith("SSR data prefetch failed"),
  ).length;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("prefetchRouteData", () => {
  it("returns the records the matched route's warm fetched", async () => {
    const records = await prefetchRouteData(
      resolveRouteDisposition("/catalog"),
    );

    expect(records).toBeDefined();
    expect(createEnvironment({ records }).check(catalogOperation).status).toBe(
      "available",
    );
  });

  it("returns nothing for a route without a warm", async () => {
    await expect(
      prefetchRouteData(resolveRouteDisposition("/")),
    ).resolves.toBeUndefined();
  });

  it("returns nothing for a redirect", async () => {
    await expect(
      prefetchRouteData(resolveRouteDisposition("/home")),
    ).resolves.toBeUndefined();
  });

  it("returns nothing for a URL no route matches", async () => {
    const disposition = resolveRouteDisposition("/no-such-page");

    expect(disposition).toMatchObject({
      kind: "render",
      dehydratedState: { kind: "not-found" },
    });
    await expect(prefetchRouteData(disposition)).resolves.toBeUndefined();
    expect(warmCatalog).not.toHaveBeenCalled();
  });

  it("returns nothing for a render without router state", async () => {
    // What `resolveRouteDisposition` answers when a search schema rejects.
    const disposition: RouteDisposition = {
      kind: "render",
      status: 400,
      dehydratedState: null,
    };

    await expect(prefetchRouteData(disposition)).resolves.toBeUndefined();
    expect(warmCatalog).not.toHaveBeenCalled();
  });

  it("leaves no prefetch environment published", async () => {
    await prefetchRouteData(resolveRouteDisposition("/catalog"));

    expect(getPrefetchEnvironment()).toBeUndefined();
  });

  it("keeps the records of overlapping requests apart", async () => {
    vi.stubEnv("VITE_GRAPHQL_URL", ENDPOINT);
    const replies: ((viewerName: string) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const viewerName = await new Promise<string>((resolve) => {
          replies.push(resolve);
        });

        return answerCatalogAs(viewerName);
      }),
    );

    const first = prefetchRouteData(resolveRouteDisposition("/catalog"));
    const second = prefetchRouteData(resolveRouteDisposition("/catalog"));
    await vi.waitFor(() => {
      expect(replies).toHaveLength(2);
    });
    replies.at(0)?.("Katherine Johnson");
    replies.at(1)?.("Grace Hopper");

    expect(readViewerName(await first)).toBe("Katherine Johnson");
    expect(readViewerName(await second)).toBe("Grace Hopper");
    expect(getPrefetchEnvironment()).toBeUndefined();
  });

  it("leaves no prefetch environment published when the warm throws", async () => {
    vi.mocked(warmCatalog).mockImplementationOnce(() => {
      throw new Error("The warm failed before its first await");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      prefetchRouteData(resolveRouteDisposition("/catalog")),
    ).resolves.toBeUndefined();
    expect(getPrefetchEnvironment()).toBeUndefined();
    expect(countPrefetchWarnings(warn)).toBe(1);
  });

  it("returns nothing and warns once when the warm fails", async () => {
    vi.stubEnv("VITE_GRAPHQL_URL", ENDPOINT);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("The endpoint is unreachable");
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      prefetchRouteData(resolveRouteDisposition("/catalog")),
    ).resolves.toBeUndefined();
    expect(countPrefetchWarnings(warn)).toBe(1);
  });

  it("returns nothing and aborts the warm when it outlasts the deadline", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_GRAPHQL_URL", ENDPOINT);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const prefetching = prefetchRouteData(resolveRouteDisposition("/catalog"));
    const [, , context] = vi.mocked(warmCatalog).mock.lastCall ?? [];

    expect(context?.signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(prefetching).resolves.toBeUndefined();
    expect(context?.signal.aborted).toBe(true);
    expect(countPrefetchWarnings(warn)).toBe(1);
  });

  it("returns nothing at the deadline when the warm ignores its signal", async () => {
    vi.useFakeTimers();
    vi.mocked(warmCatalog).mockImplementationOnce(
      () => new Promise<void>(() => {}),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const settled = vi.fn();

    void prefetchRouteData(resolveRouteDisposition("/catalog")).then(settled);

    await vi.advanceTimersByTimeAsync(4_999);

    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toHaveBeenCalledWith(undefined);
    expect(countPrefetchWarnings(warn)).toBe(1);
  });
});
