# DataTable

- **IRI (unchanged):** `ds:apps.pattern.datatable`
- **Subcomponents (`ds:hasSubcomponent`):** drops `ds:apps.subcomponent.data_table-pagination_bar` and `ds:apps.subcomponent.data_table-action_bar`.
- **Properties (`ds:hasProperty`):** drops selection-mode, unique-identifier-field, max-selection-count, on-selection-change, pagination-mode, page-size-options, item-label, on-page-change, bulk-actions and on-bulk-action, which DataViews owns.

## Summary (`ds:summary`)

The data table presents structured data in rows and columns, with sorting, row selection, inline editing, column management and grouping. It suits application products where users work with medium to large datasets, and it adapts across viewport sizes. Use it for machine inventories, user lists and job histories, where users compare records attribute by attribute. Each of its parts is documented as a separate subcomponent.
