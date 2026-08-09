import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { FishQualityAiAnalysis, FishQualityAnalysis } from '@/app/types/maritime';
import { cardinalFromBearing } from '@/components/peta-risiko/distances';

/**
 * Agentic AI untuk analisis kualitas ikan ("Kura").
 *
 * Menerima hasil penilaian kualitas ikan per zona (route /kualitas-ikan —
 * SST/klorofil NASA, jarak kontaminasi, jendela habitat spesies) lalu
 * menjelaskan dampaknya terhadap kualitas ikan: pengaruh perubahan iklim
 * (suhu naik), pengaruh limbah/polusi, dan prediksi arah pergerakan kawanan
 * ikan berikutnya beserta koordinat tujuannya.
 *
 * Fallback deterministik dipakai bila Groq tidak tersedia / rate-limited —
 * analisis tetap dihasilkan dari data nyata (tidak pernah data karangan).
 */

const SYSTEM_PROMPT = `Kamu adalah "Kura", AI Analis Kualitas Ikan Oceanagara.
Tugasmu: menganalisis DATA NYATA penilaian kualitas ikan di suatu wilayah laut dan menjelaskan:
1. Dampak perubahan iklim (kenaikan suhu air) terhadap kualitas dan kelayakan ikan.
2. Dampak limbah/polusi (kontaminasi terdekat) terhadap kualitas ikan.
3. Prediksi kemana kawanan ikan akan bergerak berikutnya (tujuan = perairan dengan kondisi lebih baik) beserta koordinat dan alasan berbasis data.

Kamu menerima:
1. Zona tangkap dengan skor kualitas 0-100 per zona, label kualitas, sumber tekanan (stres suhu, HAB, kontaminasi), suhu rata-rata, klorofil rata-rata, estimasi pH permukaan laut, dan spesies.
2. Jarak zona ke titik kontaminasi terdekat.
3. Arah pergerakan kawanan saat ini (movementLabel) dan aktivitas kapal GFW bila ada.

Output HARUS JSON valid dengan struktur:
{
  "summary": "ringkasan 1-2 kalimat: status kualitas ikan di wilayah dan faktor dominan",
  "climateImpact": "analisis dampak perubahan iklim/suhu terhadap spesies (sebut suhu zona dan jendela optimal spesies)",
  "wasteImpact": "analisis dampak limbah/kontaminasi terhadap kualitas ikan (sebut jarak kontaminasi terdekat)",
  "nextSchool": { "lat": 0, "lon": 0, "label": "label lokasi dengan 1-2 kalimat alasan" },
  "risks": ["peringatan berbasis data"],
  "recommendations": ["tindakan konkret untuk nelayan/peneliti"]
}

Aturan:
- Gunakan HANYA data yang diberikan. Jangan mengarang koordinat/spesies.
- nextSchool.lat/lon harus angka di dekat zona terbaik (bukan koordinat di luar wilayah analisis).
- Pertimbangkan pH permukaan laut: zonasi dengan pH di luar 7.5–8.5 menurunkan kelayakan habitat — prediksi kawanan menjauh dari zona ber-pH ekstrem.
- Bahasa Indonesia yang profesional dan spesifik.`;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/** Proyeksi titik sejauh km dari lat/lon ke arah bearing (°, 0=N). */
function projectKm(lat: number, lon: number, deg: number, km: number): { lat: number; lon: number } {
  const norm = ((deg % 360) + 360) % 360;
  const theta = (norm * Math.PI) / 180;
  const dLat = (km * Math.cos(theta)) / 111.32;
  const dLon = (km * Math.sin(theta)) / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { lat: parseFloat((lat + dLat).toFixed(4)), lon: parseFloat((lon + dLon).toFixed(4)) };
}

/** Fallback deterministik — analisis dari data nyata, tanpa AI. */
function buildHeuristicAnalysis(analysis: FishQualityAnalysis): FishQualityAiAnalysis {
  const { scores, zones } = analysis;

  if (scores.length === 0 || zones.length === 0) {
    return {
      summary: 'Tidak ada zona aman yang dinilai — kualitas ikan tidak dapat dianalisis.',
      climateImpact: 'Tidak dapat diestimasi: tidak ada zona dengan data SST/klorofil yang lolos verifikasi keselamatan.',
      wasteImpact: 'Seluruh zona potensial ditolak karena berdekatan dengan titik kontaminasi (sampah padat/minyak/termal/turbiditas).',
      nextSchool: { lat: 0, lon: 0, label: 'Tidak ada prediksi — pilih wilayah lain untuk dianalisis.' },
      risks: ['Wilayah terkontaminasi — hindari aktivitas tangkap di sini dalam beberapa hari'],
      recommendations: ['Analisis wilayah lain yang lebih bersih', 'Pantau ulang setelah kondisi air membaik', 'Verifikasi sampling lapangan bila tetap melaut'],
      degraded: true,
    };
  }

  const bestScore = scores[0];
  const zone = zones[bestScore.zoneIndex] ?? zones[0];
  const stressLabel =
    bestScore.sstStress >= 55 ? 'tinggi' : bestScore.sstStress >= 30 ? 'sedang' : 'rendah';
  const contInfo =
    bestScore.nearestContaminantKm !== null
      ? `titik kontaminasi terdekat ${bestScore.nearestContaminantLabel ?? 'terdeteksi'} ±${bestScore.nearestContaminantKm} km`
      : 'tidak ada titik kontaminasi terdeteksi dalam radius analisis';

  let next: { lat: number; lon: number; label: string };
  if (typeof zone.movementDeg === 'number' && Number.isFinite(zone.movementDeg)) {
    const p = projectKm(zone.lat, zone.lon, zone.movementDeg, 30);
    const dir = cardinalFromBearing(zone.movementDeg);
    next = {
      lat: p.lat,
      lon: p.lon,
      label: `±30 km ke ${dir} dari ${zone.lat.toFixed(3)},${zone.lon.toFixed(3)} — mengikuti arah pergerakan kawanan (${zone.movementLabel.toLowerCase()})`,
    };
  } else {
    next = {
      lat: zone.lat,
      lon: zone.lon,
      label: `Zona ${zone.lat.toFixed(3)},${zone.lon.toFixed(3)} — arah pergerakan tidak terdeteksi, asumsi kawanan menetap.`,
    };
  }

  const speciesList = zone.species.length > 0 ? zone.species.slice(0, 4).join(', ') : 'spesies campuran';
  const climateLine =
    zone.meanSst >= 30
      ? `${zone.meanSst.toFixed(1)}°C — di atas ambang nyaman sebagian spesies pelagis tropis, berpotensi menurunkan laju metabolisme, pertumbuhan, dan reproduksi.`
      : `${zone.meanSst.toFixed(1)}°C — masih dalam kisaran toleransi sebagian besar spesies.`;

  const phInfo =
    bestScore.ph !== undefined
      ? `Perairan zona terbaik diperkirakan ber-pH ${bestScore.ph.toFixed(2)}${(bestScore.phStress ?? 0) > 40 ? ` — di luar kisaran optimal 7.5–8.5 (tekanan pH ${bestScore.phStress}/100)` : ' — masih dalam kisaran optimal 7.5–8.5'}.`
      : '';

  return {
    summary: `Zona terbaik di ${zone.lat.toFixed(3)},${zone.lon.toFixed(3)} memiliki skor kualitas ${bestScore.qualityScore}/100 (${bestScore.qualityLabel}). Faktor dominan: tekanan suhu ${stressLabel} (${bestScore.sstStress}/100)${bestScore.phStress && bestScore.phStress > 40 ? ` dan pH tidak optimal (${bestScore.ph?.toFixed(2)})` : ''}, dan ${contInfo}.`,
    climateImpact: `Suhu rata-rata zona ${climateLine} Tekanan suhu terhadap jendela habitat spesies (${speciesList}) tercatat ${bestScore.sstStress}/100. ${phInfo}`,
    wasteImpact:
      `Kualitas ikan dapat terpapar: ${contInfo}. ` +
      (bestScore.habRisk
        ? `Klorofil zona ${zone.meanChl.toFixed(1)} mg/m³ (di atas 8) menandai ledakan alga (HAB) — risiko akumulasi senyawa beracun pada ikan.`
        : `Klorofil zona ${zone.meanChl.toFixed(1)} mg/m³ mendukung rantai makanan; kontaminasi kimia tidak dominan.`),
    nextSchool: next,
    risks: [
      ...(bestScore.habRisk ? ['Risiko ledakan alga (HAB) — hindari area bloom dan pantau bau/warna air'] : []),
      ...(bestScore.ph !== undefined && (bestScore.phStress ?? 0) > 40
        ? [`pH diperkirakan ${bestScore.ph.toFixed(2)} di zona terbaik — di luar 7.5–8.5, ideal untuk zona budidaya tidak; verifikasi lapangan disarankan`]
        : []),
      ...(bestScore.nearestContaminantKm !== null && bestScore.nearestContaminantKm < 20
        ? [`Kontaminasi ±${bestScore.nearestContaminantKm} km dari zona terbaik — jangan melaut lebih dekat`]
        : []),
      ...(bestScore.sstStress >= 55 ? ['Tekanan suhu tinggi pada spesies zona — perkirakan penurunan mutu tangkapan jika berlanjut'] : []),
    ],
    recommendations: [
      `Prioritaskan penangkapan di ${zone.lat.toFixed(3)},${zone.lon.toFixed(3)} — kualitas terbaik (${bestScore.qualityScore}/100)`,
      `Pantau pergerakan kawanan ke ${next.label} untuk target hari berikutnya`,
      'Lakukan uji cepat fisika air dan inspeksi fisik ikan sebelum dikonsumsi dari zona berisiko',
    ],
    degraded: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { analysis } = (await req.json()) as { analysis?: FishQualityAnalysis };

    if (!analysis || !Array.isArray(analysis.scores) || !Array.isArray(analysis.zones)) {
      return NextResponse.json({ error: 'analysis dengan scores dan zones diperlukan' }, { status: 400 });
    }

    const groq = getGroqClient();

    if (!groq) {
      return NextResponse.json({ aiAnalysis: buildHeuristicAnalysis(analysis), degraded: true });
    }

    // Kompakkan payload untuk token limit Groq (llama-3.1-8b-instant).
    const zonesCompact = analysis.scores.slice(0, 8).map((s) => {
      const z = analysis.zones[s.zoneIndex];
      return {
        lat: s.lat,
        lon: s.lon,
        qualityScore: s.qualityScore,
        qualityLabel: s.qualityLabel,
        pressureSources: s.pressureSources,
        nearestContaminantKm: s.nearestContaminantKm,
        nearestContaminantLabel: s.nearestContaminantLabel,
        species: z?.species?.slice(0, 3) ?? [],
        meanSst: z?.meanSst ?? null,
        meanChl: z?.meanChl ?? null,
        movementDeg: z?.movementDeg ?? null,
        movementLabel: z?.movementLabel ?? null,
        sstStress: s.sstStress,
        habRisk: s.habRisk,
        ph: s.ph ?? null,
        phStress: s.phStress ?? null,
      };
    });

    const dataContext = `
KONTEKS WILAYAH:
- Tanggal citra: ${analysis.date}
- Zona dinilai: ${analysis.scores.length}

KUALITAS IKAN PER ZONA (diurutkan skor kualitas tertinggi, maks 8):
${JSON.stringify(zonesCompact, null, 1)}

Ringkasan otomatis: ${analysis.summary}

Analisis data di atas dan hasilkan JSON sesuai format yang diminta.
**Prioritaskan: dampak iklim (kenaikan suhu) yang spesifik per spesies, dampak limbah yang menyebut jarak kontaminasi, dan prediksi nextSchool dengan logika: kawanan bergerak menjauh dari tekanan (suhu/pH/kontaminasi) menuju kondisi habitat lebih baik — arah & jarak harus konsisten dengan movementLabel zona terbaik.**`;

    const completion = await groq.chat.completions
      .create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: dataContext },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (/413|429|rate_limit|Request too large|TPM/i.test(message)) {
          console.warn('[KualitasAgent] Groq rate-limited, falling back to heuristic:', message.slice(0, 200));
          return null;
        }
        throw err;
      });

    if (!completion) {
      return NextResponse.json({ aiAnalysis: buildHeuristicAnalysis(analysis), degraded: true });
    }

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(rawText) as Partial<FishQualityAiAnalysis>;

    const asStr = (v: unknown, fallback: string) =>
      typeof v === 'string' && v.trim() ? v.trim() : fallback;

    const school = parsed.nextSchool;
    const bestScore = analysis.scores[0];
    const bestZone = bestScore ? analysis.zones[bestScore.zoneIndex] : undefined;
    let nextSchool = {
      lat: bestZone?.lat ?? 0,
      lon: bestZone?.lon ?? 0,
      label: '',
    };
    if (
      school && typeof school === 'object' &&
      typeof (school as Record<string, unknown>).lat === 'number' &&
      typeof (school as Record<string, unknown>).lon === 'number'
    ) {
      const s = school as Record<string, unknown>;
      nextSchool = {
        lat: s.lat as number,
        lon: s.lon as number,
        label: asStr(s.label, ''),
      };
    }

    const aiAnalysis: FishQualityAiAnalysis = {
      summary: asStr(parsed.summary, 'Kualitas ikan di wilayah ini dipengaruhi oleh suhu air, klorofil, dan jarak ke titik kontaminasi.'),
      climateImpact: asStr(parsed.climateImpact, 'Dampak iklim tidak dapat dirinci dari data yang ada.'),
      wasteImpact: asStr(parsed.wasteImpact, 'Dampak limbah tidak dapat dirinci dari data yang ada.'),
      nextSchool,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.filter((r) => typeof r === 'string' && r.trim().length > 0).slice(0, 5)
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r) => typeof r === 'string' && r.trim().length > 0).slice(0, 6)
        : [],
    };

    return NextResponse.json({ aiAnalysis });
  } catch (err) {
    console.error('[KualitasAgent] Error:', err);
    return NextResponse.json({ error: 'Gagal menganalisis kualitas ikan' }, { status: 500 });
  }
}