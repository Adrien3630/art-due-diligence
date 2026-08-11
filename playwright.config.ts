import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout (parcours réels dans un navigateur). Distincts des tests
// Vitest de logique pure (src/**/*.test.ts).
//
// En local : `next dev` (rechargement à chaud, pas de build préalable).
// En CI : `next start` sur le build de production — démarrage plus rapide et
// plus représentatif que `next dev` (dont le démarrage à froid dépassait parfois
// le délai du webServer). Le build est fait en amont par le workflow.
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // list pour le flux console ; html pour l'artefact archivé en CI (trace des échecs).
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
