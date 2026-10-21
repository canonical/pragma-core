import { route } from "@canonical/router-core";
import CatalogPage from "./CatalogPage.js";
import warmCatalog from "./warmCatalog.js";

const routes = {
  catalog: route({
    url: "/catalog",
    // Fills the prefetch environment's store with the first catalog page, so
    // `useLazyLoadQuery` (store-or-network) reads it without a second
    // request. No data is passed to the component. On the client the route
    // never waits for it; the server awaits it before rendering.
    warm: warmCatalog,
    content: CatalogPage,
  }),
} as const;

export default routes;
