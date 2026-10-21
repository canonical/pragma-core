import {
  Environment,
  type FetchFunction,
  type GraphQLResponse,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";
import {
  createRelayRuntimeNetwork,
  httpExecutor,
  localGraphExecutor,
  type RelayFetchContext,
  type RelayFetchExecutor,
  type RelayRuntimeFetch,
  urlMiddleware,
} from "relay-runtime-network";
import type { RelayRecords } from "./types.js";

/** Options for {@link createEnvironment}. */
interface CreateEnvironmentOptions {
  /**
   * GraphQL endpoint URL. Overrides the `VITE_GRAPHQL_URL` env var; when
   * neither is set the environment executes against the local mock schema.
   */
  readonly graphqlUrl?: string;
  /**
   * Records to seed the store with, as another environment serialized them.
   * Operations those records answer read as available, so they render
   * without a fetch.
   *
   * Nothing retains the seeded records: the records do not say which
   * operations they answer, so there is no operation to retain. They stay
   * because Relay collects unretained records only when a released operation
   * overflows the store's release buffer (ten operations by default) or goes
   * stale, and no `queryCacheExpirationTime` is set, so nothing goes stale.
   * The first reader of a seeded page mounts during hydration and retains
   * its operation from then on; until it does, the records survive while no
   * more than ten queries have been released. An app that can release more
   * before a seeded page's reader mounts must retain that page's operation
   * itself.
   */
  readonly records?: RelayRecords;
}

/** Reads the endpoint URL from Vite's env, treating the empty string as unset. */
const readConfiguredGraphqlUrl = (): string | undefined => {
  const configured: unknown = import.meta.env.VITE_GRAPHQL_URL;
  return typeof configured === "string" && configured.length > 0
    ? configured
    : undefined;
};

/**
 * Builds the in-process network that executes against the mock schema.
 *
 * The schema module (and its `graphql` dependency) is loaded lazily inside
 * the executor — `execute` already returns a promise, so the dynamic import
 * adds no async boundary — keeping graphql-js and the mock catalog out of
 * the main bundle, and unparsed, whenever the endpoint path is taken.
 */
const createLocalNetwork = () =>
  createRelayRuntimeNetwork({
    fetch: {
      executor: localGraphExecutor({
        execute: async (context: RelayFetchContext) => {
          const { text } = context.operation;
          if (!text) {
            throw new Error(
              "The local mock schema requires full operation text; persisted queries are not supported.",
            );
          }
          const { executeLocalOperation } = await import("./schema.js");
          return executeLocalOperation({
            text,
            variables: context.variables,
          });
        },
      }),
    },
  });

/**
 * Wraps an executor so a transport failure resolves as a well-formed GraphQL
 * error payload instead of a thrown exception. The pipeline's fetch context
 * creates an internal incremental-payload promise that no non-incremental
 * consumer ever awaits; an executor throw rejects it unhandled (fatal under
 * Bun). Converting the failure at the source means nothing in the pipeline
 * ever rejects, while Relay still surfaces it as an operation error.
 */
const safeExecutor = (executor: RelayFetchExecutor): RelayFetchExecutor =>
  Object.assign(
    async (context: RelayFetchContext) => {
      try {
        return await executor(context);
      } catch (error) {
        console.warn(
          "[relay] transport failure converted to error payload:",
          error,
        );

        return {
          payload: {
            errors: [
              {
                message: error instanceof Error ? error.message : String(error),
              },
            ],
          },
          response: null,
          status: null,
        };
      }
    },
    { descriptor: executor.descriptor },
  );

/** Builds the HTTP network that posts operations to `graphqlUrl`. */
const createHttpNetwork = (graphqlUrl: string) =>
  createRelayRuntimeNetwork({
    fetch: {
      executor: safeExecutor(httpExecutor()),
      middlewares: [urlMiddleware({ url: graphqlUrl })],
    },
  });

/**
 * Adapts the pipeline's fetch to relay-runtime's `FetchFunction`. Both
 * describe the same GraphQL response wire shape, but relay-runtime types the
 * payload as `PayloadData` where the pipeline says `unknown`, and takes its
 * cache config as an interface where the pipeline wants a plain record —
 * hence the spread and the single response cast at this library boundary.
 */
const toFetchFunction =
  (fetchGraphQL: RelayRuntimeFetch): FetchFunction =>
  (params, variables, cacheConfig) => {
    const response = fetchGraphQL(params, variables, {
      ...cacheConfig,
    }) as Promise<GraphQLResponse>;

    // The pipeline starts the request at call time, before Relay's observable
    // attaches its handlers — guard the raw promise so a rejection that beats
    // (or never gains) a subscriber cannot crash the process. Consumers still
    // observe the same rejection through the returned promise.
    response.catch(() => {});

    return response;
  };

/**
 * Creates a Relay `Environment` for the app, its store seeded with
 * `options.records` when given.
 *
 * The network runs on `relay-runtime-network`'s middleware-driven fetch
 * pipeline, in one of two modes:
 *
 * - **local (default)** — a `localGraphExecutor` resolves every operation
 *   in-process against the mock catalog schema (`./schema.ts`), so the
 *   boilerplate runs with zero backend.
 * - **endpoint** — when `VITE_GRAPHQL_URL` is set (or `options.graphqlUrl`
 *   is passed), an `httpExecutor` + `urlMiddleware` posts operations to a
 *   real GraphQL server.
 *
 * Call once per browser session (module scope in the client entry) and, on
 * the server, once per request for the matched route's warm and once per
 * render, so no store state leaks across requests.
 *
 * @note Impure: reads `VITE_GRAPHQL_URL` from Vite's env when no URL is
 * passed, and builds a network that performs I/O on every operation.
 */
export const createEnvironment = (
  options: CreateEnvironmentOptions = {},
): Environment => {
  const graphqlUrl = options.graphqlUrl ?? readConfiguredGraphqlUrl();
  const network = graphqlUrl
    ? createHttpNetwork(graphqlUrl)
    : createLocalNetwork();

  return new Environment({
    network: Network.create(toFetchFunction(network.fetch)),
    store: new Store(new RecordSource(options.records)),
  });
};
