# DataViews.PaginationBar

- **IRI (unchanged):** `ds:apps.subcomponent.data_table-pagination_bar`; implementations keep `@implements ds:apps.subcomponent.data_table-pagination_bar`.
- **Name (`ds:name`):** DataViews.PaginationBar, was DataTable.PaginationBar.
- **Parent (`ds:parentComponent`):** `ds:apps.pattern.data_views`, was `ds:apps.pattern.datatable`.
- **Properties:** pagination-mode, page-size-options, item-label and on-page-change are inherited from DataViews.

## Summary (`ds:summary`)

The pagination bar is anchored to the bottom of the view and lets users move between pages of records. It supports offset and keyset pagination, chosen by the backend's pagination model, with shared controls that differ in what they expose. Use it for machine inventories, order lists and logs too large to load at once.
