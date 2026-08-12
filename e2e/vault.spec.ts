import { test, expect } from "@playwright/test";
import { PASS } from "./helpers";

// Le parcours de sécurité le plus critique : création du coffre chiffré, puis
// verrouillage (au rechargement la clé en mémoire est purgée) et déverrouillage.
test("création, rejet d'une mauvaise phrase, puis déverrouillage du coffre", async ({
  page,
}) => {
  await page.goto("/");

  // Contexte navigateur vierge → aucun coffre → mode création.
  await expect(page.getByRole("heading", { name: "Protéger vos données" })).toBeVisible();
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(PASS);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(PASS);
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();

  // Écran de clé de récupération (v2) : elle est affichée puis confirmée.
  await expect(page.getByRole("heading", { name: "Votre clé de récupération" })).toBeVisible();
  await page.getByRole("button", { name: "J'ai noté ma clé — continuer" }).click();

  // L'application est rendue.
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();

  // Rechargement complet → mémoire purgée, coffre persistant (IndexedDB) → déverrouillage.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Déverrouiller le coffre" })).toBeVisible();

  // Mauvaise phrase rejetée.
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill("mauvaise-phrase");
  await page.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(page.getByText("Phrase secrète incorrecte")).toBeVisible();

  // Bonne phrase → accès rétabli.
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(PASS);
  await page.getByRole("button", { name: "Déverrouiller" }).click();
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();
});
