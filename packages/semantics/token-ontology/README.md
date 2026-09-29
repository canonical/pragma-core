# @canonical/token-ontology

The semantic model of the Canonical design tokens — the `dt:` ontology.

## Structure

| Path | Nature | Contents |
|---|---|---|
| `definitions/` | **authored** | The T-Box: `w3c-tokens.ttl` (spec mirror), `dt.ttl` (Canonical semantics), `dt.shapes.ttl` (constraints), `dt.s4.ttl` + `dt.s4.shapes.ttl` (the platform catalogue) and `dt.s4.context.jsonld` (its JSON projection). |
| `data/s1.ttl`, `s2.ttl`, `s3.ttl` | **generated** | The stratified A-Box. Never hand-edited — run `bun run populate`. |
| `data/s4.web.ttl` | **generated** | The web platform catalogue. Never hand-edited — run `bun run catalogue` after building `packages/tokens`. |
| `samples/` | **authored, non-normative** | Hand-written sample fragments for review. |
| `src/populate.ts` | tooling | Reads the token documents, the resolver and `s4.web.ttl`'s channel routing; writes `s1`–`s3`. |
| `src/catalogue.ts` | tooling | Reads the build's output; writes `s4.web` and runs its six laws. |
| `S4.DESIGN.md` | **authored** | How the platform catalogue was designed: the orientations tried, eight rulings with the alternative each beat, and the first run of its laws. |

## The generated data

`bun run populate` regenerates the first three strata from the authored source, and `bun run catalogue` the fourth from the build's output. Output
is deterministic: unchanged source produces byte-identical files, so a
vocabulary change is a re-run and a reviewable diff rather than a rewrite.

Run them in the order `catalogue → populate → catalogue`, which is what CI
regenerates and diffs. The catalogue goes first because `s3`'s channel values
are derived from the routing `s4.web.ttl` records, and again at the end because
its own inputs include what `populate` writes. The chain converges: a second
pass changes nothing.

| Stratum | Holds | Standing |
|---|---|---|
| `s1.ttl` | 45 files, 1,311 token definitions, 720 symbols, 56 annotated groups, the resolver with its 10 axes and 44 contexts | complete; round-trips to the source documents except for key order, which RDF does not carry |
| `s2.ttl` | one observed-coverage contract per non-empty axis, with the encoding bridge to `ds:`; the 25 channel symbols that coverage implies; the breakpoint axis is omitted now that it covers no semantic token | **a draft for review** — contracts are authored, not derived |
| `s3.ttl` | 1,237 resolved values: 1,072 along mode — one per symbol at the all-defaults position, one more for each symbol the theme family covers — and 165 channel routings, one per (channel × coordinate) pair the platform provisions | the positions the graph chooses to materialise |
| `s4.web.ttl` | 1,156 variables, 1,904 declarations under 31 conditions — every custom property the web build ships, verbatim, with the symbol it stands for and the coordinate its condition selects | one catalogue per platform; the bridge into `s3` is (symbol × position), verified complete for every variable that names a symbol |

Every symbol carries an `rdfs:label` holding its dotted name (745), and every
variable one holding its custom-property name with the leading `--` stripped
(1,156). Both are carried rather than derived: a consumer with only the IRI has
to choose a separator to recover a name, and `--color-text` cannot be typed as
a command-line argument at all. The two label sets are disjoint, so they can be
queried as one.

**Channels.** A channel is a token symbol whose value is not authored anywhere:
at the neutral position it has none, and at a coordinate of a covering family
it has the value of the symbol that family provisions there. `dt:modifier.X`
exists for every symbol X a local-rung family covers and `dt:surface.X` for
every X the layout-rung family covers, minted by `populate` from `dt:covers` —
25 today, matching 25 of the 28 channel variables the web build emits.
`dt:channelOf` names the symbol provisioned, and is the whole of what makes a
symbol a channel. Their nodes in `s3.ttl` come from the routing `s4.web.ttl`
records, name their source with `dt:derivedFrom`, and carry no resolution
chain: a route begins with the definition that won for the symbol, and a
channel is authored nowhere.

**A derived routing carries no value of its own.** A channel's node holds the
coordinate its platform declaration selects and the symbol it routes to, and
nothing more; the value is that symbol's, read at whatever position the
consumer wants. So the target's dark value is the channel's dark value by
construction rather than by a copy that could drift, and the node needs no mode
coordinate — with no value on it there is nothing for a mode to change, and no
channel declaration routes differently by mode. The invariant behind the size
of this stratum: **a derived routing carries exactly the coordinates its own
declaration selects, never a product of families.** Nine families offer 36
coordinates between them, so a materialised cross-product explodes and nothing
in the graph would stop a build emitting one; the count here is linear in the
platform's channel declarations and must stay so.

Absence of a position in `s3.ttl` asserts nothing about it: the graph holds what
it was asked to write down, not the whole permutation space. Two classes are
deliberately not emitted — values at interaction-state positions (a state has no
resolver context, so its position cannot yet be stated), and positions under a
modifier family for symbols that are not channels (materialisable on demand).
Nothing is stated at a neutral position for a channel either: there the channel
is unset, which is what a consumer's `var(--modifier-color-text,
var(--color-text))` says.

A resolution chain records whole-token hops only. Channel-level pointers inside
a terminal value compose one value from several definitions rather than
continuing a route; they appear in `s1.ttl` as `dt:refersTo`.

## Releases

The version in `package.json` and the entries in `CHANGELOG.md` are both
**generated**, by `lerna version --conventional-commits` — in CI from the
`Update package versions` workflow, or locally through the root
`version:manual` script. Both land in a single `chore: version bump to vX.Y.Z`
commit. So a change here never edits either by hand: the conventional-commit
subjects on the branch are what decide the next number, and a `feat` subject is
what makes this a minor release.

Namespaces: `dt:` (`https://dt.canonical.com/`) for Canonical semantics, with token
symbols minted from their dotted names (e.g. `dt:color.foreground.primary`);
`w3c-tokens:` (`https://dt.canonical.com/w3c-tokens/`) for the vocabulary
mirroring the token specification; `ds:` (`https://ds.canonical.com/`,
design-system repo) referenced, never redefined. Decision record: `pragma-adrs` session/C.
