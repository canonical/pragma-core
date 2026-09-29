import { canonicalPlugin } from "@canonical/terrazzo-plugin-css";
import { defineConfig } from "@terrazzo/cli";
import interactiveRoles from "./contracts/interactiveRoles.json" with {
  type: "json",
};
import lineHeightExceptions from "./contracts/lineHeightExceptions.json" with {
  type: "json",
};
import productBaseline from "./contracts/productBaseline.json" with {
  type: "json",
};
import cssProfile from "./profiles/css.json" with { type: "json" };

export default defineConfig({
  tokens: ["./tokens/canonical/canonical.resolver.json"],
  outDir: "./dist/",
  lint: {
    rules: {
      "core/consistent-naming": ["warn", { format: "camelCase" }],
    },
  },
  // The config does the importing, so neither package depends on the other.
  // `contracts/` is platform-neutral S2 and is read by the ontology populator
  // too; `profiles/css.json` is the CSS projection and is read only here.
  plugins: [
    canonicalPlugin({
      contracts: {
        ...interactiveRoles,
        ...productBaseline,
        ...lineHeightExceptions,
      },
      profile: cssProfile,
    }),
  ],
});
