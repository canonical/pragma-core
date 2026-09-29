import { describe, expect, it } from "vitest";
import { walkTokenTree } from "./modifierIo.js";

describe("walkTokenTree", () => {
  it("collects $description values", () => {
    const tree = {
      color: {
        text: {
          $value: "{color.palette.neutral.100}",
          $description: "Primary text colour",
        },
      },
    };
    const descriptions: Record<string, string> = {};
    walkTokenTree(tree, [], descriptions);
    expect(descriptions["color.text"]).toBe("Primary text colour");
  });

  it("handles $root by collapsing to parent path", () => {
    const tree = {
      color: {
        $root: {
          $value: "{color.palette.black}",
          $description: "The page colour",
        },
      },
    };
    const descriptions: Record<string, string> = {};
    walkTokenTree(tree, [], descriptions);
    expect(descriptions.color).toBe("The page colour");
  });

  it("describes a token only where one is written", () => {
    const tree = {
      color: {
        bg: { $value: "{color.palette.white}", $type: "color" },
        fg: { $value: "{color.palette.black}", $description: "Ink" },
      },
    };
    const descriptions: Record<string, string> = {};
    walkTokenTree(tree, [], descriptions);
    expect(Object.keys(descriptions)).toEqual(["color.fg"]);
  });

  it("skips non-object nodes", () => {
    const descriptions: Record<string, string> = {};
    walkTokenTree(null, [], descriptions);
    walkTokenTree("string", [], descriptions);
    expect(Object.keys(descriptions)).toHaveLength(0);
  });
});
