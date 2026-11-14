/**
 * `isSemverNewer` — the strictly-newer semver comparison behind the update
 * checks in `info` and `upgrade`.
 *
 * The regression this pins: an update was reported whenever the registry's
 * dist-tag merely DIFFERED from the running version, so a lagging tag — e.g.
 * `experimental` at `0.43.0-experimental.1` against an installed `0.44.0` —
 * suggested a downgrade. Only a strictly greater release is an update.
 */

import { describe, expect, it } from "vitest";
import { isSemverNewer } from "./semver.js";

describe("isSemverNewer — strict semver precedence", () => {
  it("a greater major / minor / patch release is an update", () => {
    expect(isSemverNewer("1.0.0", "0.9.0")).toBe(true);
    expect(isSemverNewer("0.11.0", "0.10.9")).toBe(true);
    expect(isSemverNewer("0.0.2", "0.0.1")).toBe(true);
  });

  it("an equal release is not an update (build metadata ignored)", () => {
    expect(isSemverNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isSemverNewer("1.0.0+build.7", "1.0.0")).toBe(false);
  });

  it("an OLDER release is not an update — the lagging-dist-tag regression", () => {
    expect(isSemverNewer("0.43.0-experimental.1", "0.44.0")).toBe(false);
    expect(isSemverNewer("0.9.0", "1.0.0")).toBe(false);
  });

  it("a prerelease is older than the same release without one", () => {
    expect(isSemverNewer("1.0.0-rc.1", "1.0.0")).toBe(false);
    expect(isSemverNewer("1.1.0-alpha", "1.0.0")).toBe(true);
  });

  it("orders prerelease identifiers per the semver spec", () => {
    // Numeric identifiers compare numerically, not lexically.
    expect(isSemverNewer("1.0.0-beta.11", "1.0.0-beta.2")).toBe(true);
    expect(isSemverNewer("1.0.0-beta.2", "1.0.0-beta.11")).toBe(false);
    // A numeric identifier is LOWER precedence than an alphanumeric one.
    expect(isSemverNewer("1.0.0-alpha", "1.0.0-1")).toBe(true);
    expect(isSemverNewer("1.0.0-1", "1.0.0-alpha")).toBe(false);
    // A shorter identifier list is lower precedence than a longer one.
    expect(isSemverNewer("1.0.0-alpha.1", "1.0.0-alpha")).toBe(true);
    expect(isSemverNewer("1.0.0-alpha", "1.0.0-alpha.1")).toBe(false);
    // Alphanumeric identifiers order by ASCII value.
    expect(isSemverNewer("1.0.0-alpha.beta", "1.0.0-alpha.zeta")).toBe(false);
    expect(isSemverNewer("1.0.0-alpha.zeta", "1.0.0-alpha.beta")).toBe(true);
    // alpha < alpha.beta < beta < beta.2 < beta.11 < rc.1 < the release.
    expect(isSemverNewer("1.0.0-beta.11", "1.0.0-alpha.zeta")).toBe(true);
    expect(isSemverNewer("1.0.0-alpha.beta", "1.0.0-beta")).toBe(false);
  });

  it("never invents an update from an unparseable version", () => {
    expect(isSemverNewer("banana", "1.0.0")).toBe(false);
    expect(isSemverNewer("1.0.0", "banana")).toBe(false);
    expect(isSemverNewer("1.0", "1.0.0")).toBe(false);
    expect(isSemverNewer("", "1.0.0")).toBe(false);
    expect(isSemverNewer("1.0.0", "")).toBe(false);
  });
});
