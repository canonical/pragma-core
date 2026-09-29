/** Surface selector compounding by context depth. */
export const SURFACE_SELECTOR_MAP: Record<string, string> = {
  layer1: ".surface",
  layer2: ".surface .surface",
  layer3: ".surface .surface .surface",
  // `contrasted` is a polarity axis, not a depth: it must not compound like the
  // layers, so it uses a flat, non-compounding class selector.
  contrasted: ".contrasted",
  // `modal` is the identity surface (same tokens as layer1 / `.surface`) exposed
  // under a distinct, non-compounding class so modal content can opt in directly.
  modal: ".modal",
};
