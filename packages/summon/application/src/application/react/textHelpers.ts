/**
 * Text helpers for the templates. A string a reader sees renders as a catalog
 * lookup when the app is internationalised and as the English text otherwise,
 * so a template states each string once, beside its key, instead of carrying
 * an `intl` branch per line. The three forms cover the three places a string
 * appears in TSX; a message with values keeps an explicit branch, because its
 * English form is a template literal.
 */
export interface TextHelpers {
  /** A JSX child: `{t("key")}` or the English text. */
  readonly msg: (key: string, english: string) => string;
  /** A JSX attribute value: `{t("key")}` or `"English"`. */
  readonly attr: (key: string, english: string) => string;
  /** A JavaScript expression: `t("key")` or `"English"`. */
  readonly str: (key: string, english: string) => string;
}

export function textHelpers(intl: boolean): TextHelpers {
  const call = (key: string) => `t(${JSON.stringify(key)})`;

  return {
    msg: (key, english) => (intl ? `{${call(key)}}` : english),
    attr: (key, english) => (intl ? `{${call(key)}}` : JSON.stringify(english)),
    str: (key, english) => (intl ? call(key) : JSON.stringify(english)),
  };
}
