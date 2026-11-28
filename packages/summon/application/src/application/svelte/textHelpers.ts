/**
 * Text helpers for the Svelte templates, the counterpart of the React
 * generator's: a string a reader sees renders as a catalog lookup when the app
 * is internationalised and as the English text otherwise, so a template states
 * each string once, beside its key. A message with values keeps an explicit
 * branch, because its English form is a template literal.
 *
 * Svelte reads `{` in markup and in a quoted attribute as the start of an
 * expression, so English text that holds a brace, an angle bracket or a quote
 * renders as a string expression instead of literal text.
 */
export interface TextHelpers {
  /** Markup text: `{t("key")}` or the English text. */
  readonly msg: (key: string, english: string) => string;
  /** An attribute value: `{t("key")}` or `"English"`. */
  readonly attr: (key: string, english: string) => string;
  /** A JavaScript expression: `t("key")` or `"English"`. */
  readonly str: (key: string, english: string) => string;
}

const MARKUP = /[{}<>&]/;
const ATTRIBUTE = /[{}"]/;

export function textHelpers(intl: boolean): TextHelpers {
  const call = (key: string) => `t(${JSON.stringify(key)})`;
  const expression = (english: string) => `{${JSON.stringify(english)}}`;

  return {
    msg: (key, english) =>
      intl
        ? `{${call(key)}}`
        : MARKUP.test(english)
          ? expression(english)
          : english,
    attr: (key, english) =>
      intl
        ? `{${call(key)}}`
        : ATTRIBUTE.test(english)
          ? expression(english)
          : JSON.stringify(english),
    str: (key, english) => (intl ? call(key) : JSON.stringify(english)),
  };
}
