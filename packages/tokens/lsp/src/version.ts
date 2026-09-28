import pkg from "./version.json" with { type: "json" };

/** The version string from the package's own package.json. */
export const VERSION: string = pkg.version;
