/** Color-scheme mapping for the theme modifier. */
export interface ThemeColorScheme {
  /** Resolver context name that maps to CSS `color-scheme: light`. */
  light: string;
  /** Resolver context name that maps to CSS `color-scheme: dark`. */
  dark: string;
  /** Which context is the default. @default "light" */
  default: string;
}

/** CSS selectors for theme output. */
export interface ThemeSelectors {
  /** Merged `light-dark()` block selector. @default ":root" */
  root?: string;
  /** `color-scheme: light` override selector. @default ".light" */
  light?: string;
  /** `color-scheme: dark` override selector. @default ".dark" */
  dark?: string;
}

/** Theme modifier configuration. */
export interface ThemeConfig {
  /** Resolver modifier name. */
  modifier: string;
  /** Color-scheme mapping. */
  colorScheme: ThemeColorScheme;
  /** Override CSS selectors. */
  selectors?: ThemeSelectors;
  /** Media query feature name, or `false` to omit. @default "prefers-color-scheme" */
  media?: string | false;
}

/** Fully resolved theme config with defaults applied. */
export interface ResolvedThemeConfig {
  modifier: string;
  light: string;
  dark: string;
  defaultScheme: string;
  rootSelector: string;
  lightSelector: string;
  darkSelector: string;
  media: string | false;
}

/** A light/dark value pair for theme-aware tokens. */
export interface LightDarkPair {
  /** CSS variable name (without `var()`). */
  property: string;
  /** Light-mode CSS value. */
  light: string;
  /** Dark-mode CSS value. */
  dark: string;
}
