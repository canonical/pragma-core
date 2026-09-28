/**
 * Wrap two values in `light-dark()`. Returns the plain value if both are identical.
 *
 * @example wrapLightDark("oklch(0.5 0.1 200)", "oklch(0.8 0.1 200)") => "light-dark(oklch(0.5 0.1 200), oklch(0.8 0.1 200))"
 * @example wrapLightDark("#000", "#000") => "#000"
 */
export default function wrapLightDark(light: string, dark: string): string {
  if (light === dark) {
    return light;
  }
  return `light-dark(${light}, ${dark})`;
}
