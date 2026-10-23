import { InlineCode } from "@canonical/react-ds-global";
import type { ReactElement } from "react";
import type { CodeMessageProps } from "./types.js";

/**
 * A paragraph that names code. The message marks code names with backticks,
 * as Markdown does, and each one renders as the design system's `InlineCode`,
 * so a translator writes a natural sentence and the names stay exactly as
 * they are in the source.
 *
 * `import { CodeMessage } from "#lib/index.js";`
 */
export default function CodeMessage({
  message,
  ...props
}: CodeMessageProps): ReactElement {
  // Splitting on backticks leaves prose at even positions and code at odd
  // ones. The parts of one message never reorder, so a part's position and
  // text identify it.
  const parts = message.split("`").map((text, position) => ({
    key: `${position}:${text}`,
    code: position % 2 === 1,
    text,
  }));

  return (
    <p {...props}>
      {parts.map(({ key, code, text }) =>
        code ? <InlineCode key={key}>{text}</InlineCode> : text,
      )}
    </p>
  );
}
