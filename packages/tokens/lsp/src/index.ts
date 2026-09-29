/**
 * Public API barrel export for terrazzo-lsp.
 */

// CSS domain
export {
  buildSelectorContext,
  classifySelectorScope,
  compareFallbackStaleness,
  extractCssImports,
  extractJsImports,
  extractPackageName,
  extractUnit,
  formatFileUri,
  isAssignable,
  isBareSpecifier,
  isExternalPath,
  isSuppressed,
  MATH_FUNCTIONS,
  mapDtcgType,
  parseFileUri,
  parseSuppressionDirectives,
  parseSyntaxType,
  resolveDimensionValue,
  resolveImportSpecifier,
  SUBTYPE_RELATIONS,
  scanDeclarations,
  scanProperties,
  scanUsages,
} from "./css/index.js";

// Graph domain
export {
  loadArtifact,
  parseArtifactToken,
  ReachabilityCache,
  TokenGraph,
} from "./graph/index.js";
// Protocol domain
export {
  createRequest,
  isCompletionRequest,
  isDefinitionRequest,
  isDiagnosticsRequest,
  isHoverRequest,
  isReferencesRequest,
  matchResponse,
  resolveConfig,
} from "./protocol/index.js";
// Providers domain
export {
  classifyProvenance,
  produceDiagnostics,
  provideCompletions,
  provideHover,
  resolveDefinition,
} from "./providers/index.js";
export type { NavigationTier, TooltipOptions } from "./providers/types.js";
export type {
  FileSystem,
  GraphWorker,
  GraphWorkerOptions,
  PendingUpdate,
} from "./runtime/index.js";
// Runtime domain
export {
  buildImportGraph,
  createGraphWorker,
  rescanFile,
  scheduleBufferUpdate,
} from "./runtime/index.js";

// Types (all type exports)
export type {
  AtRuleContext,
  CodeAction,
  Color,
  ColorInformation,
  ColorPresentation,
  CompletionItem,
  CompletionItemKind,
  ConfigFileResult,
  ConfigurableSeverity,
  CssContext,
  CssValueType,
  DeclarationNode,
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  DiagnosticsConfig,
  DtcgType,
  FileNode,
  HoverConfig,
  InlayHintsConfig,
  Location,
  LocationLink,
  MarkupContent,
  OklchComponents,
  Position,
  PropertyNode,
  PropertyTypeSet,
  Range,
  RangeConstraint,
  RawArtifact,
  RawArtifactToken,
  RawConfig,
  RawWrappedArtifact,
  ResolvedConfig,
  ResolvedHoverConfig,
  ResolvedInlayHintsConfig,
  ScopeType,
  SelectorContext,
  SharedArtifactTier,
  SharedKnownTokenTier,
  SuppressionDirective,
  TerrazzoLspPlugin,
  TextDocumentContentChangeEvent,
  TextEdit,
  TokenGraphData,
  TokenNode,
  TokenProvenance,
  UsageNode,
  WorkerRequest,
  WorkerResponse,
  WorkspaceEdit,
} from "./types/index.js";
