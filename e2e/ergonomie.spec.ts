import { test, expect } from "@playwright/test";
import { unlockNew, navSidebar } from "./helpers";

test("jauge de complétion visible et bascule acteur → transaction (#6, #4)", async ({ page }) => {
  await unlockNew(page);

  await navSidebar(page, "/acteur");
  await expect(page.getByRole("heading", { name: "Vigilance acteur" })).toBeVisible();
  // La jauge de complétion s'affiche sous le formulaire.
  await expect(page.getByText("Complétion du dossier")).toBeVisible();

  await page.getByLabel("Nom", { exact: true }).fill("Beaumont");
  await page.getByLabel("Prénom(s)", { exact: true }).fill("Claire");

  // Envoi vers le module Transaction en conservant la saisie (#4).
  await page.getByRole("button", { name: "Utiliser dans une transaction →" }).click();
  await expect(page.getByRole("heading", { name: "Dossier transaction" })).toBeVisible();
  // En mode « vente » (défaut), seul l'acheteur est saisi : la valeur est conservée.
  await expect(page.getByLabel("Nom", { exact: true }).first()).toHaveValue("Beaumont");
});

test("saisie rapide foire → dossier à finaliser dans l'historique (#13)", async ({ page }) => {
  await unlockNew(page);

  await navSidebar(page, "/foire");
  await expect(page.getByRole("heading", { name: "Prise d'option express" })).toBeVisible();

  await page.getByLabel("Nom du client", { exact: true }).fill("Client Foire");
  await page.getByLabel("Montant (€)", { exact: true }).fill("4000");
  await page.getByRole("button", { name: "Enregistrer (à finaliser)" }).click();

  // Évaluation primaire non probante affichée.
  await expect(page.getByRole("heading", { name: "Évaluation primaire" })).toBeVisible();

  // Le dossier est enregistré et marqué « À finaliser » dans l'historique.
  await navSidebar(page, "/historique");
  await expect(page.getByText("À finaliser").first()).toBeVisible();
  await expect(page.getByText("Client Foire").first()).toBeVisible();
});
