import { test, expect } from "@playwright/test";
import { unlockNew, navSidebar } from "./helpers";

test("crée un dossier œuvre et affiche la synthèse de provenance", async ({ page }) => {
  await unlockNew(page);

  await navSidebar(page, "/oeuvre");
  await expect(page.getByRole("heading", { name: "Vigilance œuvre" })).toBeVisible();

  // Le bouton n'est actif qu'avec au moins un titre ou un artiste.
  await page.getByLabel("Artiste", { exact: true }).fill("Pablo Picasso");
  await page.getByLabel("Titre", { exact: true }).fill("Nature morte");
  await page.getByRole("button", { name: "Lancer la vigilance" }).click();

  await expect(
    page.getByRole("heading", { name: "Synthèse de provenance" }),
  ).toBeVisible();
  // Sans aucun maillon renseigné, le moteur signale la provenance absente.
  await expect(page.getByText("Sous-scores")).toBeVisible();
});
