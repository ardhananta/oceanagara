import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type {
  FishQualityAnalysis,
  TangkapanVerificationInput,
  TangkapanVerificationVerdict,
} from '@/app/types/maritime';

/**
 * Verifikasi kesegaran hasil tangkapan — "AI Model Kedua" (verifikasi).
 *
 * Berbeda dari agent "Kura" (llama-3.1-8b-instant) yang menganalisis prediksi
 * kualitas ikan, route ini memakai model terpisah (llama-3.3-70b-versatile)
 * agar beban inferensi tidak menumpuk pada satu model. Input: pengamatan
 * fisik tangkapan pasca-melaut (mata, insang, bau, tekstur, durasi simpan,
 * cuaca, suhu air) + konteks zona prediksi (SST/klorofil/pH NASA). Output:
 * skor kesegaran 0-100, label (Segar/Mulai Berubah/Tidak Segar), daftar
 * perubahan akibat cuaca/suhu, dan saran penanganan.
 *
 * Fallback deterministik dipakai bila Groq tidak tersedia / rate-limited.
 */

const SYSTEM_PROMPT = `Kamu adalah "Naiad", AI Verifikator Kesegaran Ikan Oceanagara.
Tugasmu: menilai kesegaran ikan yang BARU SAJA DITANGKAP berdasarkan pengamatan fisik peneliti/nelayan, FOTO tangkapan (bila ada), dan konteks lingkungan zona tangkap (data satelit SST/klorofil/pH NASA).

Kamu menerima:
1. Konteks zona prediksi: suhu laut, klorofil, pH, skor kualitas, spesies target.
2. Pengamatan tangkapan: spesies, cuaca saat menangkap, suhu air saat itu, durasi penyimpanan sejak ditangkap, kondisi mata, warna insang, bau, dan tekstur daging.
3. Foto tangkapan (1–3): amati SEKSAMA — warna & kejernihan mata, warna insang (merah muda gelap = segar), kilau & lendir permukaan tubuh, rigor mortis (kaku/lemas), luka/lecet, warna daging bekas potongan.

Penilaian kesegaran (literatur perikanan & cold chain):
- Mata: jernih & menonjol = segar; keruh & cekung = sudah berubah.
- Insang: merah segar = segar; merah muda/coklat keabu-abuan = dekomposisi mulai.
- Bau: khas laut segar; amis ringan; amis menyengat = menurun cepat.
- Daging: kenyal & kembali saat ditekan = segar; lembek berair = tidak segar.
- Durasi simpan TANPA pendinginan: <2 jam aman, 2-6 jam mulai menurun, >12 jam berisiko.
- Suhu udara tinggi / cuaca panas di atas kapal mempercepat kerusakan; hujan & handling basah juga.

Output HARUS JSON valid dengan struktur:
{
  "freshnessScore": 0-100,
  "freshnessLabel": "Segar | Mulai Berubah | Tidak Segar",
  "summary": "ringkasan 1-2 kalimat kondisinya",
  "changes": ["perubahan fisik yang teramati (maks 4)"],
  "storageAdvice": ["saran penanganan/pendinginan (maks 4)"],
  "risks": ["peringatan bila ada (maks 3)"],
  "visualFindings": ["temuan dari FOTO saja: mata, insang, kilau tubuh, rigor (maks 4)"]
}

Aturan:
- Gunakan HANYA data yang diberikan. Jangan mengarang.
- visualFindings: hanya isi bila foto tersedia; bila tidak ada foto, kosongkan array.
- Jika foto dan semua indikator fisik baik, jangan menurunkan skor tanpa alasan.
- Bahasa Indonesia profesional dan spesifik.`;

const WEATHER_KEYS: Record<string, string> = {
  cerah: 'cerah/terik',
  berawan: 'berawan',
  hujan: 'hujan',
  'angin-kencang': 'angin kencang',
};

const HOLD_LABELS: Record<string, string> = {
  '<2': '< 2 jam',
  '2-6': '2–6 jam',
  '6-12': '6–12 jam',
  '12-24': '12–24 jam',
  '>24': '> 24 jam',
};

const EYES_LABELS: Record<string, string> = {
  jernih: 'jernih & menonjol',
  'agak-keruh': 'agak keruh',
  'keruh-cekung': 'keruh & cekung',
};

const GILLS_LABELS: Record<string, string> = {
  'merah-segar': 'merah segar',
  'merah-muda': 'merah muda',
  'coklat-keabu': 'coklat keabu-abuan',
};

const SMELL_LABELS: Record<string, string> = {
  'khas-laut': 'khas laut segar',
  'amis-ringan': 'amis ringan',
  'amis-menyengat': 'amis menyengat',
};

const FLESH_LABELS: Record<string, string> = {
  kenyal: 'kenyal & elastis',
  'agak-lembek': 'agak lembek',
  'lembek-berair': 'lembek & berair',
};

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function labelOf(score: number): TangkapanVerificationVerdict['freshnessLabel'] {
  return score >= 70 ? 'Segar' : score >= 45 ? 'Mulai Berubah' : 'Tidak Segar';
}

/** Konteks zona prediksi terbaik untuk narasi (bila analisis tersedia). */
function zoneContext(analysis?: FishQualityAnalysis | null): string {
  if (!analysis || analysis.scores.length === 0) return 'Tidak ada konteks zona (verifikasi mandiri).';
  const best = analysis.scores[0];
  const z = analysis.zones[best.zoneIndex];
  const ctx = [
    `zona ${best.lat.toFixed(3)},${best.lon.toFixed(3)} (skor kualitas ${best.qualityScore}/100, ${best.qualityLabel})`,
    z ? `suhu laut ${z.meanSst.toFixed(1)}°C, klorofil ${z.meanChl.toFixed(2)} mg/m³` : '',
    best.ph !== undefined ? `pH ≈ ${best.ph.toFixed(2)}` : '',
  ].filter(Boolean);
  return ctx.join(' · ');
}

/** Fallback deterministik — penilaian dari data nyata, tanpa AI. */
function buildHeuristicVerdict(
  input: TangkapanVerificationInput,
  analysis?: FishQualityAnalysis | null
): TangkapanVerificationVerdict {
  let score = 100;

  const changes: string[] = [];

  // Indikator fisik (literatur perikanan)
  if (input.eyes === 'agak-keruh') score -= 10;
  else if (input.eyes === 'keruh-cekung') {
    score -= 25;
    changes.push('Mata keruh dan cekung — tanda dekomposisi mulai');
  }
  if (input.gills === 'merah-muda') score -= 10;
  else if (input.gills === 'coklat-keabu') {
    score -= 25;
    changes.push('Insang berubah menjadi coklat keabu-abuan (mukus dekomposisi)');
  }
  if (input.smell === 'amis-ringan') score -= 10;
  else if (input.smell === 'amis-menyengat') {
    score -= 30;
    changes.push('Bau amis menyengat — metabolisme bakteri sudah lanjut');
  }
  if (input.flesh === 'agak-lembek') score -= 10;
  else if (input.flesh === 'lembek-berair') {
    score -= 25;
    changes.push('Daging lembek dan berair — jaringan mulai rusak');
  }

  // Durasi simpan tanpa pendinginan
  if (input.holdHours === '2-6') {
    score -= 8;
    changes.push('Sisa waktu kritis: simpan 2–6 jam tanpa es');
  } else if (input.holdHours === '6-12') {
    score -= 18;
    changes.push('Penyimpanan 6–12 jam tanpa pendinginan menurunkan mutu');
  } else if (input.holdHours === '12-24') {
    score -= 32;
    changes.push('Lebih dari 12 jam tanpa es — risiko kerusakan tinggi');
  } else if (input.holdHours === '>24') {
    score -= 45;
    changes.push('Disimpan >24 jam tanpa pendinginan — tidak layak segar');
  }

  // Cuaca & suhu air (percepatan pembusukan)
  const zoneZ = analysis && analysis.scores.length > 0 ? analysis.zones[analysis.scores[0].zoneIndex] : undefined;
  const zoneSst = zoneZ?.meanSst;
  if (input.waterTemp >= 32) score -= 12;
  else if (input.waterTemp >= 30) score -= 8;
  else if (input.waterTemp >= 28) score -= 4;
  if (zoneSst !== undefined && input.waterTemp > zoneSst + 3 && input.waterTemp >= 30) {
    score -= 5;
    changes.push(`${input.waterTemp.toFixed(0)}°C — lebih hangat dari zona prediksi (${zoneSst.toFixed(1)}°C), pembusukan dipercepat`);
  }
  if (input.weather === 'hujan') {
    score -= 5;
    changes.push('Cuaca hujan — handling basah mempercepat kerusakan tanpa pendinginan');
  } else if (input.weather === 'cerah') {
    score -= 6;
  } else if (input.weather === 'angin-kencang') {
    score -= 3;
  }

  const finalScore = clampScore(score);
  const label = labelOf(finalScore);

  const storageAdvice: string[] = [
    'Segera turunkan suhu ikan ke 0–4°C dengan es curai (rasio es:ikan minimal 1:1)',
    'Bersihkan insang dan isi perut sebelum penyimpanan',
    'Pisahkan hasil tangkapan dari paparan sinar matahari langsung',
  ];
  if (finalScore < 45) {
    storageAdvice.push('Waspadai kerusakan histamin (spesies scombridae) — prioritas konsumsi/olahan segera');
  }
  if (finalScore >= 70 && changes.length === 0) {
    storageAdvice.push('Kondisi memenuhi standar kesegaran — pertahankan rantai dingin hingga pasar');
  }

  const risks: string[] = [];
  const bestScore = analysis?.scores[0];
  if (bestScore?.habRisk) {
    risks.push('Zona prediksi berisiko ledakan alga (HAB) — cek rasa & aroma sampel sebelum dikonsumsi');
  }
  if (finalScore < 45) {
    risks.push('Ikan tidak layak konsumsi mentah — proses termal segera atau musnahkan');
  }
  if (input.holdHours === '>24' && input.smell === 'amis-menyengat') {
    risks.push('Indikasi amonia tinggi — hindari konsumsi');
  }

  const summary =
    finalScore >= 70
      ? `${input.species} kondisinya masih baik (skor ${finalScore}/100 — ${label}); pendinginan segera mempertahankan mutu hingga pasar.`
      : finalScore >= 45
        ? `${input.species} mulai mengalami perubahan mutu (skor ${finalScore}/100 — ${label}) akibat ${changes[0]?.toLowerCase() ?? 'penanganan'} — prioritaskan konsumsi hari yang sama.`
        : `${input.species} sudah tidak segar (skor ${finalScore}/100 — ${label}): ${changes.slice(0, 2).join('; ').toLowerCase()}.`;

  return {
    freshnessScore: finalScore,
    freshnessLabel: label,
    summary: `${summary} Konteks zona prediksi: ${zoneContext(analysis)}.`,
    changes: changes.length > 0 ? changes : ['Belum ada perubahan fisik signifikan yang teramati'],
    storageAdvice,
    risks: risks.length > 0 ? risks : ['Pantau suhu simpan dan konsumsi cepat untuk hasil terbaik'],
    degraded: true,
  };
}

function withLabelSafe(input: TangkapanVerificationInput): {
  species: string;
  weather: string;
  waterTemp: number;
  holdHours: string;
  eyes: string;
  gills: string;
  smell: string;
  flesh: string;
} {
  return {
    species: input.species,
    weather: WEATHER_KEYS[input.weather] ?? input.weather,
    waterTemp: input.waterTemp,
    holdHours: HOLD_LABELS[input.holdHours] ?? input.holdHours,
    eyes: EYES_LABELS[input.eyes] ?? input.eyes,
    gills: GILLS_LABELS[input.gills] ?? input.gills,
    smell: SMELL_LABELS[input.smell] ?? input.smell,
    flesh: FLESH_LABELS[input.flesh] ?? input.flesh,
  };
}

/** Model vision utama & cadangan (analisis foto). scout sudah deprecated — pakai maverick lalu qwen. */
const VISION_MODELS = ['meta-llama/llama-4-maverick-17b-128e-instruct', 'qwen/qwen3.6-27b'];

/** Validasi data URL foto (data:image/jpeg|png|webp;base64,). */
function isPhotoDataUrl(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/i.test(v) &&
    v.length < 4 * 1024 * 1024 // batas base64 Groq 4MB
  );
}

/** Panggil Groq dengan penanganan rate-limit → null. */
async function runCompletion(
  groq: Groq,
  body: Parameters<Groq['chat']['completions']['create']>[0]
): Promise<{ choices: { message?: { content?: string | null } }[] } | null> {
  return groq.chat.completions
    .create(body as never)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (/413|429|rate_limit|Request too large|TPM|400/i.test(message)) {
        console.warn('[VerifikasiTangkapan] Groq call failed, trying fallback:', message.slice(0, 200));
        return null;
      }
      throw err;
    }) as unknown as Promise<{ choices: { message?: { content?: string | null } }[] } | null>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      analysis?: FishQualityAnalysis | null;
      input?: TangkapanVerificationInput;
      photos?: string[];
    };

    const input = body.input;
    if (!input || typeof input.species !== 'string' || !Number.isFinite(+input.waterTemp)) {
      return NextResponse.json(
        { error: 'input verifikasi (spesies & suhu air) diperlukan' },
        { status: 400 }
      );
    }

    const analysis = body.analysis ?? null;
    const photos = (body.photos ?? []).filter(isPhotoDataUrl).slice(0, 3);
    const groq = getGroqClient();

    if (!groq) {
      const verdict = buildHeuristicVerdict(input, analysis);
      if (photos.length > 0) {
        verdict.visualFindings = ['Analisis visual foto dilewati (mode heuristik) — andalkan pengamatan fisik'];
      }
      return NextResponse.json({ verdict, degraded: true });
    }

    const readable = withLabelSafe(input);
    const zone = zoneContext(analysis);
    const dataContext = `
KONTEKS ZONA PREDIKSI:
${zone}

PENGAMATAN TANGKAPAN:
${JSON.stringify(readable, null, 1)}
${photos.length > 0 ? `\nFOTO TANGKAPAN: ${photos.length} foto terlampir — amati mata, insang, kilau & lendir tubuh, rigor, dan luka.` : ''}

Analisis data ${photos.length > 0 ? 'dan foto ' : ''}di atas lalu hasilkan JSON sesuai format yang diminta.
**Prioritaskan: skor kesegaran yang konsisten dengan durasi simpan, indikator fisik, dan temuan visual foto; jelaskan perubahan yang terjadi akibat cuaca/suhu; beri saran penyimpanan yang bisa langsung dipakai di kapal nelayan tradisional.**`;

    let completion = null;

    if (photos.length > 0) {
      // Jalur vision: coba model vision utama, lalu cadangan.
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
      for (const model of VISION_MODELS) {
        completion = await runCompletion(groq, {
          model,
          messages,
          temperature: 0.3,
          ...(model.includes('qwen') ? { max_completion_tokens: 1024 } : { max_tokens: 1024 }),
          response_format: { type: 'json_object' },
        });
        if (completion) {
          console.log(`[VerifikasiTangkapan] vision analyzed with ${model}`);
          break;
        }
      }
    } else {
      // Jalur teks: model analisis tekstual (tidak membebani model vision).
      completion = await runCompletion(groq, {
        model: 'llama-3.3-70b-versatile',
        messages: [
{ role: 'system' as const, content: SYSTEM_PROMPT },
          { role: 'user', content: dataContext },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      });
    }

    if (!completion) {
      const verdict = buildHeuristicVerdict(input, analysis);
      if (photos.length > 0) {
        verdict.visualFindings = ['Analisis visual foto gagal (model vision tidak terjangkau) — andalkan pengamatan fisik'];
      }
      return NextResponse.json({ verdict, degraded: true });
    }

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    let parsed: Partial<TangkapanVerificationVerdict> = {};
    try {
      parsed = JSON.parse(rawText) as Partial<TangkapanVerificationVerdict>;
    } catch {
      // JSON tidak valid → heuristik
    }

    const asStr = (v: unknown, fallback: string) =>
      typeof v === 'string' && v.trim() ? v.trim() : fallback;
    const asStrArr = (v: unknown, max: number): string[] =>
      Array.isArray(v)
        ? v.filter((x) => typeof x === 'string' && x.trim().length > 0).slice(0, max)
        : [];

    const parsedScore = Number(parsed.freshnessScore);
    const score = Number.isFinite(parsedScore) ? clampScore(parsedScore) : 50;
    const labelInput =
      typeof parsed.freshnessLabel === 'string' && parsed.freshnessLabel.trim()
        ? parsed.freshnessLabel.trim()
        : labelOf(score);

    const heuristic = buildHeuristicVerdict(input, analysis);
    const verdict: TangkapanVerificationVerdict = {
      freshnessScore: score,
      freshnessLabel: labelInput,
      summary: parsed.summary ? asStr(parsed.summary, heuristic.summary) : heuristic.summary,
      changes: parsed.changes?.length ? asStrArr(parsed.changes, 4) : heuristic.changes,
      storageAdvice: parsed.storageAdvice?.length ? asStrArr(parsed.storageAdvice, 4) : heuristic.storageAdvice,
      risks: parsed.risks?.length ? asStrArr(parsed.risks, 3) : heuristic.risks,
      visualFindings: photos.length > 0 ? asStrArr(parsed.visualFindings, 4) : undefined,
      photosAnalyzed: photos.length > 0,
    };

    return NextResponse.json({ verdict });
  } catch (err) {
    console.error('[VerifikasiTangkapan] Error:', err);
    return NextResponse.json({ error: 'Gagal memverifikasi kesegaran tangkapan' }, { status: 500 });
  }
}