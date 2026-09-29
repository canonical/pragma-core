import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Parser } from "n3";
import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_SEGMENTS,
  STYLE_KEYS,
  takesToken,
} from "./registry.generated.js";
import {
  buildRegistry,
  DEFINITIONS,
  readRoster,
  serialiseRegistry,
  serialiseRegistryModule,
  serialiseStyleKeyIn,
} from "./registry.js";

const roster = readRoster();
const registry = buildRegistry();
const ttl = readFileSync(resolve(DEFINITIONS, "registry.ttl"), "utf8");
const shapes = readFileSync(resolve(DEFINITIONS, "shapes.ttl"), "utf8");

/**
 * The roster, as `definitions/style-keys.yaml` holds it. It moves when the
 * measurement in design-system is redone and lands here as a reviewed edit,
 * never on its own.
 */
const ROSTER_SIZE = 111;
const KIND_COUNTS = { token: 13, either: 45, primitive: 53 };
/** The keys that admit two namespaces rather than one: every `spacing.*`. */
const SPACING_KEYS = 18;

describe("the style-key registry", () => {
  it("holds the roster the committed file states", () => {
    expect(registry.keys).toHaveLength(ROSTER_SIZE);
    const counts = { token: 0, either: 0, primitive: 0 };
    for (const key of registry.keys) counts[key.valueKind]++;
    expect(counts).toEqual(KIND_COUNTS);
  });

  it("names every key as a Path, and sorts them", () => {
    for (const key of registry.keys) {
      expect(key.key).toMatch(/^[a-z]+(\.[A-Za-z0-9]+)+$/);
    }
    expect(registry.keys.map((k) => k.key)).toEqual(
      [...registry.keys.map((k) => k.key)].sort(),
    );
  });

  it("projects every namespace into the three spellings §4.2 requires", () => {
    for (const key of registry.keys) {
      if (key.valueKind === "primitive") {
        expect(key.tokenNamespace).toEqual([]);
        continue;
      }
      // A key states one base namespace or several, and each one is
      // projected into its own three spellings, grouped and in order.
      expect(key.tokenNamespace.length % 3).toBe(0);
      expect(key.tokenNamespace.length).toBeGreaterThan(0);
      for (let at = 0; at < key.tokenNamespace.length; at += 3) {
        const [base, modifier, surface] = key.tokenNamespace.slice(at, at + 3);
        expect(base).toMatch(/^[a-z]+\.$/);
        expect(modifier).toBe(`modifier.${base}`);
        expect(surface).toBe(`surface.${base}`);
      }
      // And a namespace is never stated twice, in any spelling.
      expect(new Set(key.tokenNamespace).size).toBe(key.tokenNamespace.length);
    }
  });

  it("gives a spacing key `dimension.` as well, for now", () => {
    // The implementations read `--dimension-*` directly for padding and gaps
    // and the semantic spacing namespace is still thin, so the roster admits
    // both rather than sending every real binding to the register. The
    // second namespace comes out when semantic spacing lands.
    for (const key of registry.keys) {
      if (!key.key.startsWith("spacing.")) continue;
      expect(key.tokenNamespace).toEqual([
        "spacing.",
        "modifier.spacing.",
        "surface.spacing.",
        "dimension.",
        "modifier.dimension.",
        "surface.dimension.",
      ]);
    }
    expect(
      registry.keys.filter((k) => k.key.startsWith("spacing.")),
    ).toHaveLength(SPACING_KEYS);
  });

  it("takes one namespace or a list, and reads them the same way", () => {
    // A one-element list is the scalar form's synonym: the roster may write
    // either, and nothing downstream can tell which was written.
    const scalar = buildRegistry({
      ...roster,
      provenance: { ...roster.provenance, keys: 1 },
      keys: {
        "typography.color": { valueKind: "either", namespace: "color." },
      } as unknown as typeof roster.keys,
    });
    const list = buildRegistry({
      ...roster,
      provenance: { ...roster.provenance, keys: 1 },
      keys: {
        "typography.color": { valueKind: "either", namespace: ["color."] },
      } as unknown as typeof roster.keys,
    });
    expect(list.keys).toEqual(scalar.keys);
    expect(scalar.keys[0]?.tokenNamespace).toEqual([
      "color.",
      "modifier.color.",
      "surface.color.",
    ]);
  });

  it("carries the channel spellings on the key the programme turns on", () => {
    // Without modifier.color. on typography.color, §3.6's
    // `[modifier.color.text, color.text]` — the central binding of the
    // programme — would be a namespace violation.
    const key = registry.keys.find((k) => k.key === "typography.color");
    expect(key?.tokenNamespace).toContain("modifier.color.");
    expect(key?.valueKind).toBe("either");
  });

  it("regenerates definitions/registry.ttl byte for byte", () => {
    expect(serialiseRegistry(registry)).toBe(ttl);
  });

  it("regenerates src/registry.generated.ts byte for byte", () => {
    expect(serialiseRegistryModule(registry)).toBe(
      readFileSync(
        resolve(DEFINITIONS, "..", "src", "registry.generated.ts"),
        "utf8",
      ),
    );
  });

  it("regenerates the closed styleKey sh:in of shapes.ttl", () => {
    const block = serialiseStyleKeyIn(registry);
    expect(shapes).toContain(block);
    // And the closed list IS the roster, member for member.
    const listed = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(listed).toEqual(registry.keys.map((k) => k.key));
  });

  it("parses as Turtle, with one StyleKey individual per key", () => {
    const quads = new Parser().parse(ttl);
    const individuals = quads.filter(
      (q) =>
        q.predicate.value ===
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
        q.object.value === "https://anatomy.canonical.com/StyleKey",
    );
    expect(individuals).toHaveLength(ROSTER_SIZE);
    const namespaces = quads.filter(
      (q) =>
        q.predicate.value === "https://anatomy.canonical.com/tokenNamespace",
    );
    // Three spellings per base namespace, and a spacing key states two.
    expect(namespaces).toHaveLength(
      3 * (KIND_COUNTS.token + KIND_COUNTS.either) + 3 * SPACING_KEYS,
    );
    expect(namespaces).toHaveLength(
      registry.keys.reduce((n, key) => n + key.tokenNamespace.length, 0),
    );
  });

  it("states its own provenance, and the stated size is the real one", () => {
    // The roster's evidence has moved to design-system, so the roster has to
    // say where: a vocabulary that cannot name its measurement reads as
    // opinion. `keys` is checked against the data, so the number in the file
    // — and in registry.ttl's header, which is rendered from it — cannot
    // drift from the roster it describes.
    expect(roster.provenance.keys).toBe(ROSTER_SIZE);
    expect(roster.provenance.stylesheets).toBe(89);
    expect(roster.provenance.measured).toBe("2026-09-10");
    expect(roster.provenance.measurement).toBe("canonical/design-system");
    expect(roster.provenance.packages).toEqual([
      "@canonical/react-ds-global@0.37.0",
      "@canonical/react-ds-global-form@0.37.0",
      "@canonical/lit-ds-prototype@0.37.0",
      "@canonical/react-ds-app-launchpad@0.37.0",
    ]);
    expect(ttl).toContain(`these ${ROSTER_SIZE} keys were measured`);
    expect(ttl).toContain("canonical/design-system");
    expect(() =>
      buildRegistry({
        ...roster,
        provenance: { ...roster.provenance, keys: 1 },
      }),
    ).toThrow(/states 1 keys and holds 111/);
  });

  it("refuses a roster that contradicts itself", () => {
    // valueKind and tokenNamespace are two readings of one fact, and the
    // graph carries both: the generator is where they are held together, now
    // that no corpus is there to decide.
    const one = (key: string, entry: Record<string, unknown>) => () =>
      buildRegistry({
        ...roster,
        provenance: { ...roster.provenance, keys: 1 },
        keys: { [key]: entry } as unknown as typeof roster.keys,
      });
    expect(one("appearance/background", { valueKind: "primitive" })).toThrow(
      /not a dotted path/,
    );
    expect(one("appearance.background", { valueKind: "symbol" })).toThrow(
      /valueKind must be one of/,
    );
    expect(
      one("layout.type", { valueKind: "primitive", namespace: "color." }),
    ).toThrow(/admits no token namespace/);
    expect(one("appearance.background", { valueKind: "either" })).toThrow(
      /owes a namespace/,
    );
    expect(
      one("appearance.background", { valueKind: "token", namespace: "color" }),
    ).toThrow(/ending in a dot/);
    // A list is held to every rule the scalar is held to, member by member.
    expect(
      one("appearance.background", {
        valueKind: "token",
        namespace: ["color.", "dimension"],
      }),
    ).toThrow(/ending in a dot/);
    expect(
      one("appearance.background", { valueKind: "token", namespace: [] }),
    ).toThrow(/the namespace list is empty/);
    expect(
      one("appearance.background", {
        valueKind: "token",
        namespace: ["color.", "color."],
      }),
    ).toThrow(/stated twice/);
    expect(
      one("appearance.background", {
        valueKind: "token",
        namespace: "color.",
        why: "nothing to explain",
      }),
    ).toThrow(/nothing to explain/);
    // And the roster as committed passes every one of them.
    expect(() => buildRegistry()).not.toThrow();
  });

  it("carries the stated exception on a primitive key, and nowhere else", () => {
    // A primitive key whose reference values read a `var()` anyway — a
    // component-local count, an asset — owes a reason, emitted as the key's
    // rdfs:comment so the exception is stated rather than silent.
    for (const key of registry.keys) {
      if (key.override === undefined) continue;
      expect(key.valueKind).toBe("primitive");
      expect(ttl).toContain(
        `rdfs:comment "primitive though the reference reads a var() here: ${key.override}"`,
      );
    }
    expect(registry.keys.filter((k) => k.override !== undefined)).toHaveLength(
      8,
    );
  });

  it("ships the same roster as TypeScript, for the transform", () => {
    expect(Object.keys(STYLE_KEYS)).toHaveLength(ROSTER_SIZE);
    expect(takesToken("typography.color")).toBe(true);
    expect(takesToken("appearance.border.color")).toBe(true);
    expect(takesToken("layout.type")).toBe(false);
    expect(takesToken("no.such.key")).toBe(false);
    expect(PLACEHOLDER_SEGMENTS).toEqual(["sth", "tbd", "xxx", "todo"]);
  });
});
