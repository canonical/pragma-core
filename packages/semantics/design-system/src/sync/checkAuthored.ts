/**
 * The law, run over the authored files rather than over the committed graph.
 *
 * `anatomies validate` runs the same law over `data/`, which is what the document
 * already holds. The write needs it over what is about to be SENT, so the check is
 * the composition `assertBindingsResolve` uses over a store, called with the two
 * inputs directly: the derivation's own findings (a cell that does not parse, a
 * dangling `uri:`) and then `checkBindings` over the records it derived. The
 * implementation — and the exit-code table it implements — is the one the transform
 * guard and `validate` run; only the source of the literals is different.
 *
 * The `uri:` check resolves against the committed graph's subjects PLUS the blocks
 * the authored files themselves name: a reference from one authored anatomy to
 * another must resolve even on the run that introduces both.
 *
 * It runs over every authored file, never only the one `--only` scopes the write to.
 * The law is a statement about the corpus, and a corpus with an unregistered symbol
 * in it is not made lawful by writing a different anatomy out of it.
 *
 * The authored path also closes the two vocabularies the parser leaves to the shapes:
 * a style key outside the roster and a state outside the state vocabulary are AT23
 * findings here. Over `data/` they are not checked, because a stale cell would stop
 * the daily sync; the authored files are what is about to be sent, so they are held
 * to the closed sets before they reach the document.
 */
import {
  type Node,
  parseAnatomyYAML,
  STYLE_KEYS,
  STYLE_STATES,
} from "@canonical/anatomy-dsl";
import type { AuthoredAnatomy } from "../anatomies/authored.js";
import { readCorpus } from "../anatomies/corpus.js";
import { readRegister } from "../anatomies/register.js";
import { tokenNamespaceOf } from "../transform/bindingGuard.js";
import { loadSymbolIndex } from "../transform/symbols.js";
import {
  type BindingFinding,
  checkBindings,
  childSteps,
  deriveBindingRecords,
  ROOT_STEP,
  UNKNOWN_KEY_CODE,
} from "../transform/tokenBindings.js";

export interface CheckAuthoredOptions {
  /** The directory of Turtle the `uri:` check resolves against. Defaults to `data/`. */
  dataDir?: string;
  /** The register that admits an exception. Defaults to the committed path. */
  registerPath?: string;
}

/** The AT23 findings for one node's styles and its descendants'. */
function findUnknownStyleKeys(
  block: string,
  node: Node,
  path: string,
): BindingFinding[] {
  const findings: BindingFinding[] = [];
  for (const style of node.styles ?? []) {
    if (!Object.hasOwn(STYLE_KEYS, style.key)) {
      findings.push({
        code: UNKNOWN_KEY_CODE,
        severity: "finding",
        message: `${block} ${path} ${style.key} is not a style key the roster holds`,
        block,
      });
    }
    if (
      style.state !== undefined &&
      !Object.hasOwn(STYLE_STATES, style.state)
    ) {
      findings.push({
        code: UNKNOWN_KEY_CODE,
        severity: "finding",
        message: `${block} ${path} ${style.key}@${style.state} names a state outside the vocabulary (${Object.keys(STYLE_STATES).join(", ")})`,
        block,
      });
    }
  }
  for (const child of childSteps(node)) {
    findings.push(
      ...findUnknownStyleKeys(block, child.node, `${path}/${child.step}`),
    );
  }
  return findings;
}

/**
 * The roster and state closure over every authored anatomy that parses. One that does
 * not parse is the derivation's to report, so it is passed over here.
 */
function checkVocabulary(
  anatomies: ReadonlyMap<string, string>,
): BindingFinding[] {
  return [...anatomies].flatMap(([block, text]) => {
    try {
      return findUnknownStyleKeys(
        block,
        parseAnatomyYAML(text).root,
        ROOT_STEP,
      );
    } catch {
      return [];
    }
  });
}

/**
 * Run the law over the authored anatomies.
 *
 * @returns every finding and warning, in the order the law produced them. A finding
 *   refuses the write; a warning is printed and the run proceeds.
 * @note Impure — reads `data/`, the register and the token strata.
 */
export default function checkAuthored(
  authored: readonly AuthoredAnatomy[],
  options: CheckAuthoredOptions = {},
): BindingFinding[] {
  const anatomies = new Map(authored.map((entry) => [entry.block, entry.text]));
  const corpus = readCorpus(options.dataDir);
  const blocks = new Set([...corpus.store.getSubjects(), ...anatomies.keys()]);
  const derivation = deriveBindingRecords(anatomies, blocks);

  return [
    ...derivation.findings,
    ...checkVocabulary(anatomies),
    ...checkBindings(derivation.records, {
      symbols: loadSymbolIndex(),
      register: readRegister(options.registerPath).rows,
      tokenNamespace: tokenNamespaceOf,
    }),
  ];
}
