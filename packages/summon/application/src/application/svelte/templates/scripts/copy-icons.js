import { cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The SSR build serves the design-system icons from a route; a static host has
// no routes, so the client-only build ships them as files at the same URLs.
const assets = dirname(
  fileURLToPath(import.meta.resolve("@canonical/ds-assets/package.json")),
);
await cp(join(assets, "icons"), "static/icons", { recursive: true });
