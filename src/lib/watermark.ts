/*
  Filigranage local INDÉLÉBILE des pièces justificatives.

  Objectif sécurité : une pièce d'identité / un Kbis importé dans l'outil ne doit
  pas pouvoir être détourné (fuite, réutilisation frauduleuse). Dès l'import, on
  incruste un filigrane dans les PIXELS de l'image (canvas local) rappelant sa
  destination exclusive. Rien ne sort de la machine : tout se fait dans le
  navigateur.

  `watermarkLabel` est PUR (testable). `applyWatermark` nécessite un DOM (canvas)
  et lève si appelé côté serveur — jamais exécuté au SSR.
*/

/** Date JJ/MM/AAAA déterministe (UTC) à partir d'un ISO. */
function frDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Texte du filigrane (destination + galerie + date). */
export function watermarkLabel(galerie: string, dateIso: string): string {
  const g = galerie.trim() || "[Galerie]";
  return `DUE DILIGENCE LCB-FT — ${g} — ${frDate(dateIso)}`;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = dataUrl;
  });
}

/**
 * Incruste un filigrane diagonal répété sur l'image et renvoie une NOUVELLE
 * data-URL (PNG). L'original en mémoire est remplacé par l'appelant. Navigateur
 * uniquement.
 */
export async function applyWatermark(dataUrl: string, label: string): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("applyWatermark : environnement navigateur requis.");
  }
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  ctx.drawImage(img, 0, 0, w, h);

  // Filigrane : texte répété en diagonale, semi-transparent, lisible mais discret.
  const fontSize = Math.max(14, Math.round(Math.min(w, h) / 22));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6); // ~ -30°
  const textWidth = ctx.measureText(label).width;
  const stepX = textWidth + fontSize * 2;
  const stepY = fontSize * 4;
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  for (let y = -diag; y < diag; y += stepY) {
    for (let x = -diag; x < diag; x += stepX) {
      ctx.fillText(label, x, y);
    }
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}
