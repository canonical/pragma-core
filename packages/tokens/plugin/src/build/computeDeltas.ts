import { makeDerivedArtifactToken } from "../artifact/index.js";
import type { Artifact } from "../artifact/types.js";
import { createDeclaration } from "../css-ast/index.js";
import { convertTokenIdToCssVar } from "../naming.js";
import { interactiveRoles } from "./constants/interactiveRoles.js";
import type EmittedPropertyRegistry from "./emittedPropertyRegistry.js";
import { extractOklchL } from "./extractOklchL.js";
import { formatDelta } from "./formatDelta.js";
import type { ResolverLike, TokenMap } from "./shims.js";
import type { DeltaDeclarations, InteractiveRole } from "./types.js";

/**
 * Compute per-role lightness deltas for hover/active states.
 *
 * Deltas must be emitted as plain numbers — NOT wrapped in `light-dark()` —
 * because `var(--delta-*)` is consumed inside `calc()` inside `oklch(from ...)`,
 * and `light-dark()` inside `calc()` inside `oklch(from ...)` is broken in
 * Chromium (resolves to transparent). The chosen approach (per the design spec)
 * is: `:root` sets the light-mode delta as default; `.dark` and
 * `@media (prefers-color-scheme: dark)` override with dark-mode deltas.
 * The `@media` block must NOT set `color-scheme` — doing so would override
 * `.light { color-scheme: light }` by source order (same specificity).
 *
 * @note impure — mutates `artifact` by writing delta token entries.
 */
export function computeDeltas(
  _tokens: TokenMap,
  resolver: ResolverLike,
  artifact: Artifact,
  emittedProperties: EmittedPropertyRegistry,
  roles: InteractiveRole[] = interactiveRoles,
): DeltaDeclarations {
  const lightSet = resolver.apply({ theme: "light" });
  const darkSet = resolver.apply({ theme: "dark" });
  const lightDeltaDecls: DeltaDeclarations["lightDeltaDecls"] = [];
  const darkDeltaDecls: DeltaDeclarations["darkDeltaDecls"] = [];

  for (const { role, states } of roles) {
    for (const state of states) {
      if (state === "disabled") {
        continue;
      }

      const stateId = `${role}.${state}`;
      const lightRest = lightSet[role];
      const lightState = lightSet[stateId];
      const darkRest = darkSet[role];
      const darkState = darkSet[stateId];

      if (!lightRest?.$value || !lightState?.$value) {
        continue;
      }
      if (!darkRest?.$value || !darkState?.$value) {
        continue;
      }

      const lightRestL = extractOklchL(lightRest.$value);
      const lightStateL = extractOklchL(lightState.$value);
      const darkRestL = extractOklchL(darkRest.$value);
      const darkStateL = extractOklchL(darkState.$value);

      if (
        lightRestL === null ||
        lightStateL === null ||
        darkRestL === null ||
        darkStateL === null
      ) {
        continue;
      }

      const lightDelta = lightStateL - lightRestL;
      const darkDelta = darkStateL - darkRestL;
      const lightDeltaValue = formatDelta(lightDelta);
      const darkDeltaValue = formatDelta(darkDelta);

      const rolePath = convertTokenIdToCssVar(role).slice(2);
      const deltaVar = `--delta-${state}-${rolePath}`;
      const derivedFrom = convertTokenIdToCssVar(role);

      emittedProperties.register(deltaVar, `derived:${deltaVar}`);
      lightDeltaDecls.push(createDeclaration(deltaVar, lightDeltaValue));
      darkDeltaDecls.push(createDeclaration(deltaVar, darkDeltaValue));

      artifact[deltaVar] = makeDerivedArtifactToken({
        cssVar: deltaVar,
        type: "number",
        tier: "derived",
        visibility: "internal",
        cssOutputFile: "modifiers.theme.css",
        derivedFrom,
        derivation: "delta",
        valueLight: lightDeltaValue,
        valueDark: darkDeltaValue,
      });
    }
  }

  return { lightDeltaDecls, darkDeltaDecls };
}
