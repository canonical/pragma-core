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
 */
import type { AuthoredAnatomy } from "../anatomies/authored.js";
import { readCorpus } from "../anatomies/corpus.js";
import { readRegister } from "../anatomies/register.js";
import { tokenNamespaceOf } from "../transform/bindingGuard.js";
import { loadSymbolIndex } from "../transform/symbols.js";
import {
  type BindingFinding,
  checkBindings,
  deriveBindingRecords,
} from "../transform/tokenBindings.js";

export interface CheckAuthoredOptions {
  /** The directory of Turtle the `uri:` check resolves against. Defaults to `data/`. */
  dataDir?: string;
  /** The register that admits an exception. Defaults to the committed path. */
  registerPath?: string;
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
    ...checkBindings(derivation.records, {
      symbols: loadSymbolIndex(),
      register: readRegister(options.registerPath).rows,
      tokenNamespace: tokenNamespaceOf,
    }),
  ];
}
