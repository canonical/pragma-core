import { convertTokenIdToCssVar, prefixVar } from "../../naming.js";

/** Build a map from channel CSS variable to description. */
export default function buildDescriptionLookup(
  descriptions: Record<string, string>,
  prefix: string,
): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const [tokenId, description] of Object.entries(descriptions)) {
    const channelVar = prefixVar(convertTokenIdToCssVar(tokenId), prefix);
    lookup[channelVar] = description;
  }
  return lookup;
}
