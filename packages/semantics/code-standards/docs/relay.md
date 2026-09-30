# Relay Standards

Standards for relay development.

## cs:relay.fragment.colocation

A GraphQL fragment/query/mutation is authored as an UN-INVOKED `graphql` template tag — wrapped in a never-called function (or `/* v8 ignore */` block) so the plain-tsc/no-babel build never executes it — and the checked-in `__generated__/*.graphql` artifact is the executable form, imported by whichever module runs it. The tag is compiler input, not a runtime call. This is the "no-babel discipline": the relay compiler reads the tag statically; a `graphql(...)`-INVOKED tag at module scope is reserved for the composition root (the app host that owns the root query and RelayEnvironmentProvider), never for a projection component or fragment module.

### Do

Wrap the tag in a never-called const and ignore it from coverage; import the generated artifact for execution.
```tsx
import { graphql, useFragment } from "react-relay";
import fragmentNode from "./__generated__/Roster_room.graphql.js";

/* v8 ignore start -- compiler input: deliberately never invoked at runtime (the no-babel discipline); the checked-in artifact is the executable form */
const _rosterSource = () => graphql`
  fragment Roster_room on Room { roster { holdsPen presence } }
`;
/* v8 ignore stop */

// the artifact — not the tag — is what runs:
const room = useFragment(fragmentNode, roomKey);
```

### Don't

Invoke the graphql tag at module scope and feed the result to a live hook. Reserved for the composition root only.
```tsx
// Bad (in a projection component / fragment module):
const inspectorPanesQuery = graphql`
  query InspectorPanesQuery($refId: ID!) { store { ref(id: $refId) { ...RefTimeline_ref } } }
`;
const data = useLazyLoadQuery(inspectorPanesQuery, { refId }); // runtime-invoked tag
```

---

## cs:relay.fragment.connection_key_fenced

Every `@connection(key: "...")` corresponds 1:1 to an entry in the shared `CONNECTION_KEYS` table (`@scope/relay-writer` `constants.ts`), and a fence test asserts the correspondence in BOTH directions (no key in a fragment without a table entry; no table entry without a fragment key). `CONNECTION_KEYS` carries both hosts' keys in one table (the web `turns`/`effects`/`refs`/`commits` and the TUI `timeline`/`chat`/`roomTail`/`roster`/`worklist`), so the fence is the single source of connection-name truth across hosts.

### Do

Reference a fenced CONNECTION_KEYS entry and assert the 1:1 correspondence in a test.
```typescript
// relay-writer/src/constants.ts — the one table both hosts fence against
export const CONNECTION_KEYS = { timeline: "...", chat: "...", turns: "...", refs: "..." } as const;

// the fence (bidirectional): every consumed key ⇔ a table entry
expect([...consumedKeys].sort()).toEqual([...Object.values(CONNECTION_KEYS)].sort());
```

### Don't

Pass a bare connection-name string literal to the edge-write path instead of a CONNECTION_KEYS-derived name.
```typescript
// Bad: the connection name "chat" is a floating literal, un-fenced
const connection = getOrCreateConnectionRecord(store, hostId, "chat");
```

---

## cs:relay.fragment.edge_via_shared_path

Connection edges are inserted ONLY through the shared relay-writer path — `applyProjectionBatch` (the sink) and `getOrCreateConnectionRecord` (the one shell-construction path the sink AND the optimistic overlays share). An overlay that adds an optimistic edge get-or-creates the host + connection record through `getOrCreateConnectionRecord`, then uses `ConnectionHandler.insertEdgeAfter`; it never hand-walks `edges`. Ordering/dedup/frontier guards live in `applyEdge`, which throws `ProjectionOrderViolation` on a cursor-order break. Because both the sink and every overlay build the connection shell through one function, the record shapes cannot drift.

### Do

Build the connection shell through getOrCreateConnectionRecord; let applyEdge/applyProjectionBatch own ordering.
```typescript
import { getOrCreateConnectionRecord } from "@scope/relay-writer";
const host = store.get(hostId) ?? store.create(hostId, SEQUENCE_TYPENAME);
const connection = getOrCreateConnectionRecord(store, hostId, CONNECTION_KEYS.chat);
ConnectionHandler.insertEdgeAfter(connection, edge);
```

### Don't

Construct or mutate a connection record by hand-walking edges, bypassing the shared path.
```typescript
// Bad: bespoke connection shell — will drift from the sink's shape
const conn = store.create(connId, "ChatConnection");
conn.setLinkedRecords([...existing, edge], "edges"); // no dedup, no order guard
```

---

## cs:relay.fragment.naming

A fragment name is `<owner>_<grain>` where `<owner>` is the module's camelCase name and `<grain>` is the projection grain the fragment carries — `_row` for a single row/face, `_seq` for a connection/sequence body, or the field being projected (`_ref`, `_room`, `_turn`). The grain suffix, NOT the GraphQL root type, is the discriminant: `sayPostRowFragment_row on TimelineNoun`, `sequenceChatFragment_seq on Sequence`, `Roster_room on Room`, `TurnEffects_effects on Turn`. Owner and grain are both required; a bare fragment name (no suffix) is a violation.

### Do

Name by owner + projection grain suffix.
```graphql
fragment sayPostRowFragment_row on TimelineNoun { id kind bareId label solid }
fragment sequenceChatFragment_seq on Sequence { ... }
fragment Roster_room on Room { roster { ... } }
```

### Don't

Omit the grain suffix or name off the raw root type.
```graphql
# Bad: no grain suffix; the reader can't tell a row from a connection body
fragment TimelineNoun on TimelineNoun { ... }
fragment sayPost on TimelineNoun { ... }
```

---

## cs:relay.fragment.no_echo_confirm_key

A write does not echo a server-confirmation key back into a separate record field. The optimistic overlay and the confirmed echo share ONE dataID (the fold coordinate keyed off `K`), so reconciliation is "one node, one edge, flipped in place" — byte-for-byte the same write, no confirmation-id field stored on the record. The key `K` is the reconcile handle carried in the mutation Ack, never written back as a record value.

### Do

Reconcile by the shared dataID; carry the key in the Ack, not on the record.
```typescript
// overlay writes at chat-msg:K; the confirmed echo also lands at chat-msg:K
// the mutation returns { key, seq } as the Ack handle — nothing echoed onto the row
export const sayPostRowDataId = (key: string): string => `chat-msg:${key}`;
```

### Don't

Store a server confirmation id on the record so the reader can 'match' it.
```typescript
// Bad: an echoed confirmation key becomes a second address / second writer
row.setValue(serverAck.confirmationId, "confirmedBy");
```

---

## cs:relay.fragment.no_second_data_writer

The sink (`applyProjectionBatch`, fed by the pump/subscription) is the SOLE writer of confirmed record field values. An optimistic overlay writes a NODE-ONLY LEAF at the SAME fold-coordinate dataID the confirmed echo will land at, links to nothing, and flips `solid: false`→(confirmed) in place — it never writes a field the sink owns and never strands a referrer. This is fenced as a ship gate: the overlay's link targets must be empty, and hostile sink/overlay interleavings must never throw and must flip `solid` in place. The web equivalent: projected fetch performs NO optimistic writes at all ("a second store writer is unlawful").

### Do

Overlay writes a node-only leaf at the shared dataID; the sink stays the sole data writer.
```typescript
const id = sayPostRowDataId(key);              // SAME coordinate the echo lands at
const row = store.get(id) ?? store.create(id, TIMELINE_NOUN_TYPENAME);
row.setValue(false, "solid");                  // THE PENDING BIT — the echo flips it in place
// no node(id:) linkage, no field the sink owns — a leaf
```

### Don't

Write a field the sink owns, or a root node(id:) linkage that shadows the missing-field handler and reverts on confirm.
```typescript
// Bad: the overlay writes the confirmed seq — a second writer of a sink-owned field
row.setValue(realSeq, "seq");
// Bad: writing node(id:) root linkage in the optimistic layer — reverts on confirm, leaves the record unreadable
root.setLinkedRecord(row, "node", { id });
```

---

## cs:relay.fragment.page_grammar

A PAGINATED connection fragment carries `@refetchable(queryName: ...)` plus `first: $count` (default `CONNECTION_PAGE_SIZE`, currently 16) and `after: $cursor` (`Cursor` type); its query name is in `SANCTIONED_PAGE_QUERY_NAMES`. An UNPAGINATED (whole-window) connection deliberately omits `@refetchable` and uses an INT_MAX default (`2147483647`) — the choice is explicit, not accidental. The `16` default is a raw literal inside the graphql tag (a tag cannot import a TS const); the tie to `CONNECTION_PAGE_SIZE` is the fence, not an import. If `loadNext` is exposed by `usePaginationFragment`, it advances by `CONNECTION_PAGE_SIZE`; a discarded `loadNext` (window-read-only) is legitimate but should be documented as such.

### Do

Paginated: @refetchable + first:$count (16 default) + Cursor. Unpaginated: no @refetchable, INT_MAX default, documented.
```graphql
# paginated:
fragment sequenceChatFragment_seq on Sequence
  @argumentDefinitions(count: { type: "Int", defaultValue: 16 }, cursor: { type: "Cursor" })
  @refetchable(queryName: "sequenceChatPaginationQuery") {
  chat(first: $count, after: $cursor) @connection(key: "...") { edges { node { ... } } }
}
# unpaginated (whole window, deliberate):
fragment sequenceWorklistFragment_seq on Sequence
  @argumentDefinitions(count: { type: "Int", defaultValue: 2147483647 }) { ... }
```

### Don't

Hardcode a page-size that disagrees with CONNECTION_PAGE_SIZE, or call loadNext with a bespoke number.
```typescript
// Bad: magic page size, unfenced, disagrees with CONNECTION_PAGE_SIZE
loadNext(20);
```

---

## cs:relay.fragment.row_inline

A row fragment is `@inline` when read imperatively (`readInlineData`), and plain (no directive) when read by a component through `useFragment` (a store subscription). A connection/sequence fragment SPREADS the row fragment inside its node body — it never re-selects the row's face fields. One row shape, declared once, spread everywhere; the imperative and subscription reads are two doors on it.

### Do

@inline for the imperative twin; plain for the subscription; spread the row fragment in the connection body.
```graphql
# imperative (readInlineData):
fragment timelineNounFragment_row on TimelineNoun @inline { id kind bareId label seq }
# subscription (useFragment):
fragment sayPostRowFragment_row on TimelineNoun { id kind bareId label solid }
# connection body SPREADS the row fragment, never re-selects the face:
fragment sequenceChatFragment_seq on Sequence {
  chat(...) @connection(key: "sequenceChatFragment_chat") {
    edges { node { id ...timelineNounFragment_row } }
  }
}
```

### Don't

Re-select the row's face fields inside the connection body instead of spreading the row fragment.
```graphql
# Bad: the face is duplicated; the row fragment and the connection body drift
fragment sequenceChatFragment_seq on Sequence {
  chat(...) @connection(key: "...") {
    edges { node { id kind bareId label } } # re-selected — should be ...timelineNounFragment_row
  }
}
```

---

## cs:relay.host.pure_fragment_renderer

A web projection component is a PURE fragment-renderer: it takes a fragment key prop (`<X>Key`), reads it with `useFragment` (or `usePaginationFragment` for a paginated connection), and renders — no component-side state, no `retain`, no `loadQuery`/`useLazyLoadQuery`, no `RelayEnvironmentProvider`. The retain/environment/subscription lifecycle is owned by the HOST (the projected environment + the app composition root), never by the component. A component may call the fragment-scoped `loadNext(CONNECTION_PAGE_SIZE)`; that is pagination, not lifecycle ownership.

### Do

Take a fragment key prop, useFragment, render. Nothing else.
```tsx
export default function Roster({ roomKey, ...props }: RosterProps) {
  const room = useFragment(fragmentNode, roomKey);   // pure render of its fragment; no state
  return <section {...props} data-component="Roster">{/* ... */}</section>;
}
```

### Don't

Own retain / load the query / provide the environment inside the component.
```tsx
// Bad: the component owns lifecycle the host should own
export default function Roster({ roomId }: { roomId: string }) {
  const data = useLazyLoadQuery(rosterQuery, { roomId });   // loads its own query
  useEffect(() => environment.retain(operation), []);       // owns retain
  return <RelayEnvironmentProvider environment={env}>...</RelayEnvironmentProvider>;
}
```

---

## cs:relay.host.retain_ownership

On the web host, `environment.retain` is called ONLY in the host layer — the projected environment retains a store-scoped operation (root linkage + refs window) for its whole life, and per-ref retains are acquired at ref-open and released at ref-drop. The composition root (the web host application) owns the root query (the one `graphql`-INVOKED tag), `useLazyLoadQuery`, and `RelayEnvironmentProvider`. No library projection component and no fragment module calls `retain` or invokes the graphql tag; that concentration is what makes the components pure and portable.

### Do

Retain in the host; acquire per-ref at open, release at drop.
```typescript
// host/projection/createProjectedEnvironment.ts — store-scoped retain, held construction→dispose
const storeRetain = environment.retain(createOperationDescriptor(storeRefsQuery, {}));
// host/projection/acquireRefRetain.ts — one pin per open ref, released at drop
const disposable = environment.retain(createOperationDescriptor(queryNode, { id: refId }));
```

### Don't

Retain (or invoke the root query tag) outside the host — in a library component or fragment module.
```typescript
// Bad: a projection component retaining — lifecycle leaks out of the host
function CutPane({ refId }) {
  useEffect(() => environment.retain(op), []);   // belongs in the host, not here
}
```

---

## cs:relay.projection.check_before_lookup

The imperative twin calls `environment.check(operation)` (or explicitly seeds the `node(id:)` root linkage via `commitUpdate`) BEFORE `environment.lookup`. `check` materializes the `node(id:)` root linkage that the missing-field handler would otherwise only supply during a live read; without it the imperative `lookup` sees no root pointer. The order is load-bearing: check/seed, then lookup.

### Do

check (materialize root linkage) before lookup.
```typescript
const operation = createOperationDescriptor(query, { id });
environment.check(operation);      // materialize node(id:) root linkage FIRST
const snapshot = environment.lookup(operation.fragment);
```

### Don't

Lookup before check — the imperative read sees no root linkage.
```typescript
// Bad: lookup first — the node(id:) linkage isn't materialized yet
const snapshot = environment.lookup(operation.fragment);
environment.check(operation);
```

---

## cs:relay.projection.host_query

A TUI projection reader fetches through the `node(id:)` root field routed by the shared missing-field-link handler (`createMissingFieldLinkHandler`: `node`/`ref` with an `id` arg resolves to that id as the dataID, because `id ≡ dataID` on every Node). There is no bespoke root field and no per-id root linkage written; the handler serves the read against the sink-fed store. The live path uses `useClientQuery` (a hook) / `environment.check` + `lookup` (the twin), NOT `useLazyLoadQuery` (that is the web composition root's job). The host-query aliases the fragment (`... on Sequence { ...seq @alias(as: "seq") }`).

### Do

Fetch via node(id:) aliased to the fragment; let the missing-field handler resolve id ≡ dataID.
```graphql
query sequenceChatHostQuery($id: ID!) {
  node(id: $id) { ... on Sequence { ...sequenceChatFragment_seq @alias(as: "seq") } }
}
# no root node(id:) linkage is written — createMissingFieldLinkHandler answers the arg id as the dataID
```

### Don't

Invent a bespoke root field, or reach for useLazyLoadQuery in the reader (that belongs to the web composition root).
```typescript
// Bad: bespoke root field / composition-root hook inside a TUI reader
const data = useLazyLoadQuery(bespokeSequenceQuery, { id });
```

---

## cs:relay.projection.read_hook_and_twin

A TUI connection reader exports a `use<X>Read` React hook AND a `read<X>` imperative twin, and BOTH fold through ONE shared pure function ("one derivation, two doors"). The hook drives the live view (subscribes); the twin drives tests/harnesses (imperative). Neither door re-implements the fold — the shared pure fn (e.g. `chatReadFromRecords`, `roomReadFromRecords`) is the single derivation. A by-id row path may have only the imperative twin (its "hook" side is the row component's `useFragment`), but a connection reader has both.

### Do

Hook and twin both call the ONE shared pure fold fn.
```typescript
// hook (subscribes):
export function useSequenceChatRead(id: string): ChatRead {
  const data = useClientQuery(...);
  return chatReadFromRecords(recordsOfFragment(data));   // the ONE fold
}
// twin (imperative):
export function readSequenceChat(environment, id): ChatRead {
  const snap = environment.lookup(...);
  return chatReadFromRecords(recordsOfFragment(snap));   // same fold, no re-implementation
}
```

### Don't

Re-implement the fold in the twin (or the hook), so the two doors can drift.
```typescript
// Bad: the imperative twin re-derives the read by hand
export function readSequenceChat(env, id) {
  const rows = env.lookup(...);
  return rows.map((r) => ({ ... }));   // duplicates chatReadFromRecords — will drift
}
```

---

## cs:relay.projection.rig_bypass_prop

A TUI lens view exposes an optional `read?: <X>Read | null` prop as the rig/test seam: when supplied, the view renders the already-folded read directly; when absent, it delegates to a SEPARATE `Connected<X>View` component that calls the live `use<X>Read` hook. The split into two components is mandatory for rules-of-hooks — the live hook must not be called conditionally. `read` is the seam that lets a test drive the view with a fixed read without an environment.

### Do

Dispatch on read?; the live hook lives only in a separate Connected component.
```tsx
export function ChatView({ read: readProp }: { read?: ChatRead | null }) {
  if (readProp !== undefined) return <ChatCanvas read={readProp} />;   // rig path
  return <ConnectedChatView />;                                        // live path
}
function ConnectedChatView() {
  const read = useSequenceChatRead(id);   // hook isolated here — rules-of-hooks safe
  return <ChatCanvas read={read} />;
}
```

### Don't

Call the live hook conditionally in the same component the rig prop bypasses.
```tsx
// Bad: conditional hook call — breaks rules-of-hooks
export function ChatView({ read }: { read?: ChatRead | null }) {
  const live = read === undefined ? useSequenceChatRead(id) : null; // conditional hook
  return <ChatCanvas read={read ?? live} />;
}
```

---

## cs:relay.projection.row_use_fragment_subscription

A TUI row component reads its plain (non-@inline) row fragment via `useFragment` and re-renders IN PLACE when the record changes — the `useFragment` store subscription IS the update path; there is NO manual version-store poke. Glyphs come from the canonical, graph-pinned + fence-guarded encoding table (`HONESTY` in `lib/encodings/honesty.ts`), never a local literal. `solid` (the pending bit) drives the dashed-vs-solid draw off the subscribed record.

### Do

useFragment subscribes (no poke); glyphs from the pinned HONESTY table.
```tsx
const row = useFragment(fragmentNode, rowRef);   // the store subscription — re-renders in place
const glyph = HONESTY[present.honesty].glyph;    // the canonical pinned table, never a local literal
```

### Don't

Poke a version store to force a re-render, or inline a glyph literal.
```tsx
// Bad: a manual version-store poke instead of the useFragment subscription
bumpVersionStore(rowId);
// Bad: a local glyph literal instead of the pinned HONESTY table
const glyph = present.honesty === "loading" ? "◌" : "●";
```

---
