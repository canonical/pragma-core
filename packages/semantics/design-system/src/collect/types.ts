/**
 * Configuration for collect-implementations command
 * Loaded from design-system.json in the target package
 */
export interface CollectConfig {
  /** Library name (e.g., "pragma-react") */
  name: string;

  /** Platform/framework (e.g., "react", "vue", "angular") */
  platform: string;

  /** Library description */
  description?: string;

  /** Main repository/package URL */
  link: string;

  /** Documentation URL if different from main link */
  documentation?: string;

  /** Design system tier reference (e.g., "ds:global") */
  tier?: string;

  /** Prefix configuration for the design system namespace */
  prefix: {
    /** Short prefix (e.g., "ds") */
    short: string;
    /** Full namespace URI (e.g., "https://ds.canonical.com/data/") */
    namespace: string;
  };

  // Glob pattern for files to scan (e.g., "src/**/*.tsx")

  pattern: string;

  /** Output directory for generated .ttl files (default: "data") */
  outputDir?: string;

  /**
   * Release version of the library (e.g., "0.35.0").
   * When set, emits ds:version on the library and enables versionedLink
   * generation for implementation objects.
   */
  version?: string;

  /**
   * Base URL of the source repository (e.g., "https://github.com/canonical/pragma").
   * When set, headLink/versionedLink are emitted as full blob URLs instead of
   * repo-relative paths.
   */
  repository?: string;

  /**
   * Path of the library within the repository (e.g., "packages/react/ds-global").
   * Prepended to file paths when building full blob URLs.
   */
  sourcePath?: string;

  /**
   * The package's public entry module, relative to the package root
   * (default: "src/index.ts").
   *
   * Read to decide which implementations get a ds:importStatement: a file the
   * barrel chain from here does not reach is not importable by name, so it gets
   * none. A package whose entry does not resolve emits no import statements at
   * all rather than guessing them.
   */
  entry?: string;
}

/**
 * Parsed annotation from a source file
 */
export interface ImplementsAnnotation {
  /** Full path to the source file */
  filePath: string;

  /** The block URI being implemented (e.g., "ds:global.component.button") */
  blockUri: string;

  /** Optional version of the implementation */
  version?: string;

  /** Whether this is a draft implementation */
  isDraft?: boolean;

  /** The prefix used in the annotation (e.g., "ds" or "syntax") */
  prefix?: string;
}
