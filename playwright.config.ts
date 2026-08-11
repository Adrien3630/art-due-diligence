import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout (parcours réels dans un navigateur). Distincts des tests
// Vitest de logique pure (src/**/*.test.ts). Lancent l'app via `next dev`.
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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
