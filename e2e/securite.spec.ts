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
  await page.getByRole("button", { name: "J'ai noté ma clé — continuer" }).click();
  await expect(
    page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" }),
  ).toBeVisible();
});

// Parcours « phrase oubliée » : la clé de récupération rouvre le coffre.
test("récupération par clé + nouvelle phrase", async ({ page }) => {
  await page.goto("/");
  const pass = "premiere-phrase-secrete-42";
  await page.getByPlaceholder("Phrase secrète", { exact: true }).fill(pass);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(pass);
  await page.getByRole("button", { name: "Chiffrer et continuer" }).click();

  // Récupère la clé affichée puis confirme.
  await expect(page.getByRole("heading", { name: "Votre clé de récupération" })).toBeVisible();
  const code = (await page.locator(".font-mono").first().innerText()).trim();
  await page.getByRole("button", { name: "J'ai noté ma clé — continuer" }).click();
  await expect(page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" })).toBeVisible();

  // Recharge → déverrouillage ; on emprunte le parcours « phrase oubliée ».
  await page.reload();
  await page.getByRole("button", { name: "Phrase oubliée" }).click();
  await page.getByLabel("Clé de récupération").fill(code);
  await page.getByRole("button", { name: "Vérifier la clé" }).click();

  // Nouvelle phrase à définir.
  await expect(
    page.getByRole("heading", { name: "Définir une nouvelle phrase secrète" }),
  ).toBeVisible();
  const np = "toute-nouvelle-phrase-secrete-77";
  await page.getByPlaceholder("Nouvelle phrase secrète").fill(np);
  await page.getByPlaceholder("Confirmer la phrase secrète").fill(np);
  await page.getByRole("button", { name: "Enregistrer la phrase" }).click();
  await expect(page.getByRole("heading", { name: "Que souhaitez-vous vérifier ?" })).toBeVisible();
});
