import { test, expect } from "@playwright/test";
import { unlockNew, navSidebar } from "./helpers";

test("agrège une transaction acheteur seul et affiche la synthèse", async ({ page }) => {
  await unlockNew(page);

  await navSidebar(page, "/transaction");
  await expect(page.getByRole("heading", { name: "Dossier transaction" })).toBeVisible();

  // On exclut le vendeur pour n'avoir qu'un seul formulaire acteur (un champ « Nom »).
  await page.getByLabel("Inclure le vendeur").uncheck();

  // Le nom de l'acheteur suffit à activer la création du dossier.
  await page.getByLabel("Nom", { exact: true }).fill("Durand");
  await page.getByRole("button", { name: "Créer le dossier" }).click();

  await expect(
    page.getByRole("heading", { name: "Synthèse de la transaction" }),
  ).toBeVisible();
  // La synthèse agrège au moins le volet acheteur.
  await expect(page.getByText("Acheteur", { exact: true }).first()).toBeVisible();
});
