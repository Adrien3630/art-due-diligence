# Provenance — Due Diligence pour le marché de l'art

Outil **local-first** d'aide à la vigilance LCB-FT (lutte contre le blanchiment
et le financement du terrorisme) destiné aux galeries et marchands d'art.

> **Positionnement honnête — à lire avant tout.**
> Ce logiciel est une **aide à la décision**. Il **ne certifie pas** l'authenticité
> d'une œuvre, **ne garantit pas** l'absence de risque et **ne remplace pas** le
> jugement du professionnel assujetti. Il n'existe **aucune** « analyse forensique »
> ou « fingerprint » automatique de l'image : ce serait un faux argument technique.
> Ce que l'outil fait réellement :
> 1. interroge un **vrai** fournisseur de screening de sanctions/PPE avec **votre** clé ;
> 2. structure et trace les **vérifications déclarées** (acteurs et provenance) ;
> 3. applique une **approche par les risques** et produit une **synthèse transparente**
>    (chaque facteur est listé en clair) ;
> 4. génère un **Dossier Client / rapport PDF** localement, avec mentions de portée et de limites.

---

## Table des matières

1. [Démarrer](#1-démarrer)
2. [Vue d'ensemble : trois modules](#2-vue-densemble--trois-modules)
3. [Workflow complet, pas à pas](#3-workflow-complet-pas-à-pas)
4. [Le moteur de risque expliqué](#4-le-moteur-de-risque-expliqué)
5. [Ce qui est RÉEL vs DÉCLARATIF](#5-ce-qui-est-réel-vs-déclaratif)
6. [Architecture technique](#6-architecture-technique)
7. [Modèle de données](#7-modèle-de-données)
8. [Flux réseau & confidentialité](#8-flux-réseau--confidentialité)
9. [Ce qui reste à faire (dépend de vous)](#9-ce-qui-reste-à-faire-dépend-de-vous)
10. [Note de conformité](#10-note-de-conformité)

---

## 1. Démarrer

Prérequis : Node.js 20.9+ (installé via Homebrew : `brew install node`).

```bash
npm install
npm run dev          # développement → http://localhost:3000
npm run build        # build de production (vérifie types + compile)
npm start            # sert le build en LOCAL → http://localhost:3000
```

**Hébergement local.** L'application est conçue pour tourner **sur la machine de la
galerie**, pas dans le cloud. `npm start` lance un serveur Next local : aucune donnée
ne quitte l'ordinateur, hormis l'appel de screening vers votre fournisseur (avec
votre clé). Pour une **application de bureau autonome** (`.dmg` / `.exe`, sans
terminal), voir la piste Tauri en [§9](#9-ce-qui-reste-à-faire-dépend-de-vous).

Stack : **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**,
**Tailwind CSS v4**, **@react-pdf/renderer** (génération PDF côté navigateur).
Aucune base de données serveur : la persistance se fait en `localStorage`.

---

## 2. Vue d'ensemble : trois modules

L'outil propose **trois objets de due diligence de premier rang**, indépendants et
combinables. L'écran d'accueil (`/`) est un lanceur vers ces trois modules.

| Module | Route | Question à laquelle il répond |
|---|---|---|
| **Acteur** | `/acteur` | « Ce client / cette contrepartie présente-t-il un risque ? » |
| **Œuvre** | `/oeuvre` | « Cette œuvre est-elle volée, spoliée, ou sa provenance est-elle douteuse ? » |
| **Transaction** | `/transaction` | « Cette vente (acheteur + vendeur + œuvre) est-elle à risque ? » |

Deux écrans de support :

- **Historique Local** (`/historique`) — tous les dossiers archivés sur l'appareil.
- **Paramètres** (`/parametres`) — fournisseur de screening, clé API, identité de la
  galerie, **seuil de vigilance** (défaut 10 000 €).

Principe directeur du module Acteur : **chercher au lieu de demander**. L'outil
n'oblige le galeriste à réclamer une pièce intrusive (identité, origine des fonds)
**que si le risque l'exige** — c'est l'« approche par les risques », le standard légal.

---

## 3. Workflow complet, pas à pas

### 3.A — Module ACTEUR (`/acteur`)

> **But :** produire un **Dossier Client** archivable pour une personne ou une
> entité, en posant le minimum de questions.

**Étape 1 — Saisie minimale.**
On choisit le **type** (Personne physique / Entité morale) et le **rôle**
(Acheteur / Vendeur / Intermédiaire), puis on renseigne l'identité :

- Personne : nom, prénom(s), date de naissance, nationalité, pays de résidence.
  - La date de naissance et la nationalité **ne sont pas des questions au client** :
    elles servent à **désambiguïser le screening** (réduire les faux positifs).
- Entité : raison sociale, forme juridique, n° d'immatriculation, juridiction, et
  **bénéficiaires effectifs (UBO)** déclarés (nom, %, nationalité).

**Étape 2 — Seuil & pièce d'identité (rôle acheteur uniquement).**
Une case **« Transaction de plus de 10 000 € »** (le seuil est configurable). Si elle
est **cochée** :
- une zone d'**upload de la pièce d'identité du client** apparaît (marquée obligatoire) ;
- le bouton **« Créer le dossier client » reste désactivé** tant que la pièce n'est
  pas jointe — la pièce d'identité est **obligatoire pour créer le dossier**.
- La pièce est lue en **data-URL locale** (jamais transmise).

**Étape 3 — Indices de vigilance (facultatifs).**
Deux questions Oui/Non/N-R (structure opaque ? réticence du client ?). Laissées
vides, elles **n'alourdissent pas** le score : l'outil privilégie le minimum de
questions.

**Étape 4 — « Créer le dossier client ».**
Au clic, l'app :
1. lance le **screening** sanctions/PPE/médias sur l'acteur (et sur chaque UBO d'une
   entité) ;
2. dérive le **risque-pays** automatiquement depuis le pays/nationalité (listes GAFI) ;
3. calcule le **niveau de vigilance** (Simplifiée / Standard / Renforcée) et les
   **sous-scores** ;
4. établit la liste des **pièces à collecter** (minimale, justifiée).

**Étape 5 — Le Dossier Client.**
Le résultat est un **Dossier Client** affichant :
- le **niveau de vigilance** + le **niveau de risque** (macarons) ;
- la **pièce d'identité au dossier** (si fournie) ;
- les **sous-scores** par catégorie (Identité, Sanctions, PPE/Médias, Juridiction,
  Transparence) ;
- le **résultat de screening** (honnête : « démonstration / non probant » sans clé) ;
- les **pièces à collecter** :
  - vigilance simplifiée → *« Aucune pièce intrusive requise »* ;
  - sinon → liste justifiée + **bouton « Générer la demande pré-remplie »** (courriel
    diplomatique local à copier / ouvrir dans la messagerie / télécharger) ;
- les **facteurs retenus** en clair ;
- les actions **« Exporter le dossier (PDF) »** et **« Archiver le dossier client »**.

### 3.B — Module ŒUVRE (`/oeuvre`)

> **But :** documenter la provenance et vérifier que l'œuvre n'est ni volée ni spoliée.

**Étape 1 — Identité de l'œuvre.** Titre, artiste, année, technique, dimensions, et
une **photographie** (locale, jamais transmise, **aucune** analyse d'image n'est faite).
L'année sert à juger la pertinence du contrôle spoliation 1933-1945.

**Étape 2 — Chaîne de provenance.** Une ligne par détenteur successif (période,
propriétaire, lieu, source documentaire). Le moteur y détecte :
- l'**absence** ou la **brièveté** de la chaîne ;
- les maillons **sans source** ;
- un **trou sur la période 1933-1945** pour une œuvre antérieure à 1945 (drapeau
  spoliation).

**Étape 3 — Vérifications registres.** Pour chaque registre (œuvres volées et
spoliations), un **lien de recherche pré-rempli** (artiste + titre) s'ouvre vers le
site officiel ; le galeriste **constate le résultat** et le consigne
(Non vérifié / Aucune correspondance / Correspondance). Tant qu'un registre n'est pas
vérifié, il reste un **point de vigilance**.

**Étape 4 — Authenticité & titre.** Checklist Oui/Non/N-R (catalogue raisonné,
certificat, facture d'origine, litige/gage/revendication, licences d'export).

**Étape 5 — Synthèse.** Au clic « Lancer la vigilance » : niveau de risque global +
**sous-scores** (Provenance, Spoliation, Vol, Authenticité, Titre) + facteurs en
clair. Une **correspondance** dans un registre force le **risque élevé**. Export PDF
et archivage.

### 3.C — Module TRANSACTION (`/transaction`)

> **But :** réunir les volets et **agréger** leurs synthèses, sans rien réinventer.

1. **Acheteur** (formulaire acteur, incl. case « > seuil » + pièce d'identité).
2. **Vendeur** (facultatif, activable par une case « Inclure le vendeur »).
3. **Œuvre** (formulaire œuvre complet).
4. **Conditions & comportement** : montant (€) + 3 questions transactionnelles
   (espèces/crypto, paiement par un tiers, urgence/incohérence).

Au clic « Créer le dossier » : chaque volet est évalué **avec sa propre synthèse**,
puis l'app calcule un **niveau agrégé** = le plus sévère des volets, relevé le cas
échéant par les drapeaux comportementaux. Le résultat affiche la synthèse globale +
chaque volet (Acheteur, Vendeur, Œuvre) avec ses sous-scores et pièces à collecter.
La pièce d'identité de l'acheteur reste **obligatoire** si la case « > seuil » est
cochée. Export PDF (rapport multi-volets) et archivage.

---

## 4. Le moteur de risque expliqué

Tout le calcul est dans [`src/lib/scoring.ts`](src/lib/scoring.ts). Il est
**volontairement simple, explicite et traçable** : aucun composant n'est « deviné ».

### 4.1 Niveaux

- **Niveau de risque** (tri-couleur) : `faible` / `vigilance` / `eleve`.
  Calculé par points : `≥ 6 → élevé`, `≥ 3 → vigilance`, sinon `faible`.
  Une **correspondance sanction / vol / spoliation** force directement `élevé`.
- **Niveau de vigilance** (acteur, approche par les risques) :
  `simplifiée` / `standard` / `renforcée`.

### 4.2 Acteur — comment le niveau de vigilance est décidé

Signaux **dérivés automatiquement** (non demandés) :

| Signal | Source |
|---|---|
| Sanction / PPE / média négatif | screening (acteur + UBO) |
| Risque-pays (GAFI) | pays + nationalité, via `jurisdictions.ts` |
| Montant ≥ seuil | case « > 10 000 € » **ou** montant saisi ≥ seuil |
| Opacité | entité sans UBO déclaré, ou indice signalé |

Décision :

- **Renforcée** si : sanction, ou PPE, ou juridiction « liste noire », ou
  (juridiction « liste grise » **et** montant ≥ seuil), ou (montant ≥ seuil **et**
  opacité).
- **Standard** si : montant ≥ seuil, ou juridiction « liste grise », ou média négatif,
  ou opacité, ou screening non abouti.
- **Simplifiée** sinon → **aucune pièce intrusive**.

Pièces à collecter selon le niveau :

| Niveau | Pièces réclamées |
|---|---|
| Simplifiée | *aucune* |
| Standard | pièce d'identité (Kbis pour une entité) |
| Renforcée | identité **+** origine des fonds **+** chaîne d'UBO (entité) |

Chaque pièce porte son **motif** (ex. « juridiction à très haut risque, montant ≥ seuil »).

### 4.3 Œuvre — sous-scores

- **Provenance** : absence/brièveté de la chaîne, maillons sans source.
- **Spoliation** : correspondance registre (→ élevé), **trou 1933-1945**, registres
  non vérifiés.
- **Vol** : correspondance registre (→ élevé), registres non vérifiés.
- **Authenticité** : catalogue raisonné, certificat.
- **Titre** : facture d'origine, litige/gage/revendication.

### 4.4 Transaction — agrégation

`niveau = pire(acheteur, vendeur, œuvre)`, relevé si les drapeaux comportementaux
(espèces, tiers payeur, urgence) atteignent les seuils. Aucun recalcul des volets :
on **empile** des synthèses déjà honnêtes.

---

## 5. Ce qui est RÉEL vs DÉCLARATIF

C'est la ligne rouge du produit. L'outil ne **simule jamais** une vérification.

| Vérification | Statut technique |
|---|---|
| **Sanctions / PPE / médias** | ✅ **Réel** via API (Sanctions.io / OpenSanctions) avec votre clé. Sans clé → **mode démonstration explicite**, résultat étiqueté « NON probant ». |
| **Risque-pays GAFI** | ✅ Dérivé d'un **snapshot daté** des listes GAFI (`jurisdictions.ts`) — ⚠️ **à actualiser** à chaque plénière. |
| **Registres œuvres volées / spoliées** | ⚠️ **Liens de recherche pré-remplis** + **résultat constaté par l'humain**. La plupart de ces bases n'ont **pas d'API ouverte** ; l'outil ne coche jamais « rien à signaler » à votre place. |
| **Provenance / authenticité** | 📝 **Déclaratif** (saisie du galeriste), structuré et tracé. |
| **Analyse de l'image de l'œuvre** | ❌ **Inexistante, par conception.** |

---

## 6. Architecture technique

```
src/
├─ app/
│  ├─ layout.tsx              Coquille : polices (Playfair + Inter) + Sidebar
│  ├─ globals.css             Design system « galerie » (Tailwind v4 @theme)
│  ├─ page.tsx                Accueil — lanceur 3 modules
│  ├─ acteur/page.tsx         Module Acteur (Dossier Client)
│  ├─ oeuvre/page.tsx         Module Œuvre (provenance)
│  ├─ transaction/page.tsx    Module Transaction (agrégation)
│  ├─ historique/page.tsx     Historique local (3 types de dossiers)
│  ├─ parametres/page.tsx     Réglages + clé API + seuil
│  └─ api/screening/route.ts  Relai serveur vers le fournisseur de screening
├─ components/
│  ├─ Sidebar.tsx             Navigation latérale
│  ├─ ui.tsx                  Primitives (Field, Button, Card, RiskBadge,
│  │                          TierBadge, SubScores, STATUS_PILL…)
│  ├─ ActorForm.tsx           Saisie acteur (personne/entité, UBO, case seuil, CNI)
│  ├─ ArtworkForm.tsx         Saisie œuvre (provenance, registres, checklist)
│  ├─ AuditList.tsx           Liste de questions Oui/Non/N-R réutilisable
│  ├─ ScreeningResultCard.tsx Affichage d'un résultat de screening
│  ├─ CollectionPanel.tsx     Pièces à collecter + génération de la demande
│  ├─ ImageDropzone.tsx       Dépôt de fichier local (photo œuvre ou CNI)
│  └─ ReportDocument.tsx      3 gabarits PDF + downloadReport()
└─ lib/
   ├─ types.ts                Modèle de données (toutes les interfaces)
   ├─ factories.ts            États vierges (emptyActor, emptyArtwork, newId)
   ├─ scoring.ts              Moteur de risque (assessActor / assessArtwork /
   │                          aggregateTransaction) + checklists + métadonnées
   ├─ jurisdictions.ts        Référentiel GAFI + assessJurisdiction()
   ├─ registers.ts            Registres vol/spoliation + liens pré-remplis
   ├─ screening.ts            Client d'appel au screening (runScreening)
   ├─ requestLetter.ts        Génération du courriel de demande de pièces
   └─ storage.ts              Persistance localStorage (settings + historique)
```

**Responsabilités clés**

- `lib/` est **pur** (aucune dépendance UI) : on peut le tester et le réutiliser tel
  quel dans une version desktop.
- Les pages sont des **Client Components** (`"use client"`) : tout l'état vit côté
  navigateur, rien n'est rendu côté serveur sauf la route `/api/screening`.
- Le PDF est généré **dans le navigateur** (`@react-pdf/renderer`), jamais sur un
  serveur.

---

## 7. Modèle de données

Défini dans [`src/lib/types.ts`](src/lib/types.ts). Les structures principales :

- **`Actor`** — `kind` (`personne`/`entite`), `role`, identité, `beneficiaires`
  (UBO), `indices` (facultatifs), `transactionSuperieureSeuil` (case acheteur),
  `pieceIdentiteDoc` (data-URL CNI locale).
- **`Artwork`** — identité + `photoDataUrl` + `provenance: ProvenanceEntry[]` +
  `registres: RegisterCheck[]` + `audit: AuditAnswer[]`.
- **Synthèses** — `ActorAssessment` (niveau, `tier`, `sousScores`, `facteurs`,
  `piecesACollecter`), `ArtworkAssessment`, et l'agrégat transaction.
- **`Dossier`** — union discriminée par `kind` :
  `ActorDossier | ArtworkDossier | TransactionDossier`. C'est ce qui est **archivé**
  dans l'historique et **exporté** en PDF.
- **`Settings`** — `fournisseur`, `apiKey`, `nomGalerie`, `signataire`,
  `seuilVigilanceEur`.

Persistance ([`storage.ts`](src/lib/storage.ts)) : deux clés `localStorage`
(`provenance.settings.v2`, `provenance.history.v2`). Aucune écriture réseau.

---

## 8. Flux réseau & confidentialité

**Un seul appel réseau existe : le screening.** Tout le reste est local.

```
Navigateur (formulaire)
   │  POST { subject, settings }   (nom, et éventuellement date de naissance / nationalité)
   ▼
/api/screening  (route Next, côté serveur LOCAL)
   │  appel HTTPS authentifié (votre clé)
   ▼
Fournisseur (Sanctions.io / OpenSanctions)
   │  réponse JSON
   ▼
classification → { status, matches, listesInterrogees, … }  →  Navigateur
```

- **Sans clé API** → la route renvoie un résultat `demo` **explicitement non probant**
  (jamais un faux « clear »).
- **Avec clé** → appel réel ; en cas d'échec, statut `error` (jamais masqué).
- **Désambiguïsation** : date de naissance / nationalité sont transmises au
  fournisseur quand elles existent, pour réduire les faux positifs.
- **Aucune autre donnée** (photos, pièce d'identité, provenance, rapports) ne quitte
  l'appareil.

**Note Tauri (phase desktop).** En build statique Tauri, il n'y a pas de serveur
Next : la logique de `/api/screening` migre côté **Rust** (commande Tauri) ou via
`@tauri-apps/plugin-http` (contourne le CORS, garde la clé locale). Le contrat
d'entrée/sortie de `runScreening()` reste identique — seul le corps change.

---

## 9. Ce qui reste à faire (dépend de vous)

Ces étapes nécessitent votre machine, des comptes payants, ou un avis juridique.

### 9.1 Brancher un fournisseur de screening réel
Créer un compte (**Sanctions.io** ou **OpenSanctions**), récupérer une clé API, la
coller dans **Paramètres**. Vérifier le mapping de réponse dans
[`api/screening/route.ts`](src/app/api/screening/route.ts) (marqué « à valider » : le
schéma exact dépend de la version d'API).

### 9.2 Actualiser le référentiel GAFI
Les listes dans [`jurisdictions.ts`](src/lib/jurisdictions.ts) sont un **snapshot daté**
(`GAFI_SNAPSHOT_DATE`). À mettre à jour après chaque plénière du GAFI (3×/an).

### 9.3 Brancher les registres dotés d'une API
Interpol (ID-Art) expose une API ; la plupart des autres non. À câbler dans
[`registers.ts`](src/lib/registers.ts) le moment venu, **sans jamais simuler** un
résultat.

### 9.4 Passage en application de bureau — Tauri
Tauri exige **Rust** + Xcode Command Line Tools.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm install -D @tauri-apps/cli
npx tauri init
# Migrer le screening (plugin HTTP), activer next.config.ts → output: 'export'
# (supprime alors la route /api), réécrire le corps de runScreening().
npx tauri build      # génère .dmg (macOS) et .msi/.exe (Windows)
```
La **signature** des installeurs requiert un certificat développeur (Apple Developer
ID ; certificat Windows). Sans signature : avertissement Gatekeeper / SmartScreen.

### 9.5 Stockage local chiffré
Remplacer `localStorage` par le plugin **`@tauri-apps/plugin-sql`** (SQLite local) ou
un store chiffré (**`@tauri-apps/plugin-store`** + Stronghold).

### 9.6 Kit de vente & EULA
Voir [`KIT_DE_VENTE.md`](KIT_DE_VENTE.md). ⚠️ **L'EULA doit être validée par un
juriste.** Ne jamais vendre un outil de conformité avec des promesses que le code ne
tient pas.

---

## 10. Note de conformité

Le marché de l'art est un secteur **assujetti** à la réglementation LCB-FT (France :
Code monétaire et financier ; UE : directives anti-blanchiment). Un outil qui
*prétend* remplir ces obligations sans le faire réellement expose la galerie cliente à
des sanctions et peut laisser passer de vrais risques.

Ce projet reste du bon côté de cette ligne : il **assiste** la vigilance et la
**documente** honnêtement, applique une **approche par les risques** conforme à
l'esprit de la réglementation, sans jamais se substituer à l'obligation légale
d'appréciation humaine ni inventer de capacité technique. **Les niveaux et seuils sont
indicatifs et doivent être validés par un juriste.**
