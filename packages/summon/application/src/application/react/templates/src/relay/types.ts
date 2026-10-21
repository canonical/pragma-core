import type { RecordSource } from "relay-runtime";

/**
 * A Relay store's records in their serializable form, as
 * `RecordSource.toJSON()` returns them: the shape that crosses the SSR
 * boundary on `__INITIAL_DATA__.relayRecords`.
 */
export type RelayRecords = ReturnType<RecordSource["toJSON"]>;
