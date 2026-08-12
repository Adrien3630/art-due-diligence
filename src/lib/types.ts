/*
  Modèle de données — refonte Acteur / Œuvre / Transaction.

  Trois objets de due diligence de premier rang :
   • Acteur      : une personne physique OU une entité morale (avec bénéficiaires
                   effectifs). Vigilance par approche des risques.
   • Œuvre       : provenance structurée + vérifications registres (vol/spoliation).
   • Transaction : agrège acheteur + vendeur + œuvre, sans rien réinventer.

  Règle d'or inchangée : aucune capacité « forensique » inventée. On documente,
  on interroge de vraies sources, on agrège de façon transparente.
*/

/* ───────────────────────── Communs ───────────────────────── */

/** Niveaux de risque, sémantique tri-couleur. */
export type RiskLevel = "faible" | "vigilance" | "eleve";

/** Statut renvoyé par le screening de sanctions. */
export type ScreeningStatus =
  | "clear" // aucune correspondance
  | "ppe" // personne politiquement exposée
  | "sanction" // correspondance liste de sanctions
  | "media" // média négatif / adverse media
  | "error" // appel impossible
  | "demo"; // mode démonstration (aucune clé) — NON probant

/** Une correspondance retournée par le fournisseur. */
export interface ScreeningMatch {
  nom: string;
  listes: string[]; // ex. ["OFAC SDN", "EU Consolidated"]
  type: string; // ex. "Sanction", "PEP", "Adverse media"
  score: number; // 0..100, pertinence fournie par le fournisseur
  pays?: string;
  // Gestion des faux positifs : une correspondance écartée (homonyme, etc.)
  // sort du calcul de risque mais reste tracée (justification + journal d'audit).
  ecarte?: boolean;
  justificationEcart?: string;
}

/** Résultat brut du screening pour un sujet (personne ou entité). */
export interface ScreeningResult {
  sujet: string; // nom du sujet screené (traçabilité)
  status: ScreeningStatus;
  matches: ScreeningMatch[];
  listesInterrogees: string[];
  fournisseur: string;
  horodatage: string; // ISO
  // Désambiguïsation : true si la date de naissance / nationalité ont pu
  // affiner la recherche (réduction des faux positifs).
  desambiguise: boolean;
  message?: string;
}

/** Sujet minimal transmis au screening. */
export interface ScreeningSubject {
  kind: ActorKind;
  nom: string; // nom de famille ou raison sociale
  prenoms?: string;
  dateNaissance?: string;
  nationalite?: string;
  pays?: string;
}

/** Une question Oui/Non/N-R, rattachée à une catégorie de sous-score. */
export interface AuditAnswer {
  id: string;
  question: string;
  categorie: string; // catégorie de sous-score
  // true = situation favorable, false = drapeau de vigilance, null = non renseigné
  reponse: boolean | null;
  flagValue: boolean; // la réponse qui lève un drapeau
  poids: number;
  // Source de l'indicateur (ex. ligne directrice GAFI) — traçabilité.
  source?: string;
}

/** Un sous-score explicable, par catégorie. */
export interface SubScore {
  categorie: string;
  niveau: RiskLevel;
  points: number;
  facteurs: string[]; // points retenus, en clair
}

/* ───────────────────────── Acteur ───────────────────────── */

export type ActorKind = "personne" | "entite";
export type ActorRole = "acheteur" | "vendeur" | "intermediaire";

/**
 * Bénéficiaire effectif d'une entité morale (UBO), éventuellement EN CASCADE :
 * un bénéficiaire peut lui-même être une entité avec ses propres bénéficiaires.
 * On remonte ainsi la chaîne de détention jusqu'aux personnes physiques.
 */
export interface BeneficialOwner {
  kind: ActorKind; // "personne" | "entite"
  pourcentage: string; // part déclarée du capital / contrôle (≥ 25 % = UBO)
  // Personne
  nom: string;
  prenoms: string;
  nationalite: string;
  // Entité intermédiaire
  formeJuridique: string;
  immatriculation: string;
  beneficiaires: BeneficialOwner[]; // récursif
}

/** Un acteur de la transaction : personne physique OU entité morale. */
export interface Actor {
  kind: ActorKind;
  role: ActorRole;
  // Communs
  nom: string; // nom de famille (personne) ou raison sociale (entité)
  pays: string; // résidence (personne) ou juridiction (entité)
  // Personne
  prenoms: string;
  dateNaissance: string;
  nationalite: string;
  pieceIdentite: string;
  // Entité
  formeJuridique: string;
  immatriculation: string;
  beneficiaires: BeneficialOwner[];
  // Indices de vigilance facultatifs (déclaratifs, jamais obligatoires)
  indices: AuditAnswer[];
  // Case acheteur : transaction au-dessus du seuil (défaut 10 000 €).
  // Si cochée, la pièce d'identité devient obligatoire pour créer le dossier.
  transactionSuperieureSeuil: boolean;
  // Document de pièce d'identité (data-URL locale, jamais transmise).
  pieceIdentiteDoc: string | null;
  pieceIdentiteDocNom: string | null;
}

/** Niveau de vigilance résultant de l'approche par les risques. */
export type VigilanceTier = "simplifiee" | "standard" | "renforcee";

/** Une pièce / information à collecter, justifiée par un motif légal. */
export interface CollectionItem {
  id: string;
  label: string;
  motif: string; // pourquoi cette pièce est requise (traçabilité)
}

/** Synthèse de vigilance d'un acteur. */
export interface ActorAssessment {
  niveau: RiskLevel;
  tier: VigilanceTier;
  sousScores: SubScore[];
  facteurs: string[]; // liste à plat, pour le rapport
  piecesACollecter: CollectionItem[];
  revueHumaineRequise: true;
}

/* ───────────────────────── Œuvre ───────────────────────── */

/** Catégorie d'œuvre — pilote une checklist et des pondérations sur-mesure. */
export type ArtworkCategory =
  | "peinture_dessin"
  | "estampe_multiple"
  | "sculpture"
  | "antiquite"
  | "photographie"
  | "autre";

/** Qualité documentaire d'un maillon de provenance (graduée). */
export type SourceType =
  | "aucune"
  | "mention" // mention orale / source secondaire
  | "facture"
  | "catalogue" // catalogue d'exposition ou de vente
  | "archive"; // archive notariée / photo d'époque

/** Un maillon de la chaîne de provenance. */
export interface ProvenanceEntry {
  id: string;
  periode: string; // ex. "1962–1978" ou "1939"
  proprietaire: string; // détenteur successif
  lieu: string;
  source: string; // pièce documentaire à l'appui (description libre)
  typeSource: SourceType; // qualité documentaire graduée
}

export type RegisterKind = "vol" | "spoliation";
export type RegisterResult = "non_verifie" | "aucune" | "correspondance";

/** Vérification dans un registre externe (vol ou spoliation). */
export interface RegisterCheck {
  id: string;
  registre: string; // nom lisible
  kind: RegisterKind;
  url: string; // lien direct vers la recherche (pré-rempli si possible)
  resultat: RegisterResult;
  horodatage?: string; // quand le résultat a été constaté
  note?: string;
}

/** Métadonnées déclaratives de l'œuvre. Aucune analyse d'image. */
export interface Artwork {
  categorie: ArtworkCategory;
  titre: string;
  artiste: string;
  annee: string;
  dimensions: string;
  technique: string;
  photoDataUrl: string | null; // aperçu local, jamais transmis
  photoNom: string | null;
  // Preuves matérielles structurées
  marquesDos: string; // étiquettes / cachets / numéros au dos
  edition: string; // multiples : n° de tirage, fondeur, posthume…
  premiereApparition: string; // première exposition / vente publique connue
  provenance: ProvenanceEntry[];
  registres: RegisterCheck[];
  audit: AuditAnswer[]; // checklist authenticité / titre (selon catégorie)
  redFlags: AuditAnswer[]; // indicateurs de risque GAFI (marché de l'art)
}

/** Synthèse de vigilance d'une œuvre. */
export interface ArtworkAssessment {
  niveau: RiskLevel;
  sousScores: SubScore[];
  facteurs: string[];
  revueHumaineRequise: true;
}

/* ───────────────────────── Marché / cote (vérif externe optionnelle) ───────────────────────── */

/**
 * Statut d'une vérification de cote / comparables d'enchères.
 *  • ok           : comparables obtenus auprès d'un fournisseur réel
 *  • insufficient : fournisseur réel interrogé mais trop peu de données
 *  • demo         : aucun fournisseur configuré — résultat illustratif NON probant
 *  • error        : appel impossible (jamais maquillé en résultat favorable)
 */
export type MarketStatus = "ok" | "insufficient" | "demo" | "error";

/** Un résultat d'enchère comparable, normalisé. */
export interface MarketComparable {
  titre: string;
  date: string; // date de vente (ISO ou texte libre du fournisseur)
  maison: string; // maison de vente
  prixEur: number; // adjugé, normalisé en EUR par le fournisseur quand possible
  source?: string; // référence / URL du lot
}

/** Résultat d'une interrogation de la cote d'un artiste. */
export interface MarketResult {
  artiste: string; // sujet interrogé (traçabilité)
  status: MarketStatus;
  comparables: MarketComparable[];
  // Fourchette observée sur les comparables (EUR). null si indéterminable.
  fourchetteEur: { min: number; max: number; mediane: number } | null;
  fournisseur: string;
  horodatage: string; // ISO
  message?: string;
}

/** Verdict de cohérence d'un prix de transaction vis-à-vis du marché observé. */
export interface PriceCoherence {
  verdict: "coherent" | "eleve" | "bas" | "indetermine";
  message: string;
  // true → l'outil SUGGÈRE de cocher l'indicateur GAFI « prix incohérent ».
  // C'est une aide : l'humain reste seul juge.
  suggereDrapeau: boolean;
}

/* ───────────────────────── Conformité (audit & décision) ───────────────────────── */

/** Type d'événement consigné dans la piste d'audit. */
export type AuditEventType =
  | "dossier_cree"
  | "screening_lance"
  | "screening_resultat"
  | "piece_ajoutee"
  | "piece_filigranee"
  | "registres_attestes"
  | "match_ecarte"
  | "gel_avoirs_signale"
  | "horodatage_appose"
  | "decision_saisie"
  | "dossier_archive";

/**
 * Un événement du journal d'audit, CHAÎNÉ par hash (tamper-evident).
 * Chaque événement intègre le hash du précédent : altérer un événement passé
 * casse la chaîne. Ce n'est PAS un horodatage notarié légal (tiers de confiance).
 */
export interface AuditEvent {
  seq: number; // position dans la chaîne (0..n)
  horodatage: string; // ISO
  type: AuditEventType;
  detail: string; // description lisible
  hashPrec: string; // hash de l'événement précédent ("GENESIS" pour le premier)
  hash: string; // hash SHA-256 de cet événement
}

/** Décision finale du professionnel assujetti — l'humain tranche. */
export type DecisionType = "poursuivre" | "refuser" | "attente" | "declaration";

export interface HumanDecision {
  type: DecisionType;
  motif: string;
  signataire: string;
  horodatage: string; // ISO
  // Signature manuscrite locale (data-URL PNG), optionnelle (#8).
  signatureDataUrl?: string;
}

/* ───────────────────────── Dossiers (historique) ───────────────────────── */

export type DossierKind = "acteur" | "oeuvre" | "transaction";

interface DossierBase {
  id: string;
  date: string; // ISO (création)
  kind: DossierKind;
  // Vigilance continue : date de la dernière revue / re-screening. Absent sur
  // les anciens dossiers → on retombe sur `date`.
  derniereRevue?: string; // ISO
  // Boucle de conformité : journal chaîné + décision humaine.
  auditTrail: AuditEvent[];
  decision: HumanDecision | null;
  // Horodatage qualifié RFC 3161 de l'empreinte du dossier (optionnel, cf.
  // Settings.horodatageActif). Absent tant que non sollicité.
  horodatage?: TimestampProof;
  // Saisie rapide « foire » (#13) : dossier ébauché en mobilité, à compléter au
  // retour (screening, pièces, décision).
  aFinaliser?: boolean;
}

/** Jeton d'horodatage RFC 3161 conservé (miroir de lib/timestamp.TimestampToken). */
export interface TimestampProof {
  hashHex: string;
  tsaUrl: string;
  tokenBase64: string;
  obtenuLe: string; // ISO
}

/** Dossier de due diligence d'un acteur seul. */
export interface ActorDossier extends DossierBase {
  kind: "acteur";
  actor: Actor;
  screening: ScreeningResult;
  beneficiairesScreening: ScreeningResult[];
  assessment: ActorAssessment;
}

/** Dossier de due diligence d'une œuvre seule. */
export interface ArtworkDossier extends DossierBase {
  kind: "oeuvre";
  artwork: Artwork;
  assessment: ArtworkAssessment;
}

/** Volet acteur tel qu'embarqué dans une transaction. */
export interface TransactionParty {
  actor: Actor;
  screening: ScreeningResult;
  beneficiairesScreening: ScreeningResult[];
  assessment: ActorAssessment;
}

/**
 * Nature de l'opération, qui détermine les parties réellement évaluées :
 *  • vente          : galerie/stock → acheteur (seul l'acheteur est évalué) ;
 *  • achat          : vendeur → galerie/stock (seul le vendeur est évalué) ;
 *  • intermediation : vendeur → acheteur (les deux sont évalués).
 * Dans les modes vente/achat, la galerie est sa propre contrepartie et n'est
 * donc pas « screenée ».
 */
export type TransactionMode = "vente" | "achat" | "intermediation";

/** Dossier de transaction : agrège les parties présentes + œuvre. */
export interface TransactionDossier extends DossierBase {
  kind: "transaction";
  mode: TransactionMode;
  montantEur: number | null;
  // Nullable selon le mode : `achat` n'a pas d'acheteur, `vente` pas de vendeur.
  acheteur: TransactionParty | null;
  vendeur: TransactionParty | null;
  oeuvre: { artwork: Artwork; assessment: ArtworkAssessment };
  comportement: AuditAnswer[]; // risque transactionnel (espèces, urgence…)
  // Synthèse agrégée
  niveau: RiskLevel;
  facteurs: string[];
}

export type Dossier = ActorDossier | ArtworkDossier | TransactionDossier;

/* ───────────────────────── Réglages ───────────────────────── */

/**
 * Fournisseur de données de marché (cote / comparables d'enchères).
 *  • aucun  : pas de vérif marché — l'indicateur prix reste à jugement humain.
 *  • artnet : Artnet (API-first, abonnement payant). Endpoint à renseigner.
 *  • custom : tout service REST respectant le contrat décrit dans api/market.
 * Aucune valeur n'est codée en dur : on ne prétend pas connaître l'API privée
 * d'un fournisseur — on fournit un connecteur générique « prêt à brancher ».
 */
export type MarketProvider = "aucun" | "artnet" | "custom";

export interface Settings {
  fournisseur: "sanctions_io" | "opensanctions" | "custom";
  apiKey: string;
  nomGalerie: string;
  signataire: string;
  // Seuil de déclenchement de la vigilance (marché de l'art ≈ 10 000 €).
  // Paramétrable et À VALIDER PAR UN JURISTE — aucune valeur n'a de portée
  // juridique en soi.
  seuilVigilanceEur: number;
  // Données de marché (optionnel, branchable le jour où un compte existe).
  marcheFournisseur: MarketProvider;
  marcheApiKey: string;
  marcheEndpoint: string; // URL de base du fournisseur (requis si ≠ "aucun")
  // Vigilance continue : un dossier non revu depuis ce nombre de mois est
  // signalé « à revoir ». Indicatif, À VALIDER PAR UN JURISTE.
  revueIntervalleMois: number;
  // Horodatage qualifié RFC 3161 (OPTIONNEL). Désactivé par défaut : c'est le
  // seul appel réseau sortant de l'outil. Activé, SEULE l'empreinte SHA-256 du
  // dossier quitte la machine (cf. lib/timestamp.ts).
  horodatageActif: boolean;
  horodatageTsaUrl: string; // URL de l'autorité d'horodatage (RFC 3161)
}
