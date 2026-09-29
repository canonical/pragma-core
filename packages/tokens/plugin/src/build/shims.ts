/**
 * Internal type shims — avoid coupling to @terrazzo/parser internal types.
 *
 * These lightweight interfaces match the shape that the Terrazzo plugin
 * runtime passes into `transform()` and `build()` hooks, without importing
 * from @terrazzo/parser directly.
 */

/** Primitive transform payload value. */
export type TransformValue = string | Record<string, string>;

/** Source location metadata attached by the resolver. */
export interface TokenSourceLike {
  loc?: unknown;
  filename?: string;
}

/** Shared token metadata for resolver and transform hooks. */
export interface BaseTokenLike {
  $type?: string;
  $value?: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
  id?: string;
  source?: TokenSourceLike;
  aliasOf?: string;
  aliasChain?: string[];
}

/** Color token shape used by theme and state logic. */
export interface ColorTokenLike extends BaseTokenLike {
  $type: "color";
}

/** Typography token shape used by typography transforms. */
export interface TypographyTokenLike extends BaseTokenLike {
  $type: "typography";
}

/** Generic token shape used when the exact type is not yet known. */
export interface UnknownTypedTokenLike extends BaseTokenLike {
  $type?: Exclude<string, "color" | "typography">;
}

/** Minimal token shape for classification and transform hooks. */
export type TokenLike =
  | BaseTokenLike
  | ColorTokenLike
  | TypographyTokenLike
  | UnknownTypedTokenLike;

/** Token dictionary threaded through transform/build hooks. */
export type TokenMap = Record<string, TokenLike>;

/** Resolved token dictionary returned by the resolver. */
export type ResolvedTokenMap = Record<string, TokenLike>;

/** Callback signature for registering per-token transforms. */
export interface SetTransformParams {
  format: string;
  localID?: string;
  value: TransformValue;
  input?: Record<string, string>;
  meta?: Record<string, unknown>;
}

/** Callback signature for registering per-token transforms. */
export type SetTransformFn = (id: string, params: SetTransformParams) => void;

/** Shared fields carried by all transform results. */
export interface BaseTransformResult<TToken extends TokenLike = TokenLike> {
  id: string;
  localID?: string;
  input: Record<string, string>;
  token: TToken;
}

/** A single-value transform result returned by `getTransforms()`. */
export interface SingleValueTransformResult<
  TToken extends TokenLike = TokenLike,
> extends BaseTransformResult<TToken> {
  type: "SINGLE_VALUE";
  value: string;
}

/** A multi-value transform result returned by `getTransforms()`. */
export interface MultiValueTransformResult<TToken extends TokenLike = TokenLike>
  extends BaseTransformResult<TToken> {
  type: "MULTI_VALUE";
  value: Record<string, string>;
}

/** Any transform result returned by `getTransforms()`. */
export type TransformResult<TToken extends TokenLike = TokenLike> =
  | SingleValueTransformResult<TToken>
  | MultiValueTransformResult<TToken>;

/** Query-style callback for retrieving registered transforms. */
export type GetTransformsFn = (params: {
  format: string;
  id?: string | string[];
  $type?: string | string[];
  input?: Record<string, string>;
}) => TransformResult[];

/** Minimal resolver shape used by build helpers. */
export interface ResolverLike {
  apply(input: Record<string, string>): ResolvedTokenMap;
  source?: {
    modifiers?: Record<string, { contexts?: Record<string, unknown[]> }>;
  };
}

/** Callback for writing output files. */
export type OutputFileFn = (
  filename: string,
  contents: string | Uint8Array,
) => void;

/** Narrow a token to the color-token shape. */
export function isColorTokenLike(token: TokenLike): token is ColorTokenLike {
  return token.$type === "color";
}

/** Narrow a transform result to a single-value payload. */
export function isSingleValueTransformResult(
  result: TransformResult,
): result is SingleValueTransformResult {
  return result.type === "SINGLE_VALUE";
}
