import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests de logique pure + route handlers. Environnement Node, aucun plugin React.
// L'alias "@" reflète celui de tsconfig pour permettre d'importer les routes.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
