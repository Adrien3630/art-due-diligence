/*
  Fabriques d'états vierges. Centralise la composition des checklists et
  référentiels pour ne pas la dupliquer dans les écrans.
*/

import {
  freshActorIndices,
  freshArtworkAudit,
  freshArtworkRedFlags,
} from "./scoring";
import { freshRegisterChecks } from "./registers";
import type { Actor, ActorRole, Artwork, BeneficialOwner } from "./types";

export function emptyBeneficiary(): BeneficialOwner {
  return {
    kind: "personne",
    pourcentage: "",
    nom: "",
    prenoms: "",
    nationalite: "",
    formeJuridique: "",
    immatriculation: "",
    beneficiaires: [],
  };
}

export function emptyActor(role: ActorRole = "acheteur"): Actor {
  return {
    kind: "personne",
    role,
    nom: "",
    pays: "",
    prenoms: "",
    dateNaissance: "",
    nationalite: "",
    pieceIdentite: "",
    formeJuridique: "",
    immatriculation: "",
    beneficiaires: [],
    indices: freshActorIndices(),
    transactionSuperieureSeuil: false,
    pieceIdentiteDoc: null,
    pieceIdentiteDocNom: null,
  };
}

export function emptyArtwork(): Artwork {
  return {
    categorie: "peinture_dessin",
    titre: "",
    artiste: "",
    annee: "",
    dimensions: "",
    technique: "",
    photoDataUrl: null,
    photoNom: null,
    marquesDos: "",
    edition: "",
    premiereApparition: "",
    provenance: [],
    registres: freshRegisterChecks(),
    audit: freshArtworkAudit("peinture_dessin"),
    redFlags: freshArtworkRedFlags(),
  };
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}
