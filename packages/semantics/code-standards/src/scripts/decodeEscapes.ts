const CHARACTER_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  t: "\t",
  b: "\b",
  n: "\n",
  r: "\r",
  f: "\f",
  '"': '"',
  "'": "'",
  "\\": "\\",
});

/** Decodes a Turtle string's escapes. Throws on one Turtle does not define. */
export default function decodeEscapes(raw: string): string {
  return raw.replace(
    /\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|[\s\S])/g,
    (sequence, body: string) => {
      if (body.length > 1) {
        return String.fromCodePoint(Number.parseInt(body.slice(1), 16));
      }
      const decoded = CHARACTER_ESCAPES[body];
      if (decoded === undefined) {
        throw new Error(`Unknown escape ${sequence}`);
      }
      return decoded;
    },
  );
}
