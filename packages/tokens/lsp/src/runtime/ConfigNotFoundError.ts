const CONFIG_FILENAME = "terrazzo-lsp.config.json";

/** Error raised when no Terrazzo LSP config can be found. */
export default class ConfigNotFoundError extends Error {
  readonly searchStart: string;
  readonly searchedPaths: string[];

  constructor(searchStart: string, searchedPaths: string[]) {
    super(`No ${CONFIG_FILENAME} found from ${searchStart}`);
    this.name = "ConfigNotFoundError";
    this.searchStart = searchStart;
    this.searchedPaths = searchedPaths;
  }

  getLogLines(): string[] {
    return [
      `Config not found: ${CONFIG_FILENAME}`,
      `Search start: ${this.searchStart}`,
      ...this.searchedPaths.map((filePath) => `Tried: ${filePath}`),
      'Create one with: { "artifacts": ["path/to/tokens.json"] }',
    ];
  }
}
