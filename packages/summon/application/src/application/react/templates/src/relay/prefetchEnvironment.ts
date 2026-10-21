/**
 * The Relay environment route `warm` hooks fill.
 *
 * A module-scope holder rather than React context, because a route's `warm`
 * runs inside the router, outside any React tree. The client entry publishes
 * the browser session's environment before it creates the router, so a warm
 * fired on navigation lands in the store `useLazyLoadQuery` reads. The server
 * publishes a fresh, request-scoped environment only for the synchronous call
 * of the matched route's warm, then restores the previous value; outside that
 * call the holder stays empty on the server, and a warm finds nothing to fill.
 *
 * The invariant both sides rely on: a warm reads the holder synchronously,
 * before its first `await`. A read after an `await` may see another request's
 * environment, or none.
 */

import type { IEnvironment } from "relay-runtime";

let prefetchEnvironment: IEnvironment | undefined;

/**
 * Publish the environment route warms fill, or clear it with `undefined`.
 *
 * @note Impure: writes the module-scope holder every warm reads.
 */
export function setPrefetchEnvironment(
  environment: IEnvironment | undefined,
): void {
  prefetchEnvironment = environment;
}

/**
 * The published environment, or `undefined` when none is published.
 *
 * @note Impure: reads the module-scope holder, which callers may change.
 */
export function getPrefetchEnvironment(): IEnvironment | undefined {
  return prefetchEnvironment;
}
