import { describe, expect, it } from "vitest";
import type { Artifact } from "../../artifact/types.js";
import type { CSSNode } from "../../css-ast/types.js";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { TransformResult } from "../shims.js";
import emitTypographyDecls from "./emitTypographyDecls.js";

function makeSingle(
  id: string,
  value: string,
  input: Record<string, string> = {},
): TransformResult {
  return {
    id,
    localID: `--${id.replaceAll(".", "-")}`,
    type: "SINGLE_VALUE",
    value: value as string & Record<string, string>,
    input,
    token: { $type: "typography", $description: `${id} description` },
  };
}

function makeMulti(
  id: string,
  value: Record<string, string>,
  input: Record<string, string> = {},
): TransformResult {
  return {
    id,
    localID: `--${id.replaceAll(".", "-")}`,
    type: "MULTI_VALUE",
    value: value as string & Record<string, string>,
    input,
    token: { $type: "typography", $description: `${id} description` },
  };
}

describe("emitTypographyDecls", () => {
  it("emits a single declaration for single-value transforms", () => {
    const decls: CSSNode[] = [];
    const artifact: Artifact = {};

    emitTypographyDecls(
      makeSingle("typography.heading.large", "700"),
      decls,
      artifact,
      "modifiers.typography.css",
      undefined,
      undefined,
      new EmittedPropertyRegistry(),
    );

    expect(decls).toHaveLength(1);
    expect(artifact["--typography-heading-large"]).toMatchObject({
      id: "typography.heading.large",
      valueLight: "700",
      valueDark: "700",
    });
  });

  it("splits multi-value transforms into sub-property declarations", () => {
    const decls: CSSNode[] = [];
    const artifact: Artifact = {};

    emitTypographyDecls(
      makeMulti("typography.heading.large", {
        "font-size": "2rem",
        "line-height": "2.5rem",
      }),
      decls,
      artifact,
      "modifiers.typography.css",
      undefined,
      undefined,
      new EmittedPropertyRegistry(),
    );

    expect(decls).toHaveLength(2);
    expect(artifact["--typography-heading-large-font-size"]).toMatchObject({
      id: "typography.heading.large.font-size",
    });
    expect(artifact["--typography-heading-large-line-height"]).toMatchObject({
      id: "typography.heading.large.line-height",
    });
  });
});
