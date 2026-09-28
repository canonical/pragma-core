export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 1_000_000) / 1_000_000;
  return String(rounded);
}
