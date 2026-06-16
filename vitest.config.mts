import { defineConfig } from "vitest/config";

// Tests de LOGIQUE PURE (moteur de risque, référentiels). Pas de DOM, pas de
// React : environnement Node, aucun plugin nécessaire.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
