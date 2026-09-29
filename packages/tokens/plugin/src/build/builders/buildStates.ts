/**
 * Build helper for states.css — NativeState derivation layer.
 */
import { makeDerivedArtifactToken } from "../../artifact/index.js";
import type { Artifact } from "../../artifact/types.js";
import {
  createDeclaration,
  createRule,
  printRules,
} from "../../css-ast/index.js";
import type { CSSNode } from "../../css-ast/types.js";
import { wrapInLayer } from "../../layers/index.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import { convertTokenIdToCssVar } from "../../naming.js";
import { HEADER } from "../constants/header.js";
import { interactiveRoles } from "../constants/interactiveRoles.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { OutputFileFn, ResolverLike, TokenLike } from "../shims.js";
import type { InteractiveRole } from "../types.js";
import buildFallbackChain from "./buildFallbackChain.js";

/** @note Mutates `artifact`, calls `outputFile`. */
export default function buildStates(
  _tokens: Record<string, TokenLike>,
  _resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  emittedProperties: EmittedPropertyRegistry,
  roles: InteractiveRole[] = interactiveRoles,
) {
  const derivedDecls: CSSNode[] = [];

  for (const { role, states, hasSurface, hasModifier } of roles) {
    const cssRole = convertTokenIdToCssVar(role); // e.g. --color-foreground-primary
    const rolePath = cssRole.slice(2); // color-foreground-primary

    // Build fallback chain: modifier → surface → base
    const restFallback = buildFallbackChain(cssRole, hasModifier, hasSurface);
    const bgFallback = buildFallbackChain("--color-background", false, true);

    for (const state of states) {
      const derivedVar = `--${state}--${rolePath}`;

      let formula: string;
      if (state === "disabled") {
        // color-mix(in oklch, <rest> 34%, <background>)
        formula = `color-mix(in oklch, ${restFallback} 34%, ${bgFallback})`;
      } else {
        // oklch(from <rest> calc(l + var(--delta-{state}-{role})) c h)
        const deltaVar = `--delta-${state}-${rolePath}`;
        formula = `oklch(from ${restFallback} calc(l + var(${deltaVar})) c h)`;
      }

      emittedProperties.register(derivedVar, `derived:${derivedVar}`);
      derivedDecls.push(createDeclaration(derivedVar, formula));

      artifact[derivedVar] = makeDerivedArtifactToken({
        cssVar: derivedVar,
        type: "color",
        tier: "derived",
        visibility: "internal",
        cssOutputFile: "states.css",
        derivedFrom: cssRole,
        derivation: state as "hover" | "active" | "disabled",
      });
    }
  }

  const starRule = createRule(["*"], derivedDecls);
  const wrapped = wrapInLayer(layers.states, [starRule]);
  outputFile("states.css", `${HEADER}\n${printRules(wrapped)}\n`);
}
