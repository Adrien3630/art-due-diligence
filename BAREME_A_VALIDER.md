# Barème de risque — document de validation juridique

> **Objet.** Ce document expose **tous les choix chiffrés** du moteur de risque de
> Provenance afin qu'un **juriste LCB-FT** puisse les valider, corriger ou rejeter.
>
> **Avertissement central (à lire avant tout).** Le logiciel distingue deux choses
> de nature très différente :
> - **(A) les OBLIGATIONS légales** qu'il cherche à outiller (identification,
>   vigilance graduée, conservation, déclaration, gel…). Elles s'appuient sur des
>   textes, cités ci-dessous — **à confirmer dans leur version en vigueur**.
> - **(B) le BARÈME** : les **points, poids et seuils** (ex. « ≥ 6 points = risque
>   élevé », « PPE = +4 »). Ces nombres **n'ont AUCUN fondement réglementaire**.
>   Ce sont des **choix heuristiques** de l'éditeur pour ordonner la vigilance.
>   Aucune loi n'impose « 6 points ». **Ils doivent être validés et calibrés.**
>
> Tant que la partie (B) n'est pas validée, l'outil est une **aide à la
> structuration**, pas une garantie de conformité. Il ne remplace pas le jugement
> du professionnel assujetti.

Code de référence : [`src/lib/scoring.ts`](src/lib/scoring.ts),
[`src/lib/jurisdictions.ts`](src/lib/jurisdictions.ts).
Date de rédaction : 2026-06-17.

> **Fidélité code ↔ document (vérifiée le 2026-08-11).** Chaque valeur chiffrée
> ci-dessous a été confrontée au code et **correspond exactement**. Cette
> correspondance est désormais **verrouillée par un test** :
> [`src/lib/__tests__/bareme.test.ts`](src/lib/__tests__/bareme.test.ts). Si un
> point, poids ou seuil est modifié dans le code sans que ce document soit mis à
> jour, le test échoue en CI. **Conséquence pratique : toute évolution du barème
> doit modifier le code ET ce document dans le même changement**, puis être
> refaite valider. Le test ne juge PAS la pertinence des nombres (c'est l'objet
> de la validation juridique) — il garantit seulement que le doc ne ment pas sur
> le code.

---

## A. Obligations légales outillées (à confirmer par le juriste)

Colonne **Vérif. sourcée** = résultat d'une vérification documentaire sur sources
primaires (Légifrance / EUR-Lex / DG Trésor / GAFI) menée le **2026-08-11**. Ce
n'est **pas** un avis juridique : elle appuie la décision du juriste, qui reste
seul à valider. Détail et URLs en **§ A′** ci-dessous.

| # | Ce que fait l'outil | Source invoquée | Vérif. sourcée (2026-08-11) |
|---|---|---|---|
| A1 | Considère le marchand/galerie/intermédiaire d'art comme **assujetti** | Art. **L. 561-2, 10°** CMF | ✅ **Correct** — bon alinéa (10°), subordonné au seuil de 10 000 € |
| A2 | Déclenche la vigilance au **seuil de 10 000 €** (transaction ou série liée) | Seuil art. marché de l'art ; param. `seuilVigilanceEur` | ⚠️ **Correct sur le fond / base à préciser** — seuil posé par la **loi** (L. 561-2, 10°), **pas** par un R. 561-x ; libellé exact : « série de transactions **liées** » |
| A3 | **Vigilance graduée** simplifiée / standard / renforcée | Art. **L. 561-9** (simplifiée) / **L. 561-10, L. 561-10-1** (renforcée, PPE) | ❌ **Imprécis (fond)** — **PPE = L. 561-10, 1°** (vigilance *complémentaire*), **pas** L. 561-10-1 ; L. 561-10-1 = vigilance *renforcée* en cas de **risque élevé général** ; L. 561-9 (simplifiée) OK |
| A4 | **Pays tiers à haut risque** → vigilance renforcée | Art. L. 561-10 ; listes UE / **GAFI** | ⚠️ **À préciser** — déclencheur au **L. 561-10, 3°** (renvoi art. 9 dir. (UE) 2015/849) ; liste de référence = **règlement délégué (UE) 2016/1675** + listes GAFI ; ne pas confondre L. 561-10 / -10-1 / -10-2 |
| A5 | **Conservation 5 ans** des pièces après fin de relation | Art. **L. 561-12** CMF | ⚠️ **Correct / incomplet** — **deux** points de départ : fin de la relation **OU** exécution de l'opération |
| A6 | **Déclaration de soupçon** à Tracfin (projet pré-rempli, jamais transmis) | Art. **L. 561-15** CMF | ✅ **Correct** — ERMES obligatoire depuis l'arrêté du 23/01/2025 ; déclaration **avant exécution** |
| A7 | **Gel des avoirs** sans délai + signalement DG Trésor sur hit sanction | Art. **L. 562-4** CMF | ✅ **Correct** — distinguer **L. 562-2** (décision de gel) de **L. 562-4** (application sans délai) ; registre DG Trésor confirmé |
| A8 | Indicateurs de risque marché de l'art | **Rapport GAFI/FATF, 27 fév. 2023** (art & antiquités) | ✅ **Correct** — titre et date exacts ; c'est un **rapport de typologies**, non une norme contraignante |

> ⚠️ **Le snapshot des juridictions GAFI est OBSOLÈTE.**
> [`jurisdictions.ts`](src/lib/jurisdictions.ts) est figé à **« février 2025 »** et
> n'a pas de mécanisme de mise à jour. La plénière GAFI la plus récente est celle
> du **19 juin 2026** : la **liste grise** est passée de **25 à 22 juridictions**.
> La **liste noire est inchangée** (Corée du Nord, Iran, Myanmar).
> - **Sortis** (→ le code produit des **faux positifs**) : Croatie, Mali, Tanzanie,
>   Burkina Faso, Mozambique, **Nigéria**, **Afrique du Sud**, **Algérie**, Namibie.
> - **Entrés** (→ le code produit des **faux négatifs**) : Bolivie, Îles Vierges
>   britanniques, Koweït, Papouasie-Nouvelle-Guinée, Bosnie-Herzégovine, Irak.
>
> **Correction du code non incluse ici** (relève du chantier « limites techniques ») :
> actualiser [`jurisdictions.ts`](src/lib/jurisdictions.ts) + prévoir une revue à
> chaque plénière (~février / juin / octobre).

---

## A′. Corrections issues de la vérification sourcée (2026-08-11)

> Vérification documentaire, **pas un avis juridique**. Les articles du CMF sont
> à confirmer par le juriste dans leur version en vigueur (Légifrance).

1. **A2 — base juridique du seuil.** Le seuil de 10 000 € est posé par la **loi
   elle-même (art. L. 561-2, 10° CMF)**, non par un article réglementaire
   (R. 561-x). Aligner le libellé sur « transaction ou **série de transactions
   liées** ». Origine : ord. n° 2020-115 du 12/02/2020 (transposition 5e dir. AML).
   [L. 561-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050361172)
2. **A3 — PPE : correction de fond.** Rattacher les PPE à l'art. **L. 561-10, 1°**
   (mesures de vigilance *complémentaires*), et **non** à L. 561-10-1. L'art.
   **L. 561-10-1** régit la vigilance *renforcée* en cas de **risque élevé** (cas
   général), sans viser spécifiquement les PPE. L. 561-9 (simplifiée) : conserver.
   [L. 561-9](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041577821) ·
   [L. 561-10](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053153188) ·
   [L. 561-10-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033517667)
3. **A4 — pays tiers à haut risque.** Déclencheur au **L. 561-10, 3°** (renvoi à
   l'art. 9 dir. (UE) 2015/849). Liste de référence : **règlement délégué (UE)
   2016/1675** (Commission) + listes GAFI. Ne pas confondre L. 561-10
   (complémentaire) / L. 561-10-1 (renforcée) / L. 561-10-2 (opérations atypiques).
   Réserve : paquet LCB-FT UE (règl. (UE) 2024/1624 « AMLR » + AMLA) applicable
   progressivement dès 2027 — sans effet sur ces articles à ce jour.
   [Règl. dél. 2016/1675](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:02016R1675-20240207)
4. **A5 — conservation.** Compléter : « 5 ans à compter de la **fin de la relation
   d'affaires OU de l'exécution de l'opération** » (deux délais distincts).
   [L. 561-12](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041577784)
5. **A6 — ERMES.** Préciser : usage d'ERMES obligatoire depuis l'arrêté du
   23/01/2025 (en vigueur 01/02/2025) ; déclaration **avant exécution** de l'opération.
6. **A7 — gel des avoirs.** Distinguer **L. 562-2** (décision de gel par arrêté)
   de **L. 562-4** (application « sans délai » par l'assujetti + information DG
   Trésor — bon fondement pour l'outil). Registre : `gels-avoirs.dgtresor.gouv.fr`.
   [L. 562-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045250683)
7. **A8** — préciser que le rapport GAFI 2023 est un **rapport de typologies**,
   pas une norme contraignante.
8. **GAFI (urgent, code)** — remplacer le snapshot fév. 2025 par la plénière du
   **19 juin 2026** (liste grise à 22 juridictions, cf. alerte ci-dessus).

---

## B. Le barème — choix chiffrés SANS fondement réglementaire

### B0. Conversion points → niveau ([`levelFromPoints`](src/lib/scoring.ts))
| Condition | Niveau | Base réglementaire |
|---|---|---|
| points ≥ 6 | Risque élevé | **aucune — choix éditeur** |
| points ≥ 3 | Vigilance | **aucune — choix éditeur** |
| sinon | Faible | **aucune — choix éditeur** |

> Les frontières **3** et **6** sont arbitraires. Question au juriste : faut-il un
> seuil de niveau « élevé » déclenché par certains facteurs **quels que soient les
> points** (approche par seuils qualitatifs plutôt que somme) ?

### B1. Sous-scores ACTEUR (`assessActor`)
| Facteur | Points | Remarque / à valider |
|---|---|---|
| Correspondance **sanction** | **+100** (force « élevé ») | Doit-il être un **blocage absolu** distinct du score ? (voir gel des avoirs) |
| **PPE** | +4 | Pondération arbitraire |
| **Média négatif** (adverse media) | +2 | Arbitraire |
| Screening en **erreur** | +2 | Arbitraire |
| Juridiction **liste noire** GAFI | +5 | Arbitraire |
| Juridiction **liste grise** GAFI | +3 | Arbitraire |
| Entité **sans bénéficiaire effectif** déclaré | +3 | Arbitraire |
| **Chaîne UBO incomplète** (entité intermédiaire opaque) | +3 | Arbitraire |
| **Indice d'opacité** signalé par le galeriste | +3 | Arbitraire |
| Données d'identification **incomplètes** | +1 | Arbitraire |

### B2. Niveau de vigilance (tier) — logique de déclenchement
- **Renforcée** si : sanction **ou** PPE **ou** juridiction liste noire **ou**
  (liste grise **et** montant ≥ seuil) **ou** (montant ≥ seuil **et** opacité).
- **Standard** si : montant ≥ seuil **ou** liste grise **ou** média **ou** opacité **ou** erreur.
- **Simplifiée** sinon (→ **aucune pièce demandée**).

> C'est le **cœur « approche par les risques »**. La structure est défendable, mais
> les **combinaisons exactes** doivent être validées : p. ex. une PPE seule
> suffit-elle à la vigilance renforcée indépendamment du montant ? Une juridiction
> liste grise sans dépassement de seuil doit-elle rester en « standard » ?

### B3. Pièces réclamées par tier
| Tier | Pièces demandées | À valider |
|---|---|---|
| Simplifiée | **aucune** | Le « zéro pièce » est-il acceptable au regard de l'identification minimale ? |
| Standard | Identité (pièce officielle / Kbis) | Suffisant ? |
| Renforcée | + origine des fonds + doc UBO (entité) | Complet ? |

### B4. Sous-scores ŒUVRE (`assessArtwork`)
| Facteur | Points | À valider |
|---|---|---|
| Aucune provenance | +3 | Arbitraire |
| Provenance d'un seul maillon | +2 | Arbitraire |
| Maillon à source faible/absente | +1 **par maillon** | Arbitraire |
| **Rupture > 30 ans** entre maillons | +2 | Le seuil **30 ans** est arbitraire |
| Maillon **antérieur à la création** (incohérence) | +3 | Arbitraire |
| Première apparition publique non documentée | +1 | Arbitraire |
| Correspondance **registre spoliation** | +100 | Blocage à confirmer |
| **Trou de provenance 1933-1945** (œuvre ≤ 1945) | +4 | Heuristique d'années (regex) — voir limite |
| Registre spoliation **non vérifié** | +1 **par registre** | Arbitraire |
| Correspondance **registre vol** | +100 | Blocage à confirmer |
| Registre vol **non vérifié** | +1 par registre | Arbitraire |
| Question d'authenticité/titre **non renseignée** | +1 | Le « non-renseigné = +1 » est un choix |
| Question d'authenticité/titre **drapeau levé** | +poids (1 à 3) | Poids arbitraires |

### B5. Indicateurs GAFI marché de l'art (`freshArtworkRedFlags`)
Source revendiquée : rapport GAFI 2023. Poids attribués par l'éditeur :
| Indicateur | Poids |
|---|---|
| Œuvre « fraîche au marché » sans historique | 2 |
| Réticence à divulguer le précédent propriétaire | 3 |
| Prix manifestement incohérent avec le marché | 2 |
| Structure opaque / intermédiaire anonyme | 3 |
| Œuvre réapparue après perte/vol puis radiation | 3 |

> À valider : la **correspondance** entre chaque question et le rapport GAFI, et
> les **poids**. La cohérence de prix peut être objectivée via le module marché
> (`assessPriceCoherence` : > 1,5 × max = « élevé », < 0,5 × min = « bas » — **bornes
> arbitraires**).

### B6. Comportement TRANSACTION (`freshComportement` + `aggregateTransaction`)
| Facteur | Poids |
|---|---|
| Espèces / crypto au-delà des seuils | 3 |
| Paiement par un tiers non partie | 3 |
| Urgence / discrétion / prix incohérent | 2 |

Agrégation : niveau global = **pire** des niveaux (acheteur / vendeur / œuvre) ; le
comportement peut **monter** le niveau (≥ 6 → élevé ; ≥ 3 → au moins vigilance),
**jamais le baisser**. *Structure prudente, bornes arbitraires.*

### B7. Indices acteur (`freshActorIndices`)
| Indice | Poids |
|---|---|
| Structure-écran / mandat à bénéficiaire opaque | 3 |
| Réticence inhabituelle à fournir des informations | 2 |

### B8. Vigilance continue (`monitoring.ts`)
- Intervalle de revue par défaut : **12 mois** (`revueIntervalleMois`, paramétrable).
> Aucune base légale sur « 12 mois » : à fixer selon le risque. À valider.

---

## C. Limites techniques affectant la fiabilité (à signaler au juriste)

1. **Extraction d'années par expression régulière** ([`extractYears`](src/lib/scoring.ts)) :
   ne comprend pas « circa 1940 », « XIXᵉ siècle », « années 30 » → le contrôle
   spoliation 1933-1945 et les ruptures peuvent passer à côté.
2. **Screening sur le nom** principalement → faux positifs/négatifs (homonymes) ;
   la désambiguïsation (date de naissance / nationalité) dépend du fournisseur.
3. **Snapshot GAFI figé** (cf. supra) — pas d'actualisation automatique.
4. Les **comparables de marché** ne sont pas archivés dans le dossier (l'humain
   reporte sa conclusion via l'indicateur prix).

---

## D. Méthode de validation proposée

1. **Revue ligne à ligne** des tableaux A et B par un juriste LCB-FT ; annoter
   chaque ligne : *conforme / à corriger / sans objet*.
2. **Distinguer** ce qui est une **obligation** (doit être respecté) de ce qui est
   une **aide indicative** (peut être ajusté).
3. **Calibrer** les poids/seuils de (B) — idéalement par rétro-test sur des cas
   réels ou des typologies Tracfin/GAFI.
4. **Documenter** la version validée et la **date**, et instaurer une **revue
   périodique** (au moins à chaque évolution réglementaire et plénière GAFI).
5. Acter par écrit que l'outil **n'engage pas** la conformité du professionnel,
   qui reste seul responsable de sa décision.

---

### Sources consultées (2026-06-17)
- Acteurs assujettis & seuil 10 000 € — [Fournol Avocat](https://www.fournol-avocat.fr/actualite/2023/11/27/les-acteurs-du-march-de-lart-assujettis-aux-obligations-en-matire-de-lbc-ft-en-france) ; [Village Justice](https://www.village-justice.com/articles/marchands-art-lcb,56173.html)
- Guide d'application maisons de vente (juin 2025) — [Conseil des maisons de vente](https://conseilmaisonsdevente.fr/sites/default/files/documents/CMV_GUIDE-DAPPLICATION-DES-OBLIGATIONS-DE-LCB-FT-2025.pdf)
- Rapport GAFI/FATF, *Money Laundering and Terrorist Financing in the Art and Antiquities Market*, 27 fév. 2023 — [FATF](https://www.fatf-gafi.org/en/publications/Methodsandtrends/Money-Laundering-Terrorist-Financing-Art-Antiquities-Market.html)
- Gel des avoirs / registre national — [DG Trésor](https://gels-avoirs.dgtresor.gouv.fr/)

> Les articles du Code monétaire et financier sont cités de mémoire à titre
> indicatif et **doivent être vérifiés dans leur version en vigueur** (Légifrance).
