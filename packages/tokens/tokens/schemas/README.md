# Official DTCG JSON Schemas — vendored

Fetched verbatim from the Design Tokens Community Group, and **not edited**.

| File | Source | Fetched |
|---|---|---|
| `format.json` | <https://designtokens.org/schemas/2025.10/format.json> | 2026-08-31 |
| `resolver.json` | <https://designtokens.org/schemas/2025.10/resolver.json> | 2026-08-31 |

They are vendored rather than fetched at test time for two reasons: a test
that reaches the network is a test that fails when the network does, and
conformance must be measured against a *pinned* specification — a schema that
changes underneath us would move the result without anyone deciding to.

Both declare JSON Schema draft-07 and carry `$id` under `www.designtokens.org`.

**To update**: re-fetch both, commit them in their own commit with the date
above changed, and read the conformance diff as a finding rather than noise —
a file that stops validating because the specification moved is a different
fact from one that stops validating because we changed it.
