import type {
  InteractiveRole,
  SetConfig,
  StatesConfig,
  TypographyConfig,
} from "../build/types.js";
import type { LayerConfig } from "../layers/types.js";
import type {
  LightDarkPair,
  ResolvedThemeConfig,
  ThemeColorScheme,
  ThemeConfig,
  ThemeSelectors,
} from "../light-dark/types.js";
import type {
  MediaModifierConfig,
  ModifierContext,
  OverlayToken,
  SurfaceConfig,
} from "../modifiers/types.js";

export type {
  LayerConfig,
  LightDarkPair,
  MediaModifierConfig,
  ModifierContext,
  OverlayToken,
  ResolvedThemeConfig,
  SetConfig,
  StatesConfig,
  SurfaceConfig,
  ThemeColorScheme,
  ThemeConfig,
  ThemeSelectors,
  TypographyConfig,
};

/** Platform-neutral S2 contract data (`contracts/*.json`). */
export interface ContractsConfig {
  /** Interactive roles and the state variants each provisions. */
  roles?: InteractiveRole[];

  /** Require the canonical baseline in every built-in product context. */
  requireProductBaseline?: boolean;

  /** Reviewed semantic typography roles allowed to use a half baseline. */
  lineHeightExceptions?: LineHeightException[];
}

/** Exact rational number used by the baseline lattice contract. */
export interface RationalCount {
  numerator: number;
  denominator: number;
}

/** A reviewed half-step family and its required phase evidence. */
export interface LineHeightException {
  product: string;
  rootRole: string;
  members: string[];
  baselineCount: RationalCount;
  reason: string;
  visualEvidence: {
    singleLine: string;
    multiline: string;
  };
}

/** Platform-specific S4 projection data (`profiles/css.json`). */
export interface CssProfile {
  /** Resolver context name to the CSS selector that selects it. */
  surfaceSelectors?: Record<string, string>;
  /**
   * Which `--surface-*` variables each context emits, by CSS-variable name
   * without the `--surface-` prefix.
   *
   * DECLARED rather than inferred. Emission used to be derived from the shape
   * of the modifier source — whatever a context file happened to rebind, plus
   * a value-comparison heuristic for the rest — which made the emitted API a
   * function of how the source was authored. Restructuring the source then
   * moved the output, so the source could not be corrected without moving it.
   *
   * The sets are deliberately NOT uniform: `contrasted` emits one more than
   * the layers (`color-text`), and that asymmetry is a real fact about what
   * that context covers.
   */
  surfaceEmits?: Record<string, readonly string[]>;

  /**
   * Which of a context's emitted variables are RESETS — emitted as
   * `--surface-x: var(--x)`, sending a nested surface back to the unmodified
   * value rather than overriding it.
   *
   * These have no source token and cannot have one. A reset used to be
   * authored as an alias naming the node it sat on
   * (`color.background: "{color.background.$root}"`), which worked only
   * because the override sat *beside* `$root` rather than on it — the §6.1
   * violation doing semantic work. With the override at `$root`, that alias
   * is circular, so the statement moves here.
   *
   * Every name here must also appear in `surfaceEmits` for the same context,
   * and must NOT be produced by the source: the build fails either way.
   */
  surfaceResets?: Record<string, readonly string[]>;
}

/** Top-level plugin options. */
export interface CanonicalPluginOptions {
  /** CSS @layer names. */
  layers?: Partial<LayerConfig>;

  /** Set configurations (primitive, semantic). */
  sets?: {
    primitive?: SetConfig;
    semantic?: SetConfig;
  };

  /** Theme modifier (light/dark with light-dark()). */
  theme?: ThemeConfig;

  /** Typography modifier. */
  typography?: TypographyConfig;

  /** Modifier family names (e.g. ["anticipation", "criticality"]). */
  families?: string[];

  /** Motion preference modifier. */
  motion?: MediaModifierConfig;

  /** Contrast preference modifier. */
  contrast?: MediaModifierConfig;

  /** Surface configuration. Maps resolver context names to CSS selectors. */
  surfaces?: SurfaceConfig;

  /** NativeState derivation layer. */
  states?: StatesConfig;

  /**
   * Platform-neutral S2 contracts, read from `contracts/*.json`.
   *
   * Passed IN rather than imported, because the ontology package already
   * depends on this plugin's output: importing its contracts here would
   * close a package cycle. The populator reads the same files from disk, so
   * the two agree by construction rather than by discipline.
   *
   *  the roles compiled into `constants/interactiveRoles.ts`
   */
  contracts?: ContractsConfig;

  /**
   * Platform-specific S4 projection, read from `profiles/css.json`.
   *
   * Separate from `contracts` because it is the half a second platform will
   * NOT share: selector strategy is a CSS fact, coverage is not.
   *
   *  the map compiled into `constants/surfaceSelectorMap.ts`
   */
  profile?: CssProfile;

  /**
   * Base directory for token source files.
   * Used to locate modifier source files and read DTCG alias targets.
   * @default "./tokens/canonical"
   */
  tokensDir?: string;
}
