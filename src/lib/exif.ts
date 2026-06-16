/*
  Lecture EXIF MINIMALE d'une image JPEG (data-URL locale).

  On extrait quelques métadonnées du FICHIER (date de prise de vue, appareil) à
  titre indicatif — ce n'est PAS une analyse de l'œuvre. Best-effort : renvoie
  null si absent ou illisible. Aucune donnée n'est transmise.
*/

export interface ExifInfo {
  dateTime?: string;
  make?: string;
  model?: string;
}

export function readExifFromDataUrl(dataUrl: string | null): ExifInfo | null {
  if (!dataUrl) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  // EXIF n'existe que dans les JPEG.
  if (!/jpe?g/i.test(dataUrl.slice(0, comma))) return null;
  try {
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return parseExif(bytes);
  } catch {
    return null;
  }
}

function parseExif(bytes: Uint8Array): ExifInfo | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return null; // SOI JPEG

  let offset = 2;
  while (offset + 4 < dv.byteLength) {
    const marker = dv.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) break;
    const segLen = dv.getUint16(offset + 2);
    if (marker === 0xffe1) {
      const segStart = offset + 4;
      // "Exif\0\0"
      if (dv.getUint32(segStart) === 0x45786966) {
        return parseTiff(dv, segStart + 6);
      }
    }
    offset += 2 + segLen;
  }
  return null;
}

function parseTiff(dv: DataView, tiff: number): ExifInfo {
  const le = dv.getUint16(tiff) === 0x4949; // "II" little-endian, "MM" big
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const info: ExifInfo = {};

  const readAscii = (entryOff: number): string => {
    const count = u32(entryOff + 4);
    const valOff = count <= 4 ? entryOff + 8 : tiff + u32(entryOff + 8);
    let s = "";
    for (let i = 0; i < count && valOff + i < dv.byteLength; i++) {
      const c = dv.getUint8(valOff + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };

  const walk = (ifd: number, onTag: (tag: number, entryOff: number) => void) => {
    if (ifd + 2 > dv.byteLength) return;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > dv.byteLength) break;
      onTag(u16(e), e);
    }
  };

  const ifd0 = tiff + u32(tiff + 4);
  let exifIfd = 0;
  walk(ifd0, (tag, e) => {
    if (tag === 0x010f) info.make = readAscii(e);
    else if (tag === 0x0110) info.model = readAscii(e);
    else if (tag === 0x0132 && !info.dateTime) info.dateTime = readAscii(e);
    else if (tag === 0x8769) exifIfd = tiff + u32(e + 8);
  });
  if (exifIfd) {
    walk(exifIfd, (tag, e) => {
      if (tag === 0x9003) info.dateTime = readAscii(e); // DateTimeOriginal
    });
  }
  return info;
}
