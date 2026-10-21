import type { NavigationContext } from "@canonical/router-core";
import {
  createOperationDescriptor,
  fetchQuery,
  getRequest,
  type IEnvironment,
} from "relay-runtime";
import type { ProductListQuery } from "#relay/__generated__/ProductListQuery.graphql.js";
import { getPrefetchEnvironment } from "#relay/prefetchEnvironment.js";
import { PAGE_SIZE, productListQuery } from "./ProductList.js";

/**
 * Fetch the catalog query with `variables` into `environment`, settling when
 * the fetch completes and rejecting with its error.
 *
 * Once `signal` aborts, the fetch is unsubscribed, so Relay stops handling
 * its response and writes nothing from it into the store, and the promise
 * rejects with the abort reason. An already-aborted signal rejects at once
 * and fetches nothing.
 *
 * @note Impure: performs a network request and writes the response into
 * `environment`'s store.
 */
function fetchCatalogPage(
  environment: IEnvironment,
  variables: ProductListQuery["variables"],
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);

      return;
    }

    const cancel = () => {
      subscription.unsubscribe();
      reject(signal.reason);
    };
    const subscription = fetchQuery<ProductListQuery>(
      environment,
      productListQuery,
      variables,
    ).subscribe({
      complete: () => {
        signal.removeEventListener("abort", cancel);
        resolve();
      },
      error: (error: unknown) => {
        signal.removeEventListener("abort", cancel);
        reject(error);
      },
    });

    if (!subscription.closed) {
      signal.addEventListener("abort", cancel, { once: true });
    }
  });
}

/**
 * Warm the catalog route: fetch the first page of products into the published
 * prefetch environment, so `ProductList`'s `useLazyLoadQuery` reads it from
 * the store instead of fetching.
 *
 * On the client the router fires this on navigation and ignores both its
 * result and its rejection; the router aborts `signal` when a later
 * navigation supersedes this one. On the server, `prefetchRouteData` awaits
 * it against a request-scoped environment, aborts `signal` at its deadline,
 * and serializes what it fetched. Either way an abort unsubscribes the fetch.
 * With no environment published there is nothing to fill, and when the store
 * can already answer the query (after a server-seeded hydration) nothing is
 * fetched.
 *
 * The environment is read before the first `await`: the server publishes it
 * only for the synchronous part of this call.
 *
 * @param _params - The route's params; the catalog has none.
 * @param _search - The route's search; the first page ignores it.
 * @param context - The navigation context, whose `signal` cancels the fetch.
 * @note Impure: reads the module-scope prefetch environment, performs a
 * network request, and writes the response into that environment's store.
 */
export default async function warmCatalog(
  _params: unknown,
  _search: unknown,
  { signal }: NavigationContext,
): Promise<void> {
  const environment = getPrefetchEnvironment();

  if (!environment) {
    return;
  }

  const variables = { count: PAGE_SIZE };
  const operation = createOperationDescriptor(
    getRequest(productListQuery),
    variables,
  );

  if (environment.check(operation).status === "available") {
    return;
  }

  await fetchCatalogPage(environment, variables, signal);
}
