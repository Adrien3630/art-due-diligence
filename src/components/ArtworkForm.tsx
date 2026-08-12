"use client";

/*
  Saisie d'une œuvre : catégorie → checklist sur-mesure, identité + preuves
  matérielles, provenance structurée (qualité de source graduée), registres,
  indicateurs GAFI.

  Honnêteté : AUCUNE analyse d'image. La recherche d'image inversée est menée par
  l'humain (on ouvre le moteur) ; on lit seulement les métadonnées EXIF du fichier.
*/

import { useMemo } from "react";
import { AutoField, Field, InlineAlert, SectionTitle, SelectField } from "@/components/ui";
import { AuditList } from "@/components/AuditList";
import { ImageDropzone } from "@/components/ImageDropzone";
import { MarketPanel } from "@/components/MarketPanel";
import {
  isPrefilled,
  registerDescription,
  registerSearchTerms,
  withPrefilledUrls,
} from "@/lib/registers";
import { rebuildArtworkAudit } from "@/lib/scoring";
import { readExifFromDataUrl } from "@/lib/exif";
import { searchArtworks } from "@/lib/antecedents";
import { suggest } from "@/lib/suggestions";
import { loadHistory } from "@/lib/storage";
import type {
  Artwork,
  ArtworkCategory,
  ProvenanceEntry,
  RegisterCheck,
  RegisterResult,
  SourceType,
} from "@/lib/types";

const CATEGORY_OPTS: { v: ArtworkCategory; label: string }[] = [
  { v: "peinture_dessin", label: "Peinture / dessin" },
  { v: "estampe_multiple", label: "Estampe / multiple" },
  { v: "sculpture", label: "Sculpture" },
  { v: "antiquite", label: "Antiquité / archéologie" },
  { v: "photographie", label: "Photographie" },
  { v: "autre", label: "Autre" },
];

const SOURCE_OPTS: { v: SourceType; label: string }[] = [
  { v: "aucune", label: "Aucune" },
  { v: "mention", label: "Mention / secondaire" },
  { v: "facture", label: "Facture" },
  { v: "catalogue", label: "Catalogue" },
  { v: "archive", label: "Archive / photo d'époque" },
];

const RESULT_OPTS: { v: RegisterResult; label: string }[] = [
  { v: "non_verifie", label: "Non vérifié" },
  { v: "aucune", label: "Aucune corresp." },
  { v: "correspondance", label: "Correspondance" },
];

function emptyEntry(): ProvenanceEntry {
  return {
    id: Math.random().toString(36).slice(2, 8),
    periode: "",
    proprietaire: "",
    lieu: "",
    source: "",
    typeSource: "aucune",
  };
}

function ImageTools({ artwork }: { artwork: Artwork }) {
  const exif = readExifFromDataUrl(artwork.photoDataUrl);
  const exifTxt = exif
    ? [exif.dateTime, [exif.make, exif.model].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className="mt-2 rounded-md border border-line bg-surface-2 p-3">
      <div className="label-eyebrow mb-1.5">Vérifier la photo (anti-vol / doublons)</div>
      <p className="mb-2 text-[0.72rem] leading-relaxed text-muted">
        Recherche d'image inversée : ouvrez un moteur et déposez-y la photo pour voir
        si la même image apparaît ailleurs. C'est VOUS qui menez la vérification —
        l'outil n'analyse pas l'image.
      </p>
      <div className="flex flex-wrap gap-4">
        <a
          href="https://lens.google.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
        >
          Google Lens ↗
        </a>
        <a
          href="https://tineye.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-[0.78rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
        >
          TinEye ↗
        </a>
      </div>
      <p className="mt-2 text-[0.7rem] text-muted">
        {exifTxt
          ? `Métadonnées du fichier : ${exifTxt}`
          : "Aucune métadonnée EXIF détectée dans le fichier."}
      </p>
    </div>
  );
}

function RegisterRow({
  check,
  terms,
  onChange,
}: {
  check: RegisterCheck;
  terms: string;
  onChange: (c: RegisterCheck) => void;
}) {
  const tone =
    check.resultat === "correspondance"
      ? "text-risk-high"
      : check.resultat === "aucune"
        ? "text-risk-low"
        : "text-muted";
  const prefilled = isPrefilled(check.id);
  return (
    <div className="border-b border-line py-3 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={check.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-ink underline-offset-2 hover:text-gold hover:underline"
          >
            {check.registre} ↗
          </a>
          <span
            className={`ml-2 rounded-full px-1.5 py-0.5 text-[0.6rem] ${
              prefilled ? "bg-risk-low-bg text-risk-low" : "bg-surface-2 text-muted"
            }`}
          >
            {prefilled ? "recherche pré-remplie" : "saisie manuelle"}
          </span>
          <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">
            {registerDescription(check.id)}
          </p>
          {!prefilled && terms && (
            <p className="mt-0.5 text-[0.7rem] text-ink-soft">
              Rechercher : «&nbsp;{terms}&nbsp;»
            </p>
          )}
        </div>
        <div className="w-40 shrink-0">
          <select
            className={`input-line ${tone}`}
            value={check.resultat}
            onChange={(e) =>
              onChange({
                ...check,
                resultat: e.target.value as RegisterResult,
                horodatage:
                  e.target.value === "non_verifie" ? undefined : new Date().toISOString(),
              })
            }
          >
            {RESULT_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/** Compteur de progression des vérifications de registres. */
function RegisterProgress({ checks }: { checks: RegisterCheck[] }) {
  const total = checks.length;
  const verifies = checks.filter((c) => c.resultat !== "non_verifie").length;
  const complet = verifies === total;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
        complet ? "bg-risk-low-bg text-risk-low" : "bg-surface-2 text-muted"
      }`}
    >
      {verifies}/{total} vérifié{verifies > 1 ? "s" : ""}
    </span>
  );
}

/**
 * Colonne de registres (vol ou spoliation) avec ouverture groupée « 1 clic »
 * des recherches restant à vérifier. On OUVRE les recherches ; c'est toujours
 * l'humain qui constate et consigne le résultat (aucun pré-cochage).
 */
function RegisterColumn({
  titre,
  list,
  terms,
  onChange,
}: {
  titre: string;
  list: RegisterCheck[];
  terms: string;
  onChange: (c: RegisterCheck) => void;
}) {
  const aVerifier = list.filter((c) => c.resultat === "non_verifie");
  const openAll = () => {
    for (const c of aVerifier) {
      if (c.url) window.open(c.url, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="label-eyebrow text-gold">{titre}</div>
        {aVerifier.length > 0 && (
          <button
            type="button"
            onClick={openAll}
            className="text-[0.7rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
          >
            Ouvrir les {aVerifier.length} recherche{aVerifier.length > 1 ? "s" : ""} à vérifier ↗
          </button>
        )}
      </div>
      {list.map((c) => (
        <RegisterRow key={c.id} check={c} terms={terms} onChange={onChange} />
      ))}
    </div>
  );
}

export function ArtworkForm({
  artwork,
  onChange,
  montantEur,
}: {
  artwork: Artwork;
  onChange: (a: Artwork) => void;
  // Présent en contexte transaction : alimente le verdict de cohérence du prix.
  montantEur?: number | null;
}) {
  const set = (patch: Partial<Artwork>) => onChange({ ...artwork, ...patch });

  const history = useMemo(() => loadHistory(), []);
  const artisteSugg = useMemo(() => suggest(history, "artiste"), [history]);
  const techniqueSugg = useMemo(() => suggest(history, "technique"), [history]);
  // Antécédent inter-dossiers (#9) : œuvre proche déjà évaluée.
  const antecedent = useMemo(() => {
    const q = [artwork.titre, artwork.artiste].filter(Boolean).join(" ");
    return searchArtworks(history, q, { limit: 1 })[0] ?? null;
  }, [history, artwork.titre, artwork.artiste]);

  // Reporte le signal « prix incohérent » dans l'indicateur GAFI correspondant.
  const flagPrix = () =>
    set({
      redFlags: artwork.redFlags.map((a) =>
        a.id === "rf_prix" ? { ...a, reponse: a.flagValue } : a,
      ),
    });

  const checks = withPrefilledUrls(artwork.registres, artwork);
  const terms = registerSearchTerms(artwork);
  const setCheck = (next: RegisterCheck) =>
    set({ registres: artwork.registres.map((c) => (c.id === next.id ? next : c)) });

  const updateEntry = (i: number, patch: Partial<ProvenanceEntry>) =>
    set({
      provenance: artwork.provenance.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    });

  const vol = checks.filter((c) => c.kind === "vol");
  const spoliation = checks.filter((c) => c.kind === "spoliation");
  const showEdition =
    artwork.categorie === "estampe_multiple" || artwork.categorie === "sculpture";

  return (
    <div className="space-y-6">
      {/* Identité */}
      <div>
        <SectionTitle eyebrow="Volet 1">Identité de l'œuvre</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Catégorie"
            value={artwork.categorie}
            onChange={(v) =>
              set({
                categorie: v as ArtworkCategory,
                audit: rebuildArtworkAudit(v as ArtworkCategory, artwork.audit),
              })
            }
          >
            {CATEGORY_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <Field label="Titre" value={artwork.titre} onChange={(e) => set({ titre: e.target.value })} placeholder="Sans titre" />
          <AutoField label="Artiste" value={artwork.artiste} onChange={(e) => set({ artiste: e.target.value })} placeholder="—" suggestions={artisteSugg} />
          {antecedent && (
            <div className="col-span-2 -mt-2">
              <InlineAlert tone="info">
                Œuvre proche déjà au dossier : <strong>{antecedent.nom}</strong> —{" "}
                {new Date(antecedent.date).toLocaleDateString("fr-FR")}.{" "}
                <button
                  type="button"
                  onClick={() =>
                    set({
                      provenance: antecedent.artwork.provenance,
                      registres: antecedent.artwork.registres,
                      marquesDos: antecedent.artwork.marquesDos,
                      premiereApparition: antecedent.artwork.premiereApparition,
                    })
                  }
                  className="font-medium underline underline-offset-2"
                >
                  Réimporter provenance & registres
                </button>
              </InlineAlert>
            </div>
          )}
          <Field label="Année" value={artwork.annee} onChange={(e) => set({ annee: e.target.value })} placeholder="1962" hint="Sert au contrôle spoliation 1933-1945 et aux incohérences." />
          <AutoField label="Technique" value={artwork.technique} onChange={(e) => set({ technique: e.target.value })} placeholder="Huile sur toile" suggestions={techniqueSugg} />
          <Field label="Dimensions" value={artwork.dimensions} onChange={(e) => set({ dimensions: e.target.value })} placeholder="73 × 92 cm" />
          {showEdition && (
            <div className="col-span-2">
              <Field label="Édition / tirage" value={artwork.edition} onChange={(e) => set({ edition: e.target.value })} placeholder="n° de tirage, fondeur, posthume…" />
            </div>
          )}
          <div className="col-span-2">
            <Field label="Première apparition publique connue" value={artwork.premiereApparition} onChange={(e) => set({ premiereApparition: e.target.value })} placeholder="Exposition / vente la plus ancienne" hint="Une œuvre « fraîche au marché » sans historique est un drapeau." />
          </div>
          <div className="col-span-2">
            <Field label="Marques / étiquettes au dos" value={artwork.marquesDos} onChange={(e) => set({ marquesDos: e.target.value })} placeholder="Cachets, étiquettes de galeries, numéros…" hint="Corroborent la provenance." />
          </div>
        </div>
        <div className="mt-5">
          <ImageDropzone
            value={artwork.photoDataUrl}
            fileName={artwork.photoNom}
            onChange={(dataUrl, name) => set({ photoDataUrl: dataUrl, photoNom: name })}
          />
          {artwork.photoDataUrl && <ImageTools artwork={artwork} />}
        </div>
      </div>

      {/* Provenance chronologique */}
      <div>
        <div className="flex items-center justify-between">
          <SectionTitle eyebrow="Volet 2">Chaîne de provenance</SectionTitle>
          <button
            type="button"
            onClick={() => set({ provenance: [...artwork.provenance, emptyEntry()] })}
            className="mb-5 text-[0.72rem] text-ink-soft underline-offset-2 hover:text-gold hover:underline"
          >
            + Ajouter un maillon
          </button>
        </div>
        <p className="-mt-3 mb-3 text-[0.72rem] leading-relaxed text-muted">
          Une ligne par détenteur successif, dans l'ordre chronologique. Le moteur
          détecte les ruptures (&gt; 30 ans), les incohérences et le trou 1933-1945,
          et pondère selon la qualité de la source.
        </p>
        {artwork.provenance.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong bg-surface-2 px-4 py-3 text-[0.74rem] text-muted">
            Aucun maillon renseigné — la provenance sera signalée comme absente.
          </div>
        ) : (
          <div className="space-y-3">
            {artwork.provenance.map((p, i) => (
              <div
                key={p.id}
                className="grid grid-cols-[0.7fr_1.1fr_0.8fr_1fr_0.9fr_auto] items-end gap-3 rounded-md border border-line bg-surface-2 p-3"
              >
                <Field label="Période" value={p.periode} onChange={(e) => updateEntry(i, { periode: e.target.value })} placeholder="1962–1978" />
                <Field label="Propriétaire" value={p.proprietaire} onChange={(e) => updateEntry(i, { proprietaire: e.target.value })} placeholder="Galerie / collectionneur" />
                <Field label="Lieu" value={p.lieu} onChange={(e) => updateEntry(i, { lieu: e.target.value })} placeholder="Paris" />
                <Field label="Source" value={p.source} onChange={(e) => updateEntry(i, { source: e.target.value })} placeholder="Réf. pièce" />
                <SelectField
                  label="Qualité"
                  value={p.typeSource}
                  onChange={(v) => updateEntry(i, { typeSource: v as SourceType })}
                >
                  {SOURCE_OPTS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
                <button
                  type="button"
                  onClick={() => set({ provenance: artwork.provenance.filter((_, j) => j !== i) })}
                  className="pb-2 text-[0.72rem] text-muted underline-offset-2 hover:text-risk-high hover:underline"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registres */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle eyebrow="Volet 3">Vérifications registres</SectionTitle>
          <RegisterProgress checks={checks} />
        </div>
        <p className="-mt-3 mb-4 text-[0.72rem] leading-relaxed text-muted">
          Les liens ouvrent une recherche pré-remplie (artiste + titre). La plupart
          de ces bases n'ont pas d'API : constatez le résultat et consignez-le
          vous-même. Tant qu'un registre n'est pas vérifié, il reste un point de
          vigilance. L'outil n'affirme jamais « aucun match » à votre place.
        </p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RegisterColumn titre="Œuvres volées" list={vol} terms={terms} onChange={setCheck} />
          <RegisterColumn
            titre="Spoliations (1933-1945)"
            list={spoliation}
            terms={terms}
            onChange={setCheck}
          />
        </div>
      </div>

      {/* Checklist authenticité / titre (selon catégorie) */}
      <div>
        <SectionTitle eyebrow="Volet 4">Authenticité & titre</SectionTitle>
        <AuditList answers={artwork.audit} onChange={(audit) => set({ audit })} />
      </div>

      {/* Cote / marché */}
      <div>
        <SectionTitle eyebrow="Volet 5">Cote de l'artiste</SectionTitle>
        <MarketPanel
          artiste={artwork.artiste}
          montantEur={montantEur}
          onFlagPrix={flagPrix}
        />
      </div>

      {/* Indicateurs GAFI */}
      <div>
        <SectionTitle eyebrow="Volet 6">Indicateurs de risque (GAFI)</SectionTitle>
        <p className="-mt-3 mb-2 text-[0.72rem] leading-relaxed text-muted">
          Indicateurs des lignes directrices GAFI pour le marché de l'art. À ne cocher
          que si présents — laissés vides, ils n'alourdissent pas le score.
        </p>
        <AuditList answers={artwork.redFlags} onChange={(redFlags) => set({ redFlags })} />
      </div>
    </div>
  );
}
