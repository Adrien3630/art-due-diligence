import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Les apostrophes françaises (« l'œuvre ») dans le JSX rendent correctement
      // et sont omniprésentes dans cette UI francophone. Règle bruyante désactivée.
      "react/no-unescaped-entities": "off",
      // L'app lit son état persisté (réglages, coffre chiffré) APRÈS le montage :
      // window / IndexedDB n'existent pas au SSR, donc un initialiseur useState est
      // impossible. Le pattern useEffect(() => setX(load())) est ici volontaire.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
