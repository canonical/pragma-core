/**
 * Boot a {@link StoreSession} from a built pack directory — the perf keystone.
 *
 * The store loads from `data.nq` through ke's cache path (no TTL parse), and
 * the executable GraphQL schema is rebuilt from `schema.json` via ke-graphql's
 * `compileFromExtraction` — passes 2-7, pure JS, no store, no SPARQL. The live
 * 7-pass `compile` is NEVER called here; that only runs at build time. The
 * entity index is a plain `JSON.parse`. The result is an immutable session the
 * lazy store memoizes for the process's lifetime.
 *
 * Reached only behind a dynamic import (store boot), never on the storeless
 * fast path.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStore } from "@canonical/ke";
import { compileFromExtraction } from "@canonical/ke-graphql";
import { BIN_NAME } from "../../../constants.js";
import { callRecovery, PragmaError } from "../../error/index.js";
import { BUILD_STORE_CALL } from "../../spec/call.js";
import type { StoreSession } from "../types.js";
import { readManifest } from "./manifest.js";
import { packIndexSchema } from "./schemas.js";
import {
  DATA_FILE,
  INDEX_FILE,
  PACK_INDEX_VERSION,
  type PackIndex,
  SCHEMA_FILE,
} from "./types.js";

/** STORE_UNAVAILABLE with the canonical `pragma sources update` recovery (CLI + MCP). */
function packUnavailable(reason: string): PragmaError {
  return PragmaError.storeUnavailable(reason, {
    recovery: callRecovery(
      BUILD_STORE_CALL,
      "Rebuild the local store from the configured packs.",
    ),
  });
}

/**
 * STORE_UNAVAILABLE for an index whose format is newer than this CLI reads,
 * recovered by upgrading the CLI rather than rebuilding the pack.
 */
function packFromNewerCli(dir: string, version: number): PragmaError {
  return PragmaError.storeUnavailable(
    `The pack at ${dir} was written by a newer ${BIN_NAME} (index format ${version}; this version reads up to ${PACK_INDEX_VERSION}).`,
    {
      recovery: callRecovery(
        { verb: "upgrade" },
        `Upgrade ${BIN_NAME} to read this pack, or remove ${dir} so it rebuilds.`,
      ),
    },
  );
}

/**
 * Read and validate a pack's `index.json`.
 *
 * The format is checked before the shape, so a pack from a newer CLI is named
 * as such instead of failing validation; any other unreadable index is
 * STORE_UNAVAILABLE with the rebuild recovery, never a raw validation error.
 *
 * @param dir - The pack directory.
 * @returns The validated index.
 * @throws PragmaError STORE_UNAVAILABLE when the index is newer or unreadable.
 * @note Impure — reads from disk.
 */
function readIndex(dir: string): PackIndex {
  const unreadable = `The pack at ${dir} has an unreadable index.`;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, INDEX_FILE), "utf-8"));
  } catch {
    throw packUnavailable(unreadable);
  }
  const version =
    typeof raw === "object" && raw !== null
      ? (raw as { version?: unknown }).version
      : undefined;
  if (typeof version === "number" && version > PACK_INDEX_VERSION) {
    throw packFromNewerCli(dir, version);
  }
  const parsed = packIndexSchema.safeParse(raw);
  if (!parsed.success) throw packUnavailable(unreadable);
  return parsed.data;
}

/**
 * Read a pack directory into a bootable store session.
 *
 * @param dir - The pack directory (must hold a complete pack).
 * @returns The store session: store, schema, context factory, prefixes, index,
 *   and the pack's own manifest (its provenance, carried rather than re-read).
 * @throws PragmaError STORE_UNAVAILABLE when the pack is incomplete, or its
 *   index is unreadable or written by a newer CLI.
 * @note Impure — creates a store from the cached n-quads dump.
 */
export async function readPack(dir: string): Promise<StoreSession> {
  const manifest = readManifest(dir);
  if (!manifest) {
    throw packUnavailable(`The pack at ${dir} is incomplete.`);
  }
  // Read before the store boots, so a refused index leaves nothing to dispose.
  const index = readIndex(dir);

  const store = await createStore({
    // Cache hit loads the n-quads dump directly — no sources are re-parsed.
    sources: [],
    prefixes: manifest.prefixes,
    cache: join(dir, DATA_FILE),
  });

  // `loaderCache: "process"` shares the DataLoader caches across every context
  // for this immutable store's lifetime (the MCP p95 win) — sound because the
  // store never mutates between reloads. PR7 relies on it.
  const compiled = compileFromExtraction(
    readFileSync(join(dir, SCHEMA_FILE), "utf-8"),
    { loaderCache: "process" },
  );

  // Guard against a corrupt or TRUNCATED `data.nq` beside an intact manifest:
  // ke silently serves whatever loaded (falling back to an EMPTY store on a
  // parse failure, and rewriting an empty dump). When the manifest records the
  // build-time triple count (A9), require the booted store to hold AT LEAST it:
  // a SHORTFALL means the dump was truncated (fewer triples than were built) —
  // it passes the mere size>0 completeness gate yet would serve a partial graph
  // silently, so it must surface STORE_UNAVAILABLE here. A benign SUPERSET (more
  // triples than recorded — e.g. a future ke counting change) is TOLERATED
  // rather than treated as corruption, so such a change can't trip a fleet-wide
  // false STORE_UNAVAILABLE. Older packs without the count fall back to the
  // "populated index but empty store" check (via the now-empty dump,
  // `packIsComplete` turns false so recovery rebuilds) rather than serving an
  // empty graph as the pack.
  // `store.size` is a field oxigraph maintains. The equivalent query —
  // `SELECT (COUNT(*)) WHERE { ?s ?p ?o }`, which is what `build.ts` still runs
  // to WRITE `tripleCount` — is a scan, and it ran on every boot to read a
  // number the store already knew.
  //
  // The two agree: ke queries with `use_default_graph_as_union`, and oxigraph
  // does not deduplicate across that union, so a quad count and the union's
  // solution count are the same number even for a triple repeated across
  // graphs. Verified against 0.5.6 rather than assumed — and the guard is `<`,
  // which tolerates the direction a set-semantic union would drift.
  const actualQuads = store.size;
  if (manifest.tripleCount !== undefined) {
    if (actualQuads < manifest.tripleCount) {
      store.dispose();
      throw packUnavailable(
        `The pack at ${dir} has a corrupt data cache (expected at least ${manifest.tripleCount} triples, loaded ${actualQuads}).`,
      );
    }
  } else if (index.entities.length > 0 && actualQuads === 0) {
    store.dispose();
    throw packUnavailable(`The pack at ${dir} has a corrupt data cache.`);
  }

  return {
    store,
    schema: compiled.schema,
    createContext: compiled.createContext,
    prefixes: manifest.prefixes,
    index,
    manifest,
  };
}
