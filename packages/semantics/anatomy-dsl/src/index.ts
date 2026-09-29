export { parseAnatomyYAML } from "./parse.js";

export {
  PLACEHOLDER_SEGMENTS,
  STYLE_KEYS,
  type StyleKeyEntry,
  takesToken,
  type ValueKind,
} from "./registry.generated.js";

export { anatomyToTTL } from "./transform.js";
export type {
  AnonymousNode,
  Edge,
  NamedNode,
  Node,
  Projection,
  Prop,
  Relation,
  RelationProjection,
  Specification,
  Style,
  Switch,
  SwitchCase,
} from "./types.js";
export {
  AnatomyValueError,
  authoredSpelling,
  classifyElement,
  liftSymbols,
  type PrimitiveForm,
  parseStyleValue,
  RULES,
  type StyleValue,
  type ValueElement,
} from "./value.js";
