# DataViews

- **IRI:** `ds:apps.pattern.data_views`
- **Type:** `ds:Pattern`
- **Name (`ds:name`):** DataViews
- **Tier (`ds:tier`):** `ds:apps`
- **Subcomponents (`ds:hasSubcomponent`):** `ds:apps.subcomponent.data_table-pagination_bar`, `ds:apps.subcomponent.data_table-action_bar`, `ds:apps.subcomponent.data_views-filters`, `ds:apps.subcomponent.data_views-sort_panel`, `ds:apps.subcomponent.data_views-saved_views`
- **Anatomy (`ds:anatomyDsl`):** `anatomies/authored/apps/apps.pattern.data_views.yaml`
- **Documentation stage (`ds:documentationStage`):** `ds:tag.needscoredocumentation`

## Summary (`ds:summary`)

DataViews presents one collection of records with search, filters, sorting, pagination and saved views around a renderer, such as a table or cards. Every part reads and edits the same view, so each renderer shows the same query and the same selection. Use it for machine inventories, order lists and audit logs, where users narrow a large collection and act on what they find.

## Usage (`ds:usage`)

### When to use

- A collection users search, filter, sort or page through, as a table, cards or both

### When not to use

- A short, fixed list: use a table or a list on its own

## Guidelines (`ds:guidelines`)

### States & interaction

- Every part edits one view, so a change in one shows in every renderer.
- A search or filter change returns to the first page.
- The action bar shows only while records are selected; persistent selection spans pages.

### Accessibility

- Every part is labelled, and a change with no visible result is announced in one polite live region.
- Without scripting, search, filters and pagination work as links and GET forms.

## Properties (`ds:hasProperty`)

| Name | Type | Optional | Constraints | Default | Summary |
|---|---|---|---|---|---|
| selection-mode | choice | true | Views with grouping and selection use persistent. | none | Simple selection is page-scoped and dropped on navigation; persistent selection spans pages, sorting and filtering. |
| unique-identifier-field | text | true | Required when selection-mode is not none. | | The field that identifies each record across pages. |
| max-selection-count | number | true | A positive integer. | | The most records a user can select. |
| on-selection-change | callback | true | | | Called with the selected record identifiers. |
| pagination-mode | choice | true | Keyset is incompatible with grouping and sorting. | none | Offset navigates to any page; keyset moves forward and back only. |
| page-size-options | list of text | true | Each value is a positive integer. | 50, 75, 100 | The page sizes offered; the first is the default. |
| item-label | text | true | | items | The noun the pagination bar uses for the records, such as "machines". |
| on-page-change | callback | true | | | Called with the target page and page size when the user changes page. |
| bulk-actions | object | true | At most 7 top-level actions; the deselect button does not count. | | The actions shown while records are selected, each a label and an optional icon, standalone or grouped in a menu. |
| on-bulk-action | callback | true | | | Called with the action and the selected record identifiers. |

## Parts

| Part | `@implements` |
|---|---|
| DataViews | `ds:apps.pattern.data_views` |
| Search | `ds:global.subcomponent.search_input` |
| Filters | `ds:apps.subcomponent.data_views-filters` |
| Sort panel | `ds:apps.subcomponent.data_views-sort_panel` |
| Saved views | `ds:apps.subcomponent.data_views-saved_views` |
| Table | `ds:apps.pattern.datatable` |
| Cards | `ds:global.group.cards` |
| Column settings | `ds:apps.subcomponent.data_table-settings_menu` |
| Action bar | `ds:apps.subcomponent.data_table-action_bar` |
| Pagination bar | `ds:apps.subcomponent.data_table-pagination_bar` |
