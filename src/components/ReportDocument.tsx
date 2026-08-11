"use client";

/*
  Rapport PDF de vigilance — généré 100 % localement dans le navigateur.
  Trois gabarits : Acteur, Œuvre, Transaction. Répartis par `downloadReport`.

  Wording HONNÊTE, non négociable :
  • « Synthèse des vérifications effectuées par la galerie ».
  • Jamais « œuvre authentifiée par IA » ni « certifié conforme ».
  • Rappel systématique : décision humaine, aide à la vigilance, pas de garantie.
*/

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { AUDIT_LABEL } from "@/lib/audit";
import { PENAL_RESPONSIBILITY_NOTICE, TRANSACTION_MODE_LABEL } from "@/lib/scoring";
import type {
  Actor,
  ActorDossier,
  Artwork,
  ArtworkCategory,
  ArtworkDossier,
  DecisionType,
  Dossier,
  RiskLevel,
  ScreeningResult,
  SubScore,
  TransactionDossier,
  VigilanceTier,
} from "@/lib/types";

const CATEGORY_LABEL: Record<ArtworkCategory, string> = {
  peinture_dessin: "Peinture / dessin",
  estampe_multiple: "Estampe / multiple",
  sculpture: "Sculpture",
  antiquite: "Antiquité / archéologie",
  photographie: "Photographie",
  autre: "Autre",
};

const DECISION_LABEL: Record<DecisionType, string> = {
  poursuivre: "Poursuivre la relation",
  attente: "Mettre en attente",
  refuser: "Refuser l'opération",
  declaration: "Déclarer un soupçon (Tracfin)",
};

const HEX: Record<RiskLevel, { fg: string; bg: string; label: string }> = {
  faible: { fg: "#3f7a57", bg: "#eef3ee", label: "RISQUE FAIBLE" },
  vigilance: { fg: "#b8862e", bg: "#f6efdf", label: "VIGILANCE" },
  eleve: { fg: "#a23b3b", bg: "#f6eaea", label: "RISQUE ÉLEVÉ" },
};

const TIER_HEX: Record<VigilanceTier, { fg: string; bg: string; label: string }> = {
  simplifiee: { fg: "#3f7a57", bg: "#eef3ee", label: "VIGILANCE SIMPLIFIÉE" },
  standard: { fg: "#b8862e", bg: "#f6efdf", label: "VIGILANCE STANDARD" },
  renforcee: { fg: "#a23b3b", bg: "#f6eaea", label: "VIGILANCE RENFORCÉE" },
};

const STATUT_LABEL: Record<string, string> = {
  clear: "Aucune correspondance",
  ppe: "Personne politiquement exposée (PPE)",
  media: "Média négatif (adverse media)",
  sanction: "Correspondance liste de sanctions",
  error: "Screening non abouti",
  demo: "Mode démonstration (non probant)",
};

const RESULT_LABEL: Record<string, string> = {
  non_verifie: "Non vérifié",
  aucune: "Aucune correspondance",
  correspondance: "Correspondance trouvée",
};

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 56, paddingHorizontal: 48, fontSize: 9.5, fontFamily: "Helvetica", color: "#17140f", lineHeight: 1.5 },
  brand: { fontFamily: "Times-Roman", fontSize: 20, color: "#17140f" },
  goldRule: { height: 1.4, width: 60, backgroundColor: "#c9b38a", marginTop: 6, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  metaRight: { textAlign: "right", fontSize: 8, color: "#8d8678" },
  h2: { fontFamily: "Times-Roman", fontSize: 13, marginBottom: 6, marginTop: 18, color: "#17140f" },
  sectionRule: { height: 0.8, backgroundColor: "#e7e1d4", marginBottom: 8 },
  row: { flexDirection: "row" },
  col: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 7, letterSpacing: 1, color: "#8d8678", textTransform: "uppercase", marginBottom: 2 },
  val: { fontSize: 10, marginBottom: 6 },
  macaronRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  macaron: { alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12, fontSize: 11, fontFamily: "Helvetica-Bold" },
  card: { borderWidth: 0.8, borderColor: "#e7e1d4", borderRadius: 6, padding: 12, marginBottom: 8 },
  li: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 10, color: "#9a7b4f" },
  liText: { flex: 1 },
  subRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.6, borderBottomColor: "#efeadd", paddingVertical: 2.5 },
  pieceRow: { flexDirection: "row", marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#efeadd", paddingVertical: 3 },
  disclaimer: { marginTop: 16, padding: 12, backgroundColor: "#fbf9f4", borderWidth: 0.8, borderColor: "#e7e1d4", borderRadius: 6, fontSize: 8, color: "#4a443b" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  sigBox: { width: "46%" },
  sigLine: { borderTopWidth: 0.8, borderTopColor: "#8d8678", marginTop: 34, paddingTop: 4, fontSize: 8, color: "#8d8678" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 7, color: "#8d8678", textAlign: "center", borderTopWidth: 0.6, borderTopColor: "#e7e1d4", paddingTop: 6 },
  artwork: { marginTop: 6, borderWidth: 0.8, borderColor: "#e7e1d4", borderRadius: 4, height: 150, objectFit: "contain" },
});

/* ───────────────── briques partagées ───────────────── */

function actorName(a: Actor): string {
  return a.kind === "entite" ? a.nom : `${a.prenoms} ${a.nom}`.trim();
}

function Header({ titre, id, date }: { titre: string; id: string; date: string }) {
  return (
    <View style={s.headerRow}>
      <View>
        <Text style={s.brand}>Provenance</Text>
        <View style={s.goldRule} />
        <Text style={{ fontSize: 8, color: "#8d8678" }}>{titre}</Text>
      </View>
      <View style={s.metaRight}>
        <Text>Réf. {id}</Text>
        <Text>{date}</Text>
      </View>
    </View>
  );
}

function Factors({ facteurs }: { facteurs: string[] }) {
  return (
    <View style={{ marginTop: 4 }}>
      {facteurs.map((f, i) => (
        <View key={i} style={s.li}>
          <Text style={s.bullet}>—</Text>
          <Text style={s.liText}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

function SubScoreTable({ scores }: { scores: SubScore[] }) {
  return (
    <View style={s.card}>
      {scores.map((sc) => (
        <View key={sc.categorie} style={s.subRow}>
          <Text style={{ flex: 1 }}>{sc.categorie}</Text>
          <Text style={{ color: HEX[sc.niveau].fg, fontFamily: "Helvetica-Bold" }}>
            {HEX[sc.niveau].label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScreeningLine({ titre, r }: { titre: string; r: ScreeningResult }) {
  const ecartes = r.matches.filter((m) => m.ecarte).length;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.eyebrow}>{titre}</Text>
      <Text style={{ fontSize: 9.5 }}>
        {r.sujet || "—"} — {STATUT_LABEL[r.status] ?? r.status}
        {r.listesInterrogees.length ? ` · ${r.listesInterrogees.join(", ")}` : ""}
        {ecartes ? ` · ${ecartes} faux positif(s) écarté(s)` : ""}
      </Text>
    </View>
  );
}

function Disclaimer({ extra }: { extra?: string }) {
  return (
    <View style={s.disclaimer}>
      <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>
        Portée et limites de ce document
      </Text>
      <Text>
        Ce rapport est une SYNTHÈSE des vérifications effectuées et déclarées par la
        galerie. Il constitue une aide à la vigilance LCB-FT et NE VAUT NI
        authentification de l'œuvre, NI garantie d'absence de risque. Les niveaux et
        seuils sont indicatifs et doivent être validés par un juriste.{extra ? ` ${extra}` : ""}
        Toute décision (poursuite, déclaration de soupçon, refus) relève de
        l'appréciation humaine du professionnel assujetti.
      </Text>
      <Text style={{ marginTop: 5, fontFamily: "Helvetica-Oblique" }}>
        {PENAL_RESPONSIBILITY_NOTICE}
      </Text>
    </View>
  );
}

function Signature({ date }: { date: string }) {
  return (
    <View style={s.sigRow}>
      <View style={s.sigBox}>
        <Text style={s.eyebrow}>Établi par</Text>
        <Text style={s.sigLine}>Nom, qualité et signature</Text>
      </View>
      <View style={s.sigBox}>
        <Text style={s.eyebrow}>Date</Text>
        <Text style={s.sigLine}>{date}</Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <Text style={s.footer} fixed>
      Provenance · Document généré localement, aucune donnée transmise en dehors de
      l'appel de screening · Confidentiel
    </Text>
  );
}

function ComplianceSection({ dossier }: { dossier: Dossier }) {
  const d = dossier.decision;
  return (
    <View wrap={false}>
      <Text style={s.h2}>Décision & journal d'audit</Text>
      <View style={s.sectionRule} />
      <Text style={s.eyebrow}>Décision du professionnel assujetti</Text>
      {d ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.val}>
            {DECISION_LABEL[d.type]} — {new Date(d.horodatage).toLocaleString("fr-FR")}
          </Text>
          {d.motif ? <Text style={{ marginBottom: 3 }}>Motif : {d.motif}</Text> : null}
          <Text style={{ fontSize: 8, color: "#8d8678" }}>
            Signataire : {d.signataire || "—"}
          </Text>
        </View>
      ) : (
        <Text style={[s.val, { color: "#b8862e" }]}>Décision en attente.</Text>
      )}
      <Text style={s.eyebrow}>Journal d'audit ({dossier.auditTrail.length} événements)</Text>
      <View style={s.card}>
        {dossier.auditTrail.map((e) => (
          <View key={e.seq} style={s.tableRow}>
            <Text style={{ width: 96, fontSize: 8, color: "#8d8678" }}>
              {new Date(e.horodatage).toLocaleString("fr-FR")}
            </Text>
            <Text style={{ flex: 1, fontSize: 8.5 }}>
              {AUDIT_LABEL[e.type]} — {e.detail}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────── volets réutilisables ───────────────── */

function ActorBody({
  actor,
  screening,
  beneficiaires,
  tier,
  niveau,
  sousScores,
  pieces,
}: {
  actor: Actor;
  screening: ScreeningResult;
  beneficiaires: ScreeningResult[];
  tier: VigilanceTier;
  niveau: RiskLevel;
  sousScores: SubScore[];
  pieces: { label: string; motif: string }[];
}) {
  const m = HEX[niveau];
  const t = TIER_HEX[tier];
  return (
    <View>
      <View style={s.macaronRow}>
        <View style={[s.macaron, { backgroundColor: t.bg, color: t.fg }]}>
          <Text>{t.label}</Text>
        </View>
        <View style={[s.macaron, { backgroundColor: m.bg, color: m.fg }]}>
          <Text>{m.label}</Text>
        </View>
      </View>

      <View style={[s.row, { marginTop: 6 }]}>
        <View style={s.col}>
          <Text style={s.eyebrow}>{actor.kind === "entite" ? "Entité" : "Personne"}</Text>
          <Text style={s.val}>{actorName(actor) || "—"}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.eyebrow}>{actor.kind === "entite" ? "Juridiction" : "Pays / nationalité"}</Text>
          <Text style={s.val}>
            {actor.kind === "entite"
              ? actor.pays || "—"
              : `${actor.pays || "—"}${actor.nationalite ? ` · ${actor.nationalite}` : ""}`}
          </Text>
        </View>
      </View>

      {actor.pieceIdentiteDoc ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={s.eyebrow}>Pièce d'identité au dossier</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={actor.pieceIdentiteDoc}
            style={{ width: 150, height: 95, objectFit: "cover", borderWidth: 0.8, borderColor: "#e7e1d4", borderRadius: 4 }}
          />
        </View>
      ) : null}

      <SubScoreTable scores={sousScores} />

      <ScreeningLine titre="Screening de l'acteur" r={screening} />
      {beneficiaires.map((r, i) => (
        <ScreeningLine key={i} titre={`Bénéficiaire effectif ${i + 1}`} r={r} />
      ))}

      <Text style={[s.eyebrow, { marginTop: 6 }]}>Pièces à collecter</Text>
      {pieces.length === 0 ? (
        <Text style={{ color: "#3f7a57" }}>
          Aucune pièce intrusive requise (vigilance simplifiée).
        </Text>
      ) : (
        pieces.map((p, i) => (
          <View key={i} style={s.pieceRow}>
            <Text style={s.bullet}>—</Text>
            <Text style={s.liText}>
              {p.label}
              <Text style={{ color: "#8d8678" }}> — {p.motif}</Text>
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function ArtworkBody({ artwork, sousScores }: { artwork: Artwork; sousScores: SubScore[] }) {
  const provenance = artwork.provenance.filter((p) => p.proprietaire.trim());
  return (
    <View>
      <Text style={s.val}>
        {artwork.titre || "—"}
        {artwork.artiste ? ` — ${artwork.artiste}` : ""}
        {artwork.annee ? ` (${artwork.annee})` : ""}
      </Text>
      <Text style={{ fontSize: 8, color: "#8d8678", marginBottom: 4 }}>
        {CATEGORY_LABEL[artwork.categorie]}
        {artwork.premiereApparition ? ` · 1re apparition : ${artwork.premiereApparition}` : ""}
        {artwork.edition ? ` · édition : ${artwork.edition}` : ""}
        {artwork.marquesDos ? ` · dos : ${artwork.marquesDos}` : ""}
      </Text>
      {artwork.photoDataUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={artwork.photoDataUrl} style={s.artwork} />
      ) : null}

      <SubScoreTable scores={sousScores} />

      <Text style={s.eyebrow}>Chaîne de provenance</Text>
      <View style={s.card}>
        {provenance.length === 0 ? (
          <Text style={{ color: "#8d8678" }}>Aucun maillon renseigné.</Text>
        ) : (
          provenance.map((p) => (
            <View key={p.id} style={s.tableRow}>
              <Text style={{ width: 70 }}>{p.periode || "—"}</Text>
              <Text style={{ flex: 1 }}>{p.proprietaire}</Text>
              <Text style={{ width: 90, color: "#8d8678" }}>{p.lieu || "—"}</Text>
              <Text style={{ width: 110, color: "#8d8678", fontSize: 8 }}>
                {p.source || "sans source"}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={s.eyebrow}>Vérifications registres</Text>
      <View style={s.card}>
        {artwork.registres.map((r) => (
          <View key={r.id} style={s.subRow}>
            <Text style={{ flex: 1 }}>{r.registre}</Text>
            <Text
              style={{
                color:
                  r.resultat === "correspondance"
                    ? "#a23b3b"
                    : r.resultat === "aucune"
                      ? "#3f7a57"
                      : "#8d8678",
              }}
            >
              {RESULT_LABEL[r.resultat]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────── documents par type ───────────────── */

function ActorReport({ dossier }: { dossier: ActorDossier }) {
  const date = new Date(dossier.date).toLocaleString("fr-FR");
  return (
    <Document title={`Dossier client — ${actorName(dossier.actor) || "acteur"}`} author="Provenance">
      <Page size="A4" style={s.page}>
        <Header titre="Dossier client — vigilance LCB-FT" id={dossier.id} date={date} />
        <Text style={s.h2}>Synthèse de vigilance</Text>
        <View style={s.sectionRule} />
        <ActorBody
          actor={dossier.actor}
          screening={dossier.screening}
          beneficiaires={dossier.beneficiairesScreening}
          tier={dossier.assessment.tier}
          niveau={dossier.assessment.niveau}
          sousScores={dossier.assessment.sousScores}
          pieces={dossier.assessment.piecesACollecter}
        />
        <Text style={s.h2}>Facteurs retenus</Text>
        <View style={s.sectionRule} />
        <Factors facteurs={dossier.assessment.facteurs} />
        <ComplianceSection dossier={dossier} />
        <Disclaimer />
        <Signature date={date} />
        <Footer />
      </Page>
    </Document>
  );
}

function ArtworkReport({ dossier }: { dossier: ArtworkDossier }) {
  const date = new Date(dossier.date).toLocaleString("fr-FR");
  const m = HEX[dossier.assessment.niveau];
  return (
    <Document title={`Vigilance œuvre — ${dossier.artwork.titre || "œuvre"}`} author="Provenance">
      <Page size="A4" style={s.page}>
        <Header titre="Rapport de vigilance œuvre — provenance" id={dossier.id} date={date} />
        <Text style={s.h2}>Synthèse de provenance</Text>
        <View style={s.sectionRule} />
        <View style={[s.macaron, { backgroundColor: m.bg, color: m.fg }]}>
          <Text>{m.label}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <ArtworkBody artwork={dossier.artwork} sousScores={dossier.assessment.sousScores} />
        </View>
        <Text style={s.h2}>Facteurs retenus</Text>
        <View style={s.sectionRule} />
        <Factors facteurs={dossier.assessment.facteurs} />
        <ComplianceSection dossier={dossier} />
        <Disclaimer />
        <Signature date={date} />
        <Footer />
      </Page>
    </Document>
  );
}

function TransactionReport({ dossier }: { dossier: TransactionDossier }) {
  const date = new Date(dossier.date).toLocaleString("fr-FR");
  const m = HEX[dossier.niveau];
  const flags = dossier.comportement.filter((a) => a.reponse !== null && a.reponse === a.flagValue);
  return (
    <Document title="Dossier transaction — vigilance LCB-FT" author="Provenance">
      <Page size="A4" style={s.page}>
        <Header titre="Rapport de transaction — LCB-FT" id={dossier.id} date={date} />
        <Text style={s.h2}>Synthèse de la transaction</Text>
        <View style={s.sectionRule} />
        <View style={s.macaronRow}>
          <View style={[s.macaron, { backgroundColor: m.bg, color: m.fg }]}>
            <Text>{m.label}</Text>
          </View>
          <Text style={{ alignSelf: "center", color: "#8d8678" }}>
            {TRANSACTION_MODE_LABEL[dossier.mode]}
            {dossier.montantEur != null
              ? ` · Montant : ${dossier.montantEur.toLocaleString("fr-FR")} €`
              : ""}
          </Text>
        </View>
        <Factors facteurs={dossier.facteurs} />
        {flags.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={s.eyebrow}>Comportement transactionnel</Text>
            {flags.map((a) => (
              <View key={a.id} style={s.li}>
                <Text style={s.bullet}>—</Text>
                <Text style={s.liText}>{a.question}</Text>
              </View>
            ))}
          </View>
        )}

        {dossier.acheteur && (
          <>
            <Text style={s.h2}>Acheteur</Text>
            <View style={s.sectionRule} />
            <ActorBody
              actor={dossier.acheteur.actor}
              screening={dossier.acheteur.screening}
              beneficiaires={dossier.acheteur.beneficiairesScreening}
              tier={dossier.acheteur.assessment.tier}
              niveau={dossier.acheteur.assessment.niveau}
              sousScores={dossier.acheteur.assessment.sousScores}
              pieces={dossier.acheteur.assessment.piecesACollecter}
            />
          </>
        )}

        {dossier.vendeur && (
          <>
            <Text style={s.h2}>Vendeur</Text>
            <View style={s.sectionRule} />
            <ActorBody
              actor={dossier.vendeur.actor}
              screening={dossier.vendeur.screening}
              beneficiaires={dossier.vendeur.beneficiairesScreening}
              tier={dossier.vendeur.assessment.tier}
              niveau={dossier.vendeur.assessment.niveau}
              sousScores={dossier.vendeur.assessment.sousScores}
              pieces={dossier.vendeur.assessment.piecesACollecter}
            />
          </>
        )}

        <Text style={s.h2} break>
          Œuvre
        </Text>
        <View style={s.sectionRule} />
        <ArtworkBody
          artwork={dossier.oeuvre.artwork}
          sousScores={dossier.oeuvre.assessment.sousScores}
        />

        <ComplianceSection dossier={dossier} />
        <Disclaimer />
        <Signature date={date} />
        <Footer />
      </Page>
    </Document>
  );
}

/* ───────────────── répartiteur + téléchargement ───────────────── */

function ReportDocument({ dossier }: { dossier: Dossier }) {
  if (dossier.kind === "acteur") return <ActorReport dossier={dossier} />;
  if (dossier.kind === "oeuvre") return <ArtworkReport dossier={dossier} />;
  return <TransactionReport dossier={dossier} />;
}

function reportFileName(dossier: Dossier): string {
  const raw =
    dossier.kind === "acteur"
      ? actorName(dossier.actor) || "acteur"
      : dossier.kind === "oeuvre"
        ? dossier.artwork.titre || "oeuvre"
        : "transaction";
  const safe = raw.replace(/[^\p{L}\p{N}]+/gu, "_") || dossier.kind;
  const prefix = dossier.kind === "acteur" ? "dossier_client" : `rapport_${dossier.kind}`;
  return `${prefix}_${safe}.pdf`;
}

/** Génère le PDF et déclenche le téléchargement immédiat dans le navigateur. */
export async function downloadReport(dossier: Dossier): Promise<void> {
  const blob = await pdf(<ReportDocument dossier={dossier} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFileName(dossier);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
