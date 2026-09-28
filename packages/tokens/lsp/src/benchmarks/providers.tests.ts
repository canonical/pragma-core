import { describe, expect, it } from "vitest";
import { loadArtifact, ReachabilityCache, TokenGraph } from "../graph/index.js";
import { resolveConfig } from "../protocol/index.js";
import {
  produceDiagnostics,
  provideCompletions,
  provideHover,
} from "../providers/index.js";
import type { RawArtifact, ResolvedConfig } from "../types/index.js";

// ---------------------------------------------------------------------------
// Fixtures — generate a realistic-sized graph with 200 tokens
// ---------------------------------------------------------------------------

function buildLargeArtifact(count: number): RawArtifact {
  const tokens: RawArtifact["tokens"] = {};
  for (let i = 0; i < count; i++) {
    const name = `--color-${i.toString(36).padStart(4, "0")}`;
    tokens[name] = {
      cssVar: name,
      id: `color.${i}`,
      isPaired: false,
      type: "color",
      value: `#${(i * 97).toString(16).padStart(6, "0").slice(0, 6)}`,
      tier: i % 5 === 0 ? "primitive" : "semantic",
      cssOutputFile: "/project/dist/tokens.css",
    };
  }
  return { version: "1.0.0", generator: "bench", tokens };
}

function buildLargeSource(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `--color-${i.toString(36).padStart(4, "0")}`;
    lines.push(`.sel-${i} { color: var(${name}); }`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const ARTIFACT = buildLargeArtifact(200);
const graph = new TokenGraph();
loadArtifact(ARTIFACT, graph);

const config: ResolvedConfig = resolveConfig({}, "/project");
const cache = new ReachabilityCache();

const source = buildLargeSource(200);
const fileUri = "file:///project/src/app.css";

/** Measure the median of N runs in milliseconds. */
function measureMs(fn: () => void, iterations = 10): number {
  // Warm up
  fn();
  fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

// ---------------------------------------------------------------------------
// Performance gate tests
// ---------------------------------------------------------------------------

describe("Provider performance (P8.8)", () => {
  it("provideCompletions completes in < 50 ms (200 tokens)", () => {
    const ms = measureMs(() =>
      provideCompletions(fileUri, graph, cache, config, source, {
        line: 50,
        character: 25,
      }),
    );
    expect(ms).toBeLessThan(50);
  });

  it("provideHover completes in < 10 ms (200 tokens)", () => {
    const ms = measureMs(() =>
      provideHover("--color-0032", fileUri, graph, config),
    );
    expect(ms).toBeLessThan(10);
  });

  it("produceDiagnostics completes in < 100 ms (200 usages)", () => {
    const ms = measureMs(() =>
      produceDiagnostics(fileUri, source, graph, cache, config),
    );
    expect(ms).toBeLessThan(100);
  });
});
