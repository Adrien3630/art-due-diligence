import { test, expect } from "@playwright/test";
import { unlockNew, navSidebar } from "./helpers";

test("crée un dossier acteur et affiche la vigilance simplifiée", async ({ page }) => {
  await unlockNew(page);

  await navSidebar(page, "/acteur");
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
