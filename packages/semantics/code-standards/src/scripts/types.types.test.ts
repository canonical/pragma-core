import { describe, expectTypeOf, it } from "vitest";
import type {
  Category,
  Example,
  Found,
  GenerateDocsOptions,
  Standard,
} from "./types.js";

describe("types", () => {
  it("gives a standard its examples", () => {
    expectTypeOf<Standard["dos"]>().toEqualTypeOf<readonly Example[]>();
  });

  it("lets a category gather standards", () => {
    expectTypeOf<Category["standards"]>().toEqualTypeOf<Standard[]>();
    expectTypeOf<Category["broader"]>().toEqualTypeOf<string | null>();
  });

  it("locates a match by its start and end", () => {
    expectTypeOf<Found>().toEqualTypeOf<{
      readonly index: number;
      readonly end: number;
      readonly text: string;
    }>();
  });

  it("requires the folders and a log", () => {
    // @ts-expect-error The log is required.
    const options: GenerateDocsOptions = { dataDir: "data", outputDir: "docs" };
    expectTypeOf(options.log).toEqualTypeOf<(line: string) => void>();
  });
});
