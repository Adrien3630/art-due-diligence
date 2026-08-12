import { expect, type Page } from "@playwright/test";

export const PASS = "phrase-secrete-e2e-123";

// Crée le coffre puis laisse l'app déverrouillée (en mémoire). Point d'entrée
// commun à tous les parcours : sans coffre, aucune page métier n'est accessible.
export async function unlockNew(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(PASS);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(PASS);
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();
  // Écran de clé de récupération (coffre v2) → on confirme l'avoir notée.
  await page.getByRole("button", { name: "J'ai noté ma clé — continuer" }).click();
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();
}

// Navigation client-side via la barre latérale (préserve le coffre en mémoire,
// contrairement à goto). Scopé à la nav : les cartes d'accueil pointent aussi
// vers ces routes.
export async function navSidebar(page: Page, href: string): Promise<void> {
  await page.getByRole("navigation").locator(`a[href="${href}"]`).click();
}
