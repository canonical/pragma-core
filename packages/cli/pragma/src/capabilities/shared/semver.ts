/**
 * Is a published release strictly newer than the installed one?
 *
 * `info` and `upgrade` both ask whether an update exists, and both used to
 * answer "the dist-tag differs" — which calls a STALE tag an update. The
 * `experimental` dist-tag can lag the `latest` release (`0.43.0-experimental.1`
 * against a 0.44.0 CLI), so "differs" suggested a downgrade. This module is the
 * comparison both consumers share: strict semver precedence, prerelease sorted
 * per the spec, and `false` for equal / older / unparseable — never invent an
 * update the versions cannot justify.
 *
 * Like the pack-staleness comparator that precedes it (`runtime/packVersion`),
 * it carries NO semver dependency: the release triple comes from that module's
 * parser, and only the prerelease ordering (which that module deliberately
 * ignores) is local to this file.
 */

import { parseSemver } from "../../kernel/runtime/packVersion.js";

/** Whether a registry version is a strictly NEWER release than another. */
export function isSemverNewer(candidate: string, baseline: string): boolean {
  const candidateTriple = parseSemver(candidate);
  const baselineTriple = parseSemver(baseline);
  if (candidateTriple === undefined || baselineTriple === undefined) {
    return false;
  }
  for (let index = 0; index < 3; index++) {
    const diff =
      (candidateTriple[index] as number) - (baselineTriple[index] as number);
    if (diff !== 0) return diff > 0;
  }
  return comparePrerelease(candidate, baseline) > 0;
}

/**
 * Order two EQUAL-release versions by their prerelease (build metadata
 * ignored). Returns -1 / 0 / 1 per semver precedence: no prerelease beats any;
 * a shorter identifier list beats a longer one when all shared identifiers
 * tie; numeric identifiers sort below alphanumeric ones.
 */
function comparePrerelease(candidate: string, baseline: string): number {
  const candidateIds = prereleaseIdentifiers(candidate);
  const baselineIds = prereleaseIdentifiers(baseline);
  if (candidateIds.length === 0 && baselineIds.length === 0) return 0;
  if (candidateIds.length === 0) return 1;
  if (baselineIds.length === 0) return -1;

  const shared = Math.min(candidateIds.length, baselineIds.length);
  for (let index = 0; index < shared; index++) {
    const candidateId = candidateIds[index] as string;
    const baselineId = baselineIds[index] as string;
    const candidateNumeric = /^\d+$/.test(candidateId);
    const baselineNumeric = /^\d+$/.test(baselineId);
    if (candidateNumeric && baselineNumeric) {
      const diff = Number(candidateId) - Number(baselineId);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (candidateNumeric) {
      return -1;
    } else if (baselineNumeric) {
      return 1;
    } else if (candidateId !== baselineId) {
      return candidateId < baselineId ? -1 : 1;
    }
  }
  if (candidateIds.length === baselineIds.length) return 0;
  return candidateIds.length < baselineIds.length ? -1 : 1;
}

/** The prerelease identifiers of a version string ([] when it has none). */
function prereleaseIdentifiers(version: string): readonly string[] {
  const match =
    /-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)(?:\+[0-9A-Za-z-]+)?$/.exec(version);
  return match === null ? [] : match[1]!.split(".");
}
