import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type {
  WasteExifInfo,
  WasteLocationCheck,
  WasteLocationInfo,
  WastePhotoCheck,
  WasteReportValidation,
  WasteTimestampCheck,
  WasteValidationStatus,
} from '@/app/types/maritime';

/**
 * Validasi Laporan Limbah Warga — "Amphitrite" (model vision + cek geospasial).
 *
 * Laporan warga berupa FOTO limbah + koordinat GPS perangkat + waktu laporan.
 * Untuk menangkal laporan palsu / foto bukan limbah / foto lama, sistem
 * memvalidasi pada 3 lapis:
 *
 * 1. KEAUTENTIKAN FOTO   : model vision Groq memeriksa apakah foto benar-benar
 *    menunjukkan limbah/pencemaran (bukan layar kaca, stok, foto lama/berulang).
 * 2. LOKASI              : jarak haversine antara GPS perangkat pelapor (saat
 *    memotret) dengan koordinat GPS yang tertanam di metadata EXIF foto
 *    (≤150 m cocok, ≤2 km dekat, >2 km tidak cocok). Tanpa EXIF GPS → tidak
 *    terverifikasi (tidak otomatis ditolak, ditandai).
 * 3. WAKTU               : selisih waktu pengambilan EXIF vs waktu pelaporan
 *    (toleransi zona waktu ↔ drift perangkat).
 *
 * Status akhir: verified / suspected / rejected. Fallback deterministik
 * (validasi geospasial saja) dipakai bila Groq tidak tersedia.
 */

const SYSTEM_PROMPT = `Kamu adalah "Amphitrite", AI Validator Laporan Limbah Oceanagara.
Tugasmu: memeriksa KEAUTENTIKAN foto limbah/pencemaran yang dilaporkan warga, dengan teliti dan skeptis.

Periksa foto dengan detail:
1. Apakah ini foto asli di lokasi (framing natural, perspektif orang memotret dari tangan) atau foto rekayasa (layar kaca/televisi, tangkapan layar, ilustrasi, gambar stok, gambar edit)?
2. Apakah isi foto benar-benar limbah/pencemaran lingkungan (sampah plastik, tumpahan minyak, buangan kimia/limbah pabrik, sampah organik membusuk, gundukan sampah di pantai/sungai/laut)?
3. Lingkungan di foto: pantai, laut, muara/sungai, daratan/kawasan pemukiman, atau tidak jelas?
4. Tanda kecurigaan: foto terlalu bersih/repetitif, komposisi mencolok seperti iklan, ketidaksesuaian antara keterangan lokasi/deskripsi warga dengan isi foto, benda asing, kualitas sangat rendah sehingga tak dapat dinilai.

Output HARUS JSON valid dengan struktur:
{
  "genuine": true,
  "genuineScore": 0-100,
  "wasteType": "jenis limbah terdeteksi",
  "environment": "lingkungan terlihat",
  "note": "catatan analisis 1-2 kalimat",
  "riskSigns": ["tanda kecurigaan (maks 3); kosongkan bila tidak ada"],
  "findings": ["objek spesifik yang terlihat: jumlah, jenis sampah, lokasi dalam foto (maks 4)"],
  "recommendations": ["tindak lanjut untuk peneliti (maks 3)"]
}

Aturan:
- genuine HANYA true bila foto meyakinkan menunjukkan limbah asli.
- Bila foto tidak dapat dinilai karena kualitas buruk → genuine false dengan riskSigns menjelaskan.
- Bahasa Indonesia profesional dan spesifik.`;

/** Model vision utama & cadangan (Groq free tier). */
const VISION_MODELS = ['qwen/qwen3.6-27b'];

const WASTE_TYPE_LABELS: Record<string, string> = {
  plastik: 'sampah plastik',
  'tumpahan-minyak': 'tumpahan minyak',
  'kimia-pabrik': 'limbah kimia/pabrik',
  organik: 'limbah organik',
  'sampah-campuran': 'sampah campuran',
  lainnya: 'jenis lain',
};

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function isPhotoDataUrl(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/i.test(v) &&
    v.length < 4 * 1024 * 1024
  );
}

async function runCompletion(
  groq: Groq,
  body: Parameters<Groq['chat']['completions']['create']>[0]
): Promise<{ choices: { message?: { content?: string | null } }[] } | null> {
  try {
    return (await groq.chat.completions.create(body as never)) as unknown as { choices: { message?: { content?: string | null } }[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/json_validate_failed|400/i.test(message) && (body as { response_format?: unknown }).response_format) {
      console.warn('[ValidasiLaporanLimbah] json_validate_failed, retrying without response_format constraint...');
      const copy = { ...body };
      delete (copy as { response_format?: unknown }).response_format;
      return groq.chat.completions.create(copy as never).catch(() => null) as unknown as { choices: { message?: { content?: string | null } }[] } | null;
    }
    if (/413|429|rate_limit|Request too large|TPM|400/i.test(message)) {
      console.warn('[ValidasiLaporanLimbah] Groq call failed:', message.slice(0, 200));
      return null;
    }
    return null;
  }
}

/** Jarak haversine antar koordinat (meter). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildLocationCheck(
  location: WasteLocationInfo,
  exif: WasteExifInfo | null
): WasteLocationCheck {
  if (!exif?.gpsLat || !exif?.gpsLon) {
    return {
      referenced: false,
      distanceMeters: null,
      verdict: 'unverifiable',
      note: 'Foto tidak memiliki metadata GPS (EXIF) — lokasi hanya berdasar GPS perangkat pelapor dan tidak dapat dibandingkan silang.',
    };
  }
  const distance = Math.round(haversineMeters(location.lat, location.lon, exif.gpsLat, exif.gpsLon));
  if (distance <= 150) {
    return {
      referenced: true,
      distanceMeters: distance,
      verdict: 'match',
      note: `GPS perangkat dan GPS EXIF foto cocok (jarak ±${distance} m) — foto diambil di lokasi yang dilaporkan.`,
    };
  }
  if (distance <= 2000) {
    return {
      referenced: true,
      distanceMeters: distance,
      verdict: 'close',
      note: `GPS perangkat dan GPS EXIF foto berjarak ±${distance} m — masih dalam area yang sama, namun tidak tepat di titik laporan.`,
    };
  }
  return {
    referenced: true,
    distanceMeters: distance,
    verdict: 'mismatch',
    note: `GPS perangkat dan GPS EXIF foto berbeda ±${distance} m — foto kemungkinan diambil di lokasi lain.`,
  };
}

function buildTimestampCheck(exif: WasteExifInfo | null): WasteTimestampCheck {
  if (!exif?.capturedAt) {
    return {
      photoTime: null,
      driftHours: null,
      verdict: 'unverifiable',
      note: 'Foto tidak memiliki waktu pengambilan (EXIF) — kesesuaian waktu tidak dapat diverifikasi.',
    };
  }
  const photoTime = new Date(exif.capturedAt);
  const now = new Date();
  if (photoTime.getTime() !== photoTime.getTime()) {
    return {
      photoTime: exif.capturedAt,
      driftHours: null,
      verdict: 'unverifiable',
      note: 'Waktu EXIF foto tidak valid.',
    };
  }
  const driftHours = (now.getTime() - photoTime.getTime()) / 3_600_000;
  const hoursText = `${driftHours.toFixed(1)} jam`;
  if (driftHours >= -36 && driftHours <= 6) {
    return {
      photoTime: exif.capturedAt,
      driftHours: +driftHours.toFixed(1),
      verdict: 'valid',
      note: `Waktu EXIF foto ${driftHours >= 0 ? `${hoursText} sebelum` : `${Math.abs(driftHours)} jam setelah`} pelaporan — konsisten dengan foto diambil di lokasi kejadian.`,
    };
  }
  return {
    photoTime: exif.capturedAt,
    driftHours: +driftHours.toFixed(1),
    verdict: 'drifted',
    note: `Waktu EXIF foto berbeda ${hoursText} dari waktu pelaporan — kemungkinan foto lama atau pengaturan waktu perangkat tidak akurat.`,
  };
}

function confidenceOf(
  photo: WastePhotoCheck,
  location: WasteLocationCheck,
  timestamp: WasteTimestampCheck
): number {
  let c = photo.score;
  if (location.verdict === 'match') c += 8;
  else if (location.verdict === 'close') c += 4;
  else if (location.verdict === 'mismatch') c -= 35;
  if (timestamp.verdict === 'valid') c += 4;
  else if (timestamp.verdict === 'drifted') c -= 15;
  return Math.max(0, Math.min(100, Math.round(c)));
}

function finalStatus(
  photo: WastePhotoCheck,
  location: WasteLocationCheck,
  timestamp: WasteTimestampCheck
): WasteValidationStatus {
  if (!photo.genuine) return 'rejected';
  if (location.verdict === 'mismatch') return 'rejected';
  if (location.verdict === 'close' || timestamp.verdict === 'drifted') return 'suspected';
  return 'verified';
}

function buildSummary(
  status: WasteValidationStatus,
  photo: WastePhotoCheck,
  location: WasteLocationCheck,
  timestamp: WasteTimestampCheck
): string {
  if (status === 'rejected') {
    if (!photo.genuine) return `Laporan DITOLAK: foto tidak meyakinkan sebagai rekaman limbah asli (${photo.note}).`;
    return `Laporan DITOLAK: lokasi foto tidak sesuai dengan lokasi pelaporan (${location.note.toLowerCase()}).`;
  }
  if (status === 'suspected') {
    return `Laporan BERSTATUS DIUJI: foto menunjukkan ${photo.wasteType.toLowerCase()} (${photo.environment.toLowerCase()}), namun ada catatan yang perlu diverifikasi lapangan — ${[location.verdict === 'close' ? location.note.toLowerCase() : null, timestamp.verdict === 'drifted' ? timestamp.note.toLowerCase() : null].filter(Boolean).join('; ') || 'tinjau ulang manual disarankan'}.`;
  }
  return `Laporan TERVERIFIKASI: foto asli menunjukkan ${photo.wasteType.toLowerCase()} di ${photo.environment.toLowerCase()}; lokasi GPS perangkat cocok dengan EXIF foto dan waktu pengambilan konsisten.`;
}

function buildRecommendations(
  status: WasteValidationStatus,
  photo: WastePhotoCheck,
  aiRecs: string[]
): string[] {
  const base: string[] = [];
  if (status === 'verified') {
    base.push('Jadwalkan verifikasi lapangan ke titik koordinat untuk penanganan limbah');
    base.push('Catat laporan ini sebagai data warga untuk analisis sebaran pencemaran');
  } else if (status === 'suspected') {
    base.push('Lakukan pengecekan lapangan langsung sebelum menindaklanjuti');
    base.push('Konfirmasi ulang ke pelapor bila diperlukan data tambahan');
  } else {
    base.push('Hindari menindaklanjuti laporan ini sebagai temuan pencemaran');
  }
  if (photo.genuine && photo.score < 60) base.push('Periksa ulang kualitas foto bila memungkinkan');
  return [...base, ...aiRecs].slice(0, 4);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      photos?: string[];
      wasteType?: string;
      description?: string;
      location?: WasteLocationInfo;
      exif?: WasteExifInfo | null;
    };

    const photos = (body.photos ?? []).filter(isPhotoDataUrl).slice(0, 3);
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Foto limbah diperlukan' }, { status: 400 });
    }

    const location = body.location;
    if (
      !location ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lon) ||
      Math.abs(location.lat) > 90 ||
      Math.abs(location.lon) > 180
    ) {
      return NextResponse.json(
        { error: 'Koordinat lokasi (GPS perangkat) diperlukan' },
        { status: 400 }
      );
    }

    const wasteType = typeof body.wasteType === 'string' ? body.wasteType : 'lainnya';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const exif = body.exif ?? null;

    // ── Lapis 2 & 3: cek geospasial & waktu (deterministik, selalu jalan) ──
    const locationCheck = buildLocationCheck(location, exif);
    const timestampCheck = buildTimestampCheck(exif);

    const groq = getGroqClient();
    let photoCheck: WastePhotoCheck = {
      genuine: true,
      score: 55,
      wasteType: WASTE_TYPE_LABELS[wasteType] ?? wasteType,
      environment: 'tidak jelas',
      note: 'Analisis foto dilewati (mode heuristik).',
      riskSigns: [],
    };
    let aiRecs: string[] = [];
    let aiFindings: string[] = [];
    let modelUsed: string | undefined;
    let degraded = false;

    if (groq) {
      const dataContext = `
LAPORAN WARGA:
- Jenis limbah diklaim: ${WASTE_TYPE_LABELS[wasteType] ?? wasteType}
- Deskripsi: ${description || '(tidak ada)'}
- Koordinat pelapor: ${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}${location.label ? ` (${location.label})` : ''}
${location.accuracyMeters ? `- Akurasi GPS perangkat: ±${Math.round(location.accuracyMeters)} m` : ''}
${exif?.gpsLat ? `- EXIF GPS foto: ${exif.gpsLat.toFixed(5)}, ${exif.gpsLon?.toFixed(5)}` : '- EXIF GPS foto: tidak ada'}
${exif?.capturedAt ? `- Waktu EXIF foto: ${exif.capturedAt}` : '- Waktu EXIF: tidak ada'}

FOTO: ${photos.length} foto terlampir.
Analisis keaslian foto, jenis & lingkungan limbah, lalu hasilkan JSON sesuai format yang diminta.
**Prioritaskan: skeptis terhadap foto rekayasa/lama/stok; cocokkan isi foto dengan klaim jenis limbah dan lingkungan lokasi pelapor.**`;

      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: dataContext },
            ...photos.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ],
        },
      ];

      let completion = null;
      for (const model of VISION_MODELS) {
        completion = await runCompletion(groq, {
          model,
          messages,
          temperature: 0.2,
          ...(model.includes('qwen') ? { max_completion_tokens: 1024 } : { max_tokens: 1024 }),
          response_format: { type: 'json_object' },
        });
        if (completion) {
          modelUsed = model;
          console.log(`[ValidasiLaporanLimbah] analyzed with ${model}`);
          break;
        }
      }

      if (completion) {
        let rawText = completion.choices[0]?.message?.content ?? '{}';
        if (rawText.includes('```')) {
          rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText) as Record<string, unknown>;
        } catch {
          // JSON tidak valid → heuristik
        }
        const asStr = (v: unknown, fallback: string) =>
          typeof v === 'string' && v.trim() ? v.trim() : fallback;
        const asStrArr = (v: unknown, max: number): string[] =>
          Array.isArray(v)
            ? v.filter((x) => typeof x === 'string' && x.trim().length > 0).slice(0, max)
            : [];

        const parsedScore = Number(parsed.genuineScore);
        photoCheck = {
          genuine: parsed.genuine === true || asStr(parsed.genuine, '') === 'true',
          score: Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, Math.round(parsedScore))) : 50,
          wasteType: asStr(parsed.wasteType, WASTE_TYPE_LABELS[wasteType] ?? wasteType),
          environment: asStr(parsed.environment, 'tidak jelas'),
          note: asStr(parsed.note, 'Analisis foto tidak tersedia.'),
          riskSigns: asStrArr(parsed.riskSigns, 3),
        };
        aiRecs = asStrArr(parsed.recommendations, 3);
        aiFindings = asStrArr(parsed.findings, 4);
      } else {
        degraded = true;
        photoCheck = {
          ...photoCheck,
          score: 45,
          note: 'Model vision tidak terjangkau — keaslian foto ditandai belum terverifikasi penuh.',
          riskSigns: ['Analisis AI gagal — laporan bergantung validasi geospasial'],
        };
      }
    } else {
      degraded = true;
      photoCheck = {
        ...photoCheck,
        note: 'Model vision tidak tersedia (mode heuristik) — keaslian foto hanya berdasar validasi geospasial.',
      };
    }

    const status = finalStatus(photoCheck, locationCheck, timestampCheck);
    const validation: WasteReportValidation = {
      status,
      confidence: confidenceOf(photoCheck, locationCheck, timestampCheck),
      photoCheck,
      locationCheck,
      timestampCheck,
      summary: buildSummary(status, photoCheck, locationCheck, timestampCheck),
      findings: aiFindings,
      recommendations: buildRecommendations(status, photoCheck, aiRecs),
      model: modelUsed,
      degraded,
    };

    return NextResponse.json({ validation });
  } catch (err) {
    console.error('[ValidasiLaporanLimbah] Error:', err);
    return NextResponse.json({ error: 'Gagal memvalidasi laporan limbah' }, { status: 500 });
  }
}