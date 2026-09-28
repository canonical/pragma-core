/**
 * Compute modifier channel declarations for a single family context.
 *
 * A context overrides a token when the RESOLVER says so. Every resolved token
 * carries `aliasChain` — the aliases the resolver followed, nearest first — so
 * comparing the base's chain with the context's says both whether the context
 * changed anything and what it changed it to.
 *
 * This used to take an `aliasMap` read back out of the raw modifier JSON,
 * because neither of the other two strategies works. Comparing `$value` misses
 * a rebind that lands on the same colour: `color.foreground.ghost` under
 * `layer3` resolves to the same white as the base, so every layer3 override
 * read as absent. Comparing `source.loc` is worse — the resolver normalises it
 * to the resolver file's own URL, so it is constant. Both are still true. What
 * changed is that neither needs the source files: the resolver already
 * publishes the chain.
 *
 * @param family    - Family name (e.g. "anticipation")
 * @param context   - Context name (e.g. "constructive")
 * @param baseTokens  - Base-resolution token map (from `resolver.apply({})`)
 * @param overlayTokens - Context-resolution token map
 * @param prefix    - CSS variable prefix (default: "modifier"). Use "surface" for surface layers.
 * @param selectorOverride - Selector to use instead of `.{context}`.
 * @returns A `ModifierContext` with computed declarations.
 */
import createDeclaration from "../css-ast/createDeclaration.js";
import { convertTokenIdToCssVar, prefixVar } from "../naming.js";
import type { ModifierContext, OverlayToken } from "./types.js";

/**
 * The first alias hop where the overlay's chain leaves the base's — the alias
 * this context actually changed, and the one a declaration should name.
 *
 * A context that rebinds `color.foreground.input` also changes what everything
 * aliasing it resolves to. `color.foreground.checkbox.unselected` still names
 * `color.foreground.input` as its own target, exactly as the base does; what
 * moved is one hop further along. Taking the first hop would name the base
 * token and lose the modifier; taking the end of the chain would name the
 * final value and lose the authored target for a direct rebind. The divergence
 * point is the one answer that is right in both cases.
 */
function divergentAlias(
  base: OverlayToken,
  overlay: OverlayToken,
): { at: number; target: string } | undefined {
  const theirs = base.aliasChain ?? [];
  const ours = overlay.aliasChain ?? [];
  for (let i = 0; i < ours.length; i++) {
    if (theirs[i] !== ours[i]) return { at: i, target: ours[i] };
  }
  return undefined;
}

/** Whether two resolved tokens hold different values. */
function valueDiffers(base: OverlayToken, overlay: OverlayToken): boolean {
  if (base.$value === undefined || overlay.$value === undefined) return false;
  return JSON.stringify(base.$value) !== JSON.stringify(overlay.$value);
}

export default function computeModifierContext(
  family: string,
  context: string,
  baseTokens: Record<string, OverlayToken>,
  overlayTokens: Record<string, OverlayToken>,
  prefix = "modifier",
  selectorOverride?: string,
): ModifierContext {
  const declarations = [];

  for (const [id, overlay] of Object.entries(overlayTokens)) {
    const base = baseTokens[id];
    if (!base) {
      continue;
    }

    // A channel is emitted when the context rebinds THIS token — its own
    // first hop moved — or when the token's value actually moves. A token
    // that merely aliases something the context rebound, and lands on the same
    // value anyway, needs no declaration: it already follows through the
    // variable it names.
    const diverged = divergentAlias(base, overlay);
    if (diverged?.at !== 0 && !valueDiffers(base, overlay)) {
      continue;
    }

    const cssVar = convertTokenIdToCssVar(id);
    const channelVar = prefixVar(cssVar, prefix);
    const target = diverged?.target ?? overlay.aliasOf;
    const aliasTarget = target ? convertTokenIdToCssVar(target) : cssVar;
    declarations.push(createDeclaration(channelVar, `var(${aliasTarget})`));
  }

  return {
    family,
    context,
    selector: selectorOverride ?? `.${context}`,
    declarations,
  };
}
