import { test, expect, type Page } from "@playwright/test";

const PASS = "phrase-secrete-e2e-123";

// Crée le coffre puis laisse l'app déverrouillée (en mémoire).
async function unlockNew(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(PASS);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(PASS);
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();
}

test("crée un dossier acteur et affiche la vigilance simplifiée", async ({ page }) => {
  await unlockNew(page);

  // Navigation client-side (préserve le coffre en mémoire, contrairement à goto).
  // Scopé à la barre latérale : la page d'accueil expose aussi une carte /acteur.
  await page.getByRole("navigation").locator('a[href="/acteur"]').click();
  await expect(page.getByRole("heading", { name: "Vigilance acteur" })).toBeVisible();

  await page.getByLabel("Nom", { exact: true }).fill("Martin");
  await page.getByRole("button", { name: "Créer le dossier client" }).click();

  // Résultat : sans signal de risque (mode démo, nom neutre) → vigilance simplifiée.
  await expect(page.getByRole("heading", { name: "Dossier Client" })).toBeVisible();
  // Le badge de niveau (texte exact) ; « Vigilance simplifiée » apparaît aussi
  // dans les explications, d'où exact:true pour ne cibler que la pastille.
  await expect(
    page.getByText("Vigilance simplifiée", { exact: true }),
  ).toBeVisible();
});
