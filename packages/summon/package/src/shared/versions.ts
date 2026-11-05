/**
 * The two release lines a scaffolded package can depend on.
 *
 * The packages a generated package imports come from two repositories, each
 * released on its own version line:
 *
 * - **pragma-core** — the toolchain this generator ships with: `biome-config`,
 *   `webarchitect` and the plain `typescript-config`. Pinned to this
 *   generator's own version, since it is released in lockstep with them.
 * - **pragma-web** — everything that renders or describes a rendering stack:
 *   `typescript-config-react`, `typescript-config-svelte`, `svelte-ssr-test`
 *   and `storybook-config`. Pinned to `PRAGMA_WEB_VERSION`.
 *
 * The two lines happen to share a number today; treating them as one is still
 * wrong, because the next release of either repository moves only its own.
 * The application generator carries the same distinction (see
 * `packages/summon/application/src/shared/versions.ts`); a third consumer is
 * the point at which the constant moves to `summon-core`.
 */

/** The pragma-web release every web-side dependency is pinned to. */
export const PRAGMA_WEB_VERSION = "0.45.0";
