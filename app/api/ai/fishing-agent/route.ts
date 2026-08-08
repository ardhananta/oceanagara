import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { FishingAiAnalysis, FishingZoneAnalysis } from '@/app/types/maritime';

/**
 * Agentic AI untuk rekomendasi zona tangkap ikan ("Nala").
 *
 * Alur: data mentah (klorofil/SST NASA, arus BMKG, kontaminasi Sentinel-2,
 * aktivitas kapal GFW) sudah diambil & dihitung oleh route /zona-tangkap —
 * agent ini MENGANALISIS hasilnya: memilih zona terbaik, menjelaskan arah
 * pergerakan kawanan ikan (menuju mana & mengapa), dan menyusun saran
 * berbasis konsentrasi kapal penangkap komersial Global Fishing Watch
 * (AIS/VMS real-time & historis — indikator migrasi ikan komersial).
 *
 * Fallback deterministik dipakai bila Groq tidak tersedia / rate-limited —
 * analisis tetap dihasilkan dari data nyata (tidak pernah data karangan).
 */

const SYSTEM_PROMPT = `Kamu adalah "Nala", AI Analis Perikanan Oceanagara.
Tugasmu: menganalisis DATA NYATA zona tangkap ikan dan memberikan rekomendasi yang dapat ditindaklanjuti oleh nelayan/peneliti.

Kamu menerima:
1. Zona tangkap potensial hasil pemodelan klorofil × suhu (NASA GIBS) dengan skor 0-1, spesies ikan (jendela suhu/klorofil), suhu, klorofil, jarak pantai, arah pergerakan kawanan.
2. Hotspot konsentrasi kapal penangkap Global Fishing Watch (AIS/VMS real-time & historis kapal besar Indonesia — trawler, longliner, purse seiner) dengan heading dominan kapal (indikator kemana ikan komersial bermigrasi).
3. Konteks wilayah (wilayah laut Indonesia).

Output HARUS JSON valid dengan struktur:
{
  "recommendedZoneIndex": [indeks zona terbaik di array zones, mulai 0],
  "recommendation": "ringkasan 1-2 kalimat mengapa zona itu terbaik",
  "movementAnalysis": "analisis arah pergerakan kawanan ikan: MENUJU ARAH MANA (sebut arah mata angin) dan bukti pendukung (arus BMKG / gradien klorofil / heading kapal GFW)",
  "gfwSuggestion": "saran spesifik berdasarkan konsentrasi kapal penangkap GFW: wilayah mana yang ramai aktivitas penangkapan, arah migrasi ikan komersial, dan implikasinya untuk pemilihan zona",
  "risks": ["peringatan berbasis data, mis. bloom klorofil, dekat kontaminasi, zona kurang aktivitas kapal"],
  "recommendations": ["tindakan konkret, mis. waktu melaut, jarak dari pantai, konfirmasi lapangan"]
}

Aturan:
- Gunakan HANYA data yang diberikan. Jangan mengarang koordinat/spesies.
- Jika data GFW adalah simulasi (isMock: true), katakan di gfwSuggestion bahwa API GFW tidak terjangkau sehingga saran berbasis data kapal terbatas.
- recommendedZoneIndex harus valid (0 sampai zones.length-1). Jika zones kosong, set null.
- Bahasa Indonesia yang profesional dan spesifik.`;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/** Fallback deterministik — analisis dari data nyata, tanpa AI. */
function buildHeuristicAnalysis(analysis: FishingZoneAnalysis): FishingAiAnalysis {
  const zones = analysis.zones;
  const gfw = analysis.gfw;

  if (zones.length === 0) {
    return {
      recommendedZoneIndex: undefined,
      recommendation: 'Tidak ada zona yang lolos verifikasi keselamatan di wilayah ini.',
      movementAnalysis:
        'Pergerakan kawanan tidak dapat diprediksi karena tidak ada zona aman — seluruh zona potensial ditolak karena dekat titik kontaminasi (sampah padat/minyak/termal/turbiditas).',
      gfwSuggestion:
        gfw && !gfw.isMock && gfw.hotspots.length > 0
          ? `GFW mendeteksi ${gfw.totalEvents} event kapal di wilayah ini (${gfw.fishingEvents} menangkap, ${gfw.loiteringEvents} berhenti) — konsentrasi penangkapan berada di sekitar ${gfw.hotspots
              .slice(0, 2)
              .map((h) => `${h.lat},${h.lon}`)
              .join(' dan ')}. Namun zona tersebut terkontaminasi, jadi hindari.`
          : 'Data GFW tidak tersedia saat ini. Verifikasi aktivitas kapal penangkap secara langsung di lapangan.',
      risks: ['Zona potensial ditolak karena kontaminasi', ...(analysis.rejectedZones > 0 ? [`${analysis.rejectedZones} zona ditolak verifikasi`] : [])],
      recommendations: ['Pilih wilayah lain dengan aktivitas penangkapan aman', 'Pantau ulang dalam beberapa hari setelah kondisi air membaik'],
      degraded: true,
    };
  }

  const best = [...zones].sort((a, b) => b.score - a.score)[0];
  const bestIndex = zones.indexOf(best);
  const gfwNearBest = best.nearbyVessels ?? 0;

  return {
    recommendedZoneIndex: bestIndex,
    recommendation: `Zona terbaik di ${best.lat.toFixed(4)},${best.lon.toFixed(4)} (skor ${(best.score * 100).toFixed(0)}/100) — habitat optimal untuk ${best.species.length ? best.species.slice(0, 3).join(', ') : 'spesies campuran'} dengan luas ±${best.areaKm2.toLocaleString('id-ID')} km².`,
    movementAnalysis:
      best.movementDeg !== undefined
        ? `Kawanan diperkirakan bergerak ${best.movementLabel.toLowerCase()} — arah ${best.movementDeg}°.`
        : 'Arah pergerakan tidak dapat diestimasi dari data arus/klorofil.',
    gfwSuggestion:
      gfw && !gfw.isMock
        ? `GFW mendeteksi ${gfw.totalEvents} event kapal (${gfw.fishingEvents} menangkap, ${gfw.loiteringEvents} berhenti) dalam 7 hari. ${gfwNearBest > 0 ? `Zona terbaik ini memiliki ${gfwNearBest} kapal penangkap dalam radius 30 km — bukti feeding ground komersial aktif di sana.` : 'Zona terbaik belum menunjukkan konsentrasi kapal penangkap — pertimbangkan zona lain yang lebih ramai aktivitas penangkapan.'} ${gfw.hotspots.length > 0 ? `Konsentrasi penangkapan tertinggi: ${gfw.hotspots[0].lat},${gfw.hotspots[0].lon} (${gfw.hotspots[0].count} event${gfw.hotspots[0].headingDeg !== undefined ? `, heading dominan ${gfw.hotspots[0].headingDeg}°` : ''}).` : ''}`
        : 'Data GFW tidak tersedia saat ini — lakukan verifikasi aktivitas kapal penangkap langsung di lapangan.',
    risks: [
      ...(best.flagged ? [best.flagged] : []),
      ...(analysis.avoidedCount > 0 ? [`${analysis.avoidedCount} titik kontaminasi dihindari di wilayah ini`] : []),
      ...(gfw && !gfw.isMock && best.nearbyVessels === 0 ? ['Zona terbaik minim aktivitas kapal penangkap — tangkapan mungkin lebih rendah'] : []),
    ],
    recommendations: [
      `Prioritaskan melaut di ${best.lat.toFixed(4)},${best.lon.toFixed(4)} ${best.movementDeg !== undefined ? `dan perkirakan kawanan bergerak ${best.movementLabel.toLowerCase()}` : ''}`,
      'Cek ulang prakiraan cuaca & gelombang BMKG sebelum berangkat',
      'Verifikasi kondisi lapangan (suhu, warna air, keberadaan burung laut) saat tiba di zona',
    ],
    degraded: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { analysis } = (await req.json()) as { analysis?: FishingZoneAnalysis };

    if (!analysis || !Array.isArray(analysis.zones)) {
      return NextResponse.json({ error: 'analysis dengan zones diperlukan' }, { status: 400 });
    }

    const groq = getGroqClient();

    if (!groq) {
      return NextResponse.json({ aiAnalysis: buildHeuristicAnalysis(analysis), degraded: true });
    }

    // Kompakkan payload untuk token limit Groq (llama-3.1-8b-instant, 6000 TPM).
    const zonesCompact = analysis.zones.slice(0, 8).map((z, i) => ({
      index: i,
      lat: z.lat,
      lon: z.lon,
      score: z.score,
      areaKm2: z.areaKm2,
      species: z.species.slice(0, 3),
      meanSst: z.meanSst,
      meanChl: z.meanChl,
      movementDeg: z.movementDeg,
      movementLabel: z.movementLabel,
      coastKm: z.coastKm,
      nearbyVessels: z.nearbyVessels,
      vesselHeading: z.vesselHeading,
      flagged: z.flagged,
    }));

    const gfwCompact = analysis.gfw
      ? {
          totalEvents: analysis.gfw.totalEvents,
          fishingEvents: analysis.gfw.fishingEvents,
          loiteringEvents: analysis.gfw.loiteringEvents,
          isMock: analysis.gfw.isMock,
          period: analysis.gfw.period,
          hotspots: analysis.gfw.hotspots.slice(0, 5),
        }
      : null;

    const dataContext = `
KONTEKS WILAYAH:
- Tanggal citra: ${analysis.date}
- Zona aman: ${analysis.zones.length} (${analysis.rejectedZones} ditolak karena kontaminasi, ${analysis.avoidedCount} titik kontaminasi dihindari)

ZONA TANGKAP (maks 8, sudah disortir skor):
${JSON.stringify(zonesCompact)}

AKTIVITAS KAPAL GLOBAL FISHING WATCH (AIS/VMS, 7 hari terakhir):
${gfwCompact ? JSON.stringify(gfwCompact) : 'Tidak tersedia'}

Ringkasan otomatis: ${analysis.summary}

Analisis data di atas dan hasilkan JSON sesuai format yang diminta.
**Prioritaskan rekomendasi zona dengan skor tertinggi + bukti aktivitas kapal GFW (hotspot & heading) + pergerakan kawanan (movementLabel).**
Beri gfwSuggestion yang SPESIFIK: sebutkan koordinat hotspot kapal, arah heading dominan, dan implikasinya pada pemilihan zona (kapal penangkap komersial berkumpul = indikator lokasi migrasi ikan komersial).`;

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
          console.warn('[FishingAgent] Groq rate-limited, falling back to heuristic:', message.slice(0, 200));
          return null;
        }
        throw err;
      });

    if (!completion) {
      return NextResponse.json({ aiAnalysis: buildHeuristicAnalysis(analysis), degraded: true });
    }

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(rawText) as Partial<FishingAiAnalysis>;
    const zones = analysis.zones;

    // Sanitasi: pastikan recommendedZoneIndex valid & semua field ada.
    const idx =
      typeof parsed.recommendedZoneIndex === 'number' &&
      Number.isInteger(parsed.recommendedZoneIndex) &&
      parsed.recommendedZoneIndex >= 0 &&
      parsed.recommendedZoneIndex < zones.length
        ? parsed.recommendedZoneIndex
        : zones.length > 0
          ? 0
          : undefined;

    const aiAnalysis: FishingAiAnalysis = {
      recommendedZoneIndex: idx,
      recommendation:
        typeof parsed.recommendation === 'string' && parsed.recommendation.trim()
          ? parsed.recommendation.trim()
          : zones.length > 0
            ? `Zona terbaik di ${zones[idx ?? 0].lat.toFixed(4)},${zones[idx ?? 0].lon.toFixed(4)} (skor ${(zones[idx ?? 0].score * 100).toFixed(0)}/100).`
            : 'Tidak ada zona yang direkomendasikan.',
      movementAnalysis:
        typeof parsed.movementAnalysis === 'string' && parsed.movementAnalysis.trim()
          ? parsed.movementAnalysis.trim()
          : 'Arah pergerakan kawanan tidak dapat diestimasi dari data yang tersedia.',
      gfwSuggestion:
        typeof parsed.gfwSuggestion === 'string' && parsed.gfwSuggestion.trim()
          ? parsed.gfwSuggestion.trim()
          : analysis.gfw && !analysis.gfw.isMock
            ? `GFW mendeteksi ${analysis.gfw.totalEvents} event kapal penangkap — verifikasi hotspot di lapangan.`
            : 'Data GFW tidak tersedia saat ini.',
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.filter((r) => typeof r === 'string' && r.trim().length > 0).slice(0, 5)
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r) => typeof r === 'string' && r.trim().length > 0).slice(0, 6)
        : [],
    };

    return NextResponse.json({ aiAnalysis });
  } catch (err) {
    console.error('[FishingAgent] Error:', err);
    return NextResponse.json({ error: 'Gagal menganalisis zona tangkap' }, { status: 500 });
  }
}
