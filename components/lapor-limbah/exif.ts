import type { WasteExifInfo } from '@/app/types/maritime';

/**
 * Parser EXIF minimal untuk JPEG: ekstrak koordinat GPS dan waktu pengambilan
 * foto di sisi klien, SEBELUM foto dikompres (kompresi menghapus EXIF).
 *
 * Baca struktur standar: SOI + APP1 (Exif\0\0) → header TIFF (II/MM) →
 * IFD0 (cari pointer GPS IFD & DateTimeOriginal). Dihentikan saat segmen
 * ditemukan; foto tanpa segmen EXIF mengembalikan null.
 */

export interface RawExifData {
  gpsLat?: number;
  gpsLon?: number;
  capturedAt?: string;
}

/** Konversi nilai rasional TIFF ([pembilang, penyebut]) ke angka. */
function rationalToNumber(r: number[] | undefined): number | null {
  if (!Array.isArray(r) || r.length === 0) return null;
  const num = r[0];
  const den = r[1] ?? 1;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

/** Konversi DMS (derajat, menit, detik) + ref (N/S/E/W) ke desimal. */
function dmsToDecimal(dms: number[] | undefined, ref: string | undefined): number | null {
  const d = rationalToNumber(dms?.slice(0, 2));
  const m = rationalToNumber(dms?.slice(2, 4));
  const s = rationalToNumber(dms?.slice(4, 6));
  if (d === null || m === null || s === null) return null;
  const value = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') return -value;
  return value;
}

interface Ifd {
  map: Record<number, {
    type: number;
    count: number;
    valueOffset: number;
    inline?: number[];
    ascii?: string;
    rationals?: number[];
  }>;
}

/** Baca satu IFD dari buffer pada offset tertentu. */
function readIfd(buf: Uint8Array, isLittle: boolean, offset: number): Ifd {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const get16 = (o: number) => (isLittle ? dv.getUint16(o, true) : dv.getUint16(o, false));
  const get32 = (o: number) => (isLittle ? dv.getUint32(o, true) : dv.getUint32(o, false));
  const getRationals = (o: number, count: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < count; i += 2) {
      const num = get32(o + i * 4);
      const den = get32(o + i * 4 + 4);
      out.push(num, den);
    }
    return out;
  };

  const map: Ifd['map'] = {};
  const count = get16(offset);
  for (let i = 0; i < count; i++) {
    const entry = offset + 2 + i * 12;
    const tag = get16(entry);
    const type = get16(entry + 2);
    const countValue = get32(entry + 4);
    const valueField = entry + 8;
    let inline: number[] = [];

    if (type === 1 && countValue <= 4) {
      // BYTE inline
      inline = Array.from({ length: countValue }, (_, k) => buf[valueField + k]);
    } else if (type === 2) {
      // ASCII — pointer (string)
      const ptr = get32(valueField);
      let end = ptr;
      while (end < buf.length && buf[end] !== 0) end++;
      inline = Array.from(buf.slice(ptr, Math.min(end, buf.length)));
    } else if ((type === 3 && countValue <= 2) || (type === 4 && countValue <= 1)) {
      // SHORT / LONG inline
      const words = type === 3 ? countValue : countValue * 2;
      for (let k = 0; k < words; k++) inline.push(get16(valueField + k * 2));
    }

    map[tag] = {
      type,
      count: countValue,
      valueOffset: get32(valueField),
      inline,
      ascii: type === 2 ? String.fromCharCode(...inline) : undefined,
      rationals: type === 5 ? getRationals(get32(valueField), countValue * 2) : undefined,
    };
  }
  return { map };
}

function asciiValue(raw: Ifd, tag: number): string | undefined {
  const entry = raw.map[tag];
  return entry?.ascii ?? undefined;
}

function rational(raw: Ifd, tag: number): number[] | undefined {
  return raw.map[tag]?.rationals;
}

export function parseExif(file: File): Promise<RawExifData | null> {
  return file
    .arrayBuffer()
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);

      // SOI JPEG
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

      let pos = 2;
      while (pos + 4 <= bytes.length) {
        if (bytes[pos] !== 0xff) {
          pos += 1;
          continue;
        }
        const marker = bytes[pos + 1];
        const size = (bytes[pos + 2] << 8) | bytes[pos + 3];
        if (size < 2) break;
        const payloadStart = pos + 4;
        const payloadEnd = payloadStart + size - 2;

        // APP1 EXIF
        if (marker === 0xe1 && payloadEnd <= bytes.length) {
          const sig = String.fromCharCode(...bytes.slice(payloadStart, payloadStart + 6));
          if (sig !== 'Exif\0\0') {
            pos = payloadEnd;
            continue;
          }
          const tiffStart = payloadStart + 6;
          if (tiffStart + 8 > bytes.length) return null;

          const isLittle = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
          if (!(isLittle || (bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d))) return null;

          const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const get32 = (o: number) => (isLittle ? dv.getUint32(o, true) : dv.getUint32(o, false));

          const ifd0Offset = get32(tiffStart + 4);
          if (ifd0Offset + 2 > bytes.length) return null;

          const ifd0 = readIfd(bytes, isLittle, tiffStart + ifd0Offset);

          const out: RawExifData = {};
          const dateTime = ifd0.map[0x9003]?.ascii ?? ifd0.map[0x9004]?.ascii;
          if (dateTime) {
            const cleaned = dateTime.trim();
            const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(cleaned);
            if (m) {
              const asLocalIso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
              const local = new Date(asLocalIso);
              if (local.getTime() === local.getTime()) {
                // tanpa timezone UTC: gunakan offset perangkat agar selisih tetap berarti
                out.capturedAt = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
              }
            }
          }

          const gpsPtrTag = ifd0.map[0x8825];
          if (gpsPtrTag && tiffStart + gpsPtrTag.valueOffset + 4 <= bytes.length) {
            try {
              const gps = readIfd(bytes, isLittle, tiffStart + gpsPtrTag.valueOffset);
              const latRef = asciiValue(gps, 1);
              const lonRef = asciiValue(gps, 3);
              const lat = dmsToDecimal(rational(gps, 2), latRef);
              const lon = dmsToDecimal(rational(gps, 4), lonRef);
              if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
                out.gpsLat = lat;
                out.gpsLon = lon;
              }
              if (!out.capturedAt) {
                const gpsDate = asciiValue(gps, 29)?.trim();
                const gpsTime = rational(gps, 7);
                if (gpsDate) {
                  const dm = /^(\d{4}):(\d{2}):(\d{2})$/.exec(gpsDate);
                  const h = rationalToNumber(gpsTime?.slice(0, 2));
                  const min = rationalToNumber(gpsTime?.slice(2, 4));
                  const sec = rationalToNumber(gpsTime?.slice(4, 6));
                  if (dm && h !== null && min !== null && sec !== null) {
                    const iso = `${dm[1]}-${dm[2]}-${dm[3]}T${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(min)).padStart(2, '0')}:${String(Math.floor(sec)).padStart(2, '0')}Z`;
                    const d = new Date(iso);
                    if (d.getTime() === d.getTime()) out.capturedAt = d.toISOString();
                  }
                }
              }
            } catch {
              // GPS IFD tidak valid — abaikan
            }
          }

          return Object.keys(out).length > 0 ? out : null;
        }

        // Selesai menelusuri IFD/JPEG data
        if (marker === 0xda || marker === 0xd9) break;
        pos = payloadEnd;
      }
      return null;
    })
    .catch(() => null);
}

/** Konversi hasil parser untuk payload API. */
export function toWasteExif(raw: RawExifData | null): WasteExifInfo | null {
  if (!raw) return null;
  return {
    gpsLat: raw.gpsLat,
    gpsLon: raw.gpsLon,
    capturedAt: raw.capturedAt ? `${new Date(raw.capturedAt).toISOString()}` : undefined,
  };
}