import { describe, expect, it, vi } from "vitest";
import detectRuntime from "./detectRuntime.js";

describe("detectRuntime", () => {
  it("returns the override without probing the environment", async () => {
    const probeRuntime = vi.fn(async () => false);

    await expect(detectRuntime("node", probeRuntime)).resolves.toBe("node");
    expect(probeRuntime).not.toHaveBeenCalled();
  });

  it("prefers bun when it is available", async () => {
    const probeRuntime = vi.fn(async (command: string) => command === "bun");

    await expect(detectRuntime("", probeRuntime)).resolves.toBe("bun");
    expect(probeRuntime).toHaveBeenCalledTimes(1);
    expect(probeRuntime).toHaveBeenCalledWith("bun", ["--version"]);
  });

  it("falls back to node when bun is unavailable and node >= 22 exists", async () => {
    const probeRuntime = vi.fn(async (command: string) => command === "node");

    await expect(detectRuntime("", probeRuntime)).resolves.toBe("node");
    expect(probeRuntime).toHaveBeenNthCalledWith(1, "bun", ["--version"]);
    expect(probeRuntime).toHaveBeenNthCalledWith(
      2,
      "node",
      ["--version"],
      /^v(?:2[2-9]|[3-9]\d|\d{3,})(?:\.|$)/,
    );
  });

  it("returns null when neither bun nor node >= 22 is available", async () => {
    const probeRuntime = vi.fn(async () => false);

    await expect(detectRuntime("", probeRuntime)).resolves.toBeNull();
    expect(probeRuntime).toHaveBeenCalledTimes(2);
  });
});
