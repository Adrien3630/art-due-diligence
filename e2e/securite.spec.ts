import { test, expect } from "@playwright/test";

// La création refuse une phrase trop faible et l'estimateur de force s'affiche.
test("phrase faible refusée + jauge de force (création du coffre)", async ({ page }) => {
  await page.goto("/");

  // Phrase trop courte/faible → jauge visible, création bloquée.
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill("azerty");
  await expect(page.getByLabel("Force de la phrase secrète")).toBeVisible();
  await page.getByPlaceholder("Confirmer la phrase secrète").fill("azerty");
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();
  // On reste sur l'écran de création (pas d'accès à l'app).
  await expect(page.getByRole("button", { name: "Chiffrer et continuer" })).toBeVisible();

  // Phrase de passe robuste → création acceptée.
  const strong = "cerise-tortue-lampe-nord-42";
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(strong);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(strong);
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();
});
