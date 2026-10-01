# Preface

The traps that make an anatomy YAML document fail to parse or to resolve. Read this before writing or changing an anatomy, whether in a file or in the Coda document the sync reads.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

`anatomy-dsl check <files…>` parses anatomy text the way the sync does, from files or from text piped to it; the [README](../README.md) describes it. The language itself is specified in the `anatomy-author` skill.

# Important

- **An anatomy is a YAML mapping with exactly one top-level `node:` key.** Variants go in one tree with `switch`, or become separate blocks.
- **`motion.property` is a primitive, written as one comma-separated string** (`transform, display`), never a YAML list. A list is read as a fallback chain of tokens ending in one literal, and fails with `primitiveNotLast`.
- **A named `uri:` must name an existing block.** A dangling one blocks the sync unless the exception register that `anatomies validate --write-register` writes admits it. A part with no block of its own is an anonymous node with a `role:`.
- **Style values name dotted symbols that exist in the token ontology.** Slash token paths (`color/background/default`) are retired.
