import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPrefetchEnvironment } from "#relay/prefetchEnvironment.js";
import { PAGE_SIZE } from "./ProductList.js";
import warmCatalog from "./warmCatalog.js";

/** Start the catalog warm as the router does, with `signal` in its context. */
const startWarm = (signal = new AbortController().signal) =>
  warmCatalog({}, {}, { signal });

afterEach(() => {
  setPrefetchEnvironment(undefined);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("warmCatalog", () => {
  it("fetches nothing while no prefetch environment is published", async () => {
    vi.stubEnv("VITE_GRAPHQL_URL", "https://api.example.test/graphql");
    const fetch = vi.fn(async () => {
      throw new Error("The warm reached the network");
    });
    vi.stubGlobal("fetch", fetch);

    await expect(startWarm()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches the first catalog page into the published environment", async () => {
    const environment = createMockEnvironment();
    setPrefetchEnvironment(environment);

    const warming = startWarm();

    expect(environment.mock.getAllOperations()).toHaveLength(1);

    const operation = environment.mock.getMostRecentOperation();

    expect(operation.request.node.params.name).toBe("ProductListQuery");
    expect(operation.request.variables).toMatchObject({ count: PAGE_SIZE });

    environment.mock.resolve(
      operation,
      MockPayloadGenerator.generate(operation),
    );

    await expect(warming).resolves.toBeUndefined();
  });

  it("fetches nothing when the store already answers the query", async () => {
    const environment = createMockEnvironment();
    setPrefetchEnvironment(environment);

    const filling = startWarm();
    const operation = environment.mock.getMostRecentOperation();
    environment.mock.resolve(
      operation,
      MockPayloadGenerator.generate(operation),
    );
    await filling;

    await startWarm();

    expect(environment.mock.getAllOperations()).toEqual([]);
  });

  it("rejects with the fetch's error", async () => {
    const environment = createMockEnvironment();
    setPrefetchEnvironment(environment);
    const failure = new Error("The endpoint is unreachable");

    const warming = startWarm();
    environment.mock.reject(environment.mock.getMostRecentOperation(), failure);

    await expect(warming).rejects.toBe(failure);
  });

  it("cancels the fetch and rejects with the reason when the signal aborts", async () => {
    const environment = createMockEnvironment();
    setPrefetchEnvironment(environment);
    const controller = new AbortController();
    const reason = new Error("The navigation was superseded");

    const warming = startWarm(controller.signal);
    controller.abort(reason);

    await expect(warming).rejects.toBe(reason);
    expect(environment.mock.getAllOperations()).toEqual([]);
  });

  it("fetches nothing when the signal has already aborted", async () => {
    const environment = createMockEnvironment();
    setPrefetchEnvironment(environment);
    const reason = new Error("The deadline passed");

    await expect(startWarm(AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(environment.mock.getAllOperations()).toEqual([]);
  });
});
