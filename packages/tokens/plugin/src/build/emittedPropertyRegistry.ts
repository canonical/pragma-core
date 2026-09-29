/**
 * Tracks the source owner of every custom property emitted by a build.
 * Re-emitting one property for another product context is valid when the owner
 * is unchanged; two distinct source paths normalising to one property are not.
 */
export default class EmittedPropertyRegistry {
  readonly #owners = new Map<string, string>();

  register(property: string, owner: string): void {
    const existing = this.#owners.get(property);
    if (existing !== undefined && existing !== owner) {
      throw new Error(
        `[canonical-css] Emitted property collision: ${property} is owned by both ${existing} and ${owner}`,
      );
    }
    this.#owners.set(property, owner);
  }
}
