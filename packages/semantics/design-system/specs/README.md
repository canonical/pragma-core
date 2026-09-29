# specs/ — drafted block specifications

Standalone specifications for NEW components and patterns drafted by the
`specify-component` and `specify-pattern` skills, and anatomy drafts (from
`anatomy-author`) for EXISTING blocks whose `ds:anatomyDsl` is still empty. They live
here because `data/` is regenerated destructively from Coda by CI
(`.github/workflows/sync-coda.yml`) — any hand edit there is overwritten by the next
scheduled sync.

- One file per drafted block: `specs/<tier>.<type>.<snake_name>.{md,ttl}`
  (e.g. `specs/global.component.carousel.md`), markdown or Turtle following the
  ontology structure (`pragma ontology lookup ds`). An anatomy-only draft for an
  existing block uses the same name — `specs/<tier>.<type>.<snake_name>.md` with just
  the anatomy section.
- A spec here is a DRAFT awaiting entry into the database of record (Coda). Entry is the
  deferred documentation write path; until then a human pastes the content.
- Nothing under `specs/` is read by the build or the sync.
