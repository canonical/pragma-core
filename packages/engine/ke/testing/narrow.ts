import type {
  AskResult,
  ConstructResult,
  QueryResult,
  SelectResult,
} from "../src/lib/types.js";

/**
 * Narrow a `QueryResult` to a `SelectResult`, failing the test if the query
 * did not return one. Replaces a `result as SelectResult` cast, which the
 * type checker cannot prove and which silently returns the wrong shape if the
 * query ever changes.
 */
export function expectSelect(result: QueryResult): SelectResult {
  if (result.type !== "select") {
    throw new Error(`expected a SELECT result, got ${result.type}`);
  }
  return result;
}

/**
 * Narrow a `QueryResult` to an `AskResult`, failing the test otherwise.
 */
export function expectAsk(result: QueryResult): AskResult {
  if (result.type !== "ask") {
    throw new Error(`expected an ASK result, got ${result.type}`);
  }
  return result;
}

/**
 * Narrow a `QueryResult` to a `ConstructResult`, failing the test otherwise.
 */
export function expectConstruct(result: QueryResult): ConstructResult {
  if (result.type !== "construct") {
    throw new Error(`expected a CONSTRUCT result, got ${result.type}`);
  }
  return result;
}
