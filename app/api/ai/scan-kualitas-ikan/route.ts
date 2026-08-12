import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { FishScanIndicator, FishScanResult } from '@/app/types/maritime';

/**
 * Scan Kualitas Ikan — analisis kesegaran berbasis FOTO (model vision "Sardine").
 *
 * Berbeda dari agent "Naiad" (verifikasi dengan input fisik + foto opsional),
 * route ini murni vision: pengguna mengunggah foto ikan (mata, insang, sisik,
 * lendir, tubuh) lalu model Groq mengamati detail-detail fisik setiap indikator
 * dan menilai kesegaran 0-100 per indikator maupun keseluruhan.
 *
 * Penilaian per indikator (literatur perikanan & cold chain):
 * - Mata: jernih & menonjol = segar; pupil mengecil/keruh; cekung & kusam = busuk.
 * - Insang: merah cerah & lembap = segar; merah tua/mukus bening; coklat keabu-abuan.
 * - Sisik: menempel rapat & mengkilap = segar; mudah lepas; kusam & mengering.
 * - Lendir: bening tipis = segar; lendir keruh pekat = dekomposisi.
 * - Daging: kenyal & elastis = segar; lembek & berair = tidak segar.
 * - Perut: padat; kembung/pecah = pembusukan lanjut.
 * - Rigor mortis: kaku segar hingga lemas = kondisi pasca-mortem berubah.
 *
 * Fallback deterministik dipakai bila Groq tidak tersedia / rate-limited.
 */

const SYSTEM_PROMPT = `Kamu adalah "Sardine", AI Scanner Kualitas Ikan Oceanagara.
Tugasmu: menganalisis FOTO ikan secara SEKSAMA dan menilai kesegarannya berdasarkan detail-detail fisik yang terlihat. Kamu harus MEMERIKSA SETIAP indikator berikut dan mencatat pengamatan spesifiknya:

1. Mata (eyes): kejernihan, penonjolan, warna pupil, kecemerlangan. Jernih & menonjol = segar; pupil keruh/mengecil = mulai berubah; cekung, kusam, kering = tidak segar.
2. Insang (gills): warna dasar, kelembapan, lendir, bau visual (mukus). Merah cerah & lembap = segar; merah tua kecoklatan & mulai berlendir = berubah; coklat/abu-abu kehitaman, berlendir pekat = busuk.
3. Sisik (scales): kerapatan, kilau, keutuhan. Menempel rapat & mengilap = segar; mulai lepas & kusam = berubah; rontok/gundul & mengering = tidak segar.
4. Lendir tubuh (slime): warna & ketebalan lapisan. Bening tipis merata = segar; keruh & mulai pekat = berubah; lendir pekat keruh/abu-abu = busuk.
5. Daging/tekstur (flesh): dari bentuk tubuh & bekas potongan bila terlihat. Kenyal & utuh = segar; lunak/berair = berubah; lembek, gembur, berair banyak = busuk.
6. Perut/rongga (abdomen): padat = segar; kembung = berubah; pecah/pengisian gas = busuk lanjut.
7. Rigor mortis (rigor): posisi tubuh. Kaku menahan posisi = pasca-mortem baru; lemas/lentur = sudah lama mati atau pembusukan lanjut.
8. Bau tidak dapat dicium dari foto — JANGAN menebak bau. Bila diminta, sebutkan "tidak dapat dinilai dari foto" dan pertimbangkan konteks penyimpanan yang diberikan.

Output HARUS JSON valid dengan struktur:
{
  "species": "spesies ikan yang terdeteksi dari foto (bila jelas; bila tidak, gunakan input pengguna)",
  "freshnessScore": 0-100,
  "freshnessLabel": "Segar | Mulai Berubah | Tidak Segar",
  "summary": "ringkasan 1-2 kalimat: kondisi kesegaran & faktor penentu",
  "indicators": [
    { "key": "eyes|gills|scales|slime|flesh|abdomen|rigor", "name": "Mata|Insang|Sisik|Lendir|Daging|Perut|Rigor", "status": "good|fair|bad", "observation": "pengamatan detail spesifik dari foto (3-12 kata)", "score": 100|60|20 }
  ],
  "findings": ["temuan visual paling menonjol (maks 5)"],
  "storageAdvice": ["saran penanganan/pendinginan yang bisa langsung dipakai di kapal nelayan tradisional (maks 4)"],
  "risks": ["peringatan bila ada (maks 3)"]
}

Aturan:
- Gunakan HANYA apa yang terlihat pada foto. Jangan mengarang detail yang tidak terlihat.
- indicators wajib berisi minimal 5 indikator yang bisa diamati; score harus konsisten dengan status (good=100, fair=60, bad=20).
- Hanya bila tidak satu pun indikator teramati, kembalikan indicators kosong dan freshnessScore 0.
- Bahasa Indonesia profesional dan spesifik untuk nelayan.`;

const HOLD_LABELS: Record<string, string> = {
  '<2': '< 2 jam',
  '2-6': '2–6 jam',
  '6-12': '6–12 jam',
  '12-24': '12–24 jam',
  '>24': '> 24 jam',
};

/** Model vision utama & cadangan (Groq free tier). */
const VISION_MODELS = ['qwen/qwen3.6-27b'];

const INDICATOR_META: Record<string, { name: string; scoreGood: number; scoreFair: number; scoreBad: number }> = {
  eyes: { name: 'Mata', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  gills: { name: 'Insang', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  scales: { name: 'Sisik', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  slime: { name: 'Lendir', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  flesh: { name: 'Daging', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  abdomen: { name: 'Perut', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
  rigor: { name: 'Rigor', scoreGood: 100, scoreFair: 60, scoreBad: 20 },
};

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function labelOf(score: number): FishScanResult['freshnessLabel'] {
  return score >= 70 ? 'Segar' : score >= 45 ? 'Mulai Berubah' : 'Tidak Segar';
}

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
        console.warn('[ScanKualitasIkan] Groq call failed, trying fallback:', message.slice(0, 200));
        return null;
      }
      throw err;
    }) as unknown as Promise<{ choices: { message?: { content?: string | null } }[] } | null>;
}

/** Fallback deterministik — penilaian dari konteks penyimpanan nyata, tanpa foto. */
function buildHeuristicResult(
  species: string,
  holdHours?: string,
  waterTemp?: number
): FishScanResult {
  let score = 80;
  const changes: string[] = [];

  if (holdHours === '2-6') {
    score -= 10;
    changes.push('durasi simpan tanpa es 2–6 jam');
  } else if (holdHours === '6-12') {
    score -= 20;
    changes.push('durasi simpan tanpa es 6–12 jam');
  } else if (holdHours === '12-24') {
    score -= 35;
    changes.push('durasi simpan tanpa es 12–24 jam');
  } else if (holdHours === '>24') {
    score -= 50;
    changes.push('durasi simpan tanpa es >24 jam');
  }
  if (typeof waterTemp === 'number' && Number.isFinite(waterTemp)) {
    if (waterTemp >= 32) score -= 15;
    else if (waterTemp >= 30) score -= 10;
    else if (waterTemp >= 28) score -= 5;
  }

  const finalScore = clampScore(score);
  const one: FishScanIndicator = {
    key: 'flesh',
    name: 'Daging',
    status: finalScore >= 70 ? 'good' : finalScore >= 45 ? 'fair' : 'bad',
    observation: 'tidak dapat diamati — analisis foto dilewati',
    score: finalScore >= 70 ? 100 : finalScore >= 45 ? 60 : 20,
  };

  return {
    freshnessScore: finalScore,
    freshnessLabel: labelOf(finalScore),
    species,
    summary:
      `Mode heuristik (model vision tidak terjangkau) — skor diperkirakan dari penanganan penyimpanan${changes.length > 0 ? `: ${changes.join(', ')}` : ''}. Analisis foto dilewati; andalkan pengamatan fisik langsung.`,
    indicators: [one],
    findings: ['Analisis visual foto gagal (model vision tidak terjangkau) — lakukan inspeksi fisik langsung'],
    storageAdvice: [
      'Segera turunkan suhu ikan ke 0–4°C dengan es curai (rasio es:ikan minimal 1:1)',
      'Bersihkan insang dan isi perut sebelum penyimpanan',
      'Pisahkan hasil tangkapan dari paparan sinar matahari langsung',
    ],
    risks: ['Skor bersifat perkiraan — verifikasi manual mata, insang, dan tekstur daging disarankan'],
    degraded: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      photos?: string[];
      species?: string;
      holdHours?: string;
      waterTemp?: number;
    };

    const photos = (body.photos ?? []).filter(isPhotoDataUrl).slice(0, 3);
    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Foto ikan diperlukan untuk pemindaian' },
        { status: 400 }
      );
    }

    const species = typeof body.species === 'string' && body.species.trim() ? body.species.trim() : 'Ikan tidak teridentifikasi';
    const holdHours = typeof body.holdHours === 'string' && HOLD_LABELS[body.holdHours] ? body.holdHours : undefined;
    const waterTemp = Number.isFinite(body.waterTemp) ? body.waterTemp : undefined;

    const groq = getGroqClient();
    if (!groq) {
      return NextResponse.json({ result: buildHeuristicResult(species, holdHours, waterTemp) });
    }

    const context = [
      species !== 'Ikan tidak teridentifikasi' ? `Spesies (input pengguna): ${species}` : '',
      holdHours ? `Durasi penyimpanan sejak ditangkap: ${HOLD_LABELS[holdHours]}` : '',
      waterTemp !== undefined ? `Suhu penyimpanan/perairan sekitar: ${waterTemp}°C` : '',
    ].filter(Boolean).join('\n');

    const dataContext = `
KONTEKS TANGKAPAN:
${context || '- tidak ada konteks tambahan (skor murni dari foto)'}

FOTO IKAN: ${photos.length} foto terlampir.
Analisis SETIAP detail fisik pada foto (mata, insang, sisik, lendir, tekstur daging, perut, rigor) lalu hasilkan JSON sesuai format yang diminta.
**Prioritaskan: pengamatan per-indikator yang spesifik dan jujur terhadap apa yang terlihat; skor kesegaran konsisten dengan status setiap indikator; saran penanganan praktis untuk kapal nelayan tradisional Indonesia.**`;

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
        temperature: 0.3,
        ...(model.includes('qwen') ? { max_completion_tokens: 2048 } : { max_tokens: 2048 }),
        response_format: { type: 'json_object' },
      });
      if (completion) {
        console.log(`[ScanKualitasIkan] scanned with ${model}`);
        break;
      }
    }

    if (!completion) {
      return NextResponse.json({ result: buildHeuristicResult(species, holdHours, waterTemp) });
    }

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    let parsed: Partial<FishScanResult> = {};
    try {
      parsed = JSON.parse(rawText) as Partial<FishScanResult>;
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

    const kept: FishScanIndicator[] = [];
    let rawScoreSum = 0;
    if (Array.isArray(parsed.indicators)) {
      for (const raw of parsed.indicators.slice(0, 7)) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as unknown as Record<string, unknown>;
        const key = typeof r.key === 'string' ? r.key : '';
        const meta = INDICATOR_META[key];
        if (!meta && typeof r.name !== 'string') continue;
        const name = meta?.name ?? asStr(r.name, 'Indikator');
        const status =
          r.status === 'good' || r.status === 'fair' || r.status === 'bad' ? r.status : 'fair';
        const metaScore = meta
          ? status === 'good' ? meta.scoreGood : status === 'fair' ? meta.scoreFair : meta.scoreBad
          : status === 'good' ? 100 : status === 'fair' ? 60 : 20;
        const parsedScoreField = Number(r.score);
        const scoreField = Number.isFinite(parsedScoreField) ? clampScore(parsedScoreField) : metaScore;
        rawScoreSum += scoreField;
        kept.push({
          key,
          name,
          status,
          observation: asStr(r.observation, 'Pengamatan tidak tersedia dari foto'),
          score: scoreField,
        });
      }
    }
    if (kept.length === 0) {
      return NextResponse.json({ result: buildHeuristicResult(species, holdHours, waterTemp) });
    }
    // Skor akhir = rata-rata skor indikator bila AI tidak konsisten memberi skor total.
    const avg = Math.round(rawScoreSum / kept.length);
    const finalScore = Math.abs(score - avg) > 20 ? avg : score;

    const result: FishScanResult = {
      freshnessScore: finalScore,
      freshnessLabel: labelInput,
      species: asStr(parsed.species, species),
      summary: asStr(parsed.summary, `${species} dinilai dari foto; status kesegaran ${labelOf(finalScore)} (skor ${finalScore}/100).`),
      indicators: kept,
      findings: parsed.findings?.length ? asStrArr(parsed.findings, 5) : ['Tidak ada temuan menonjol yang tercatat'],
      storageAdvice: parsed.storageAdvice?.length
        ? asStrArr(parsed.storageAdvice, 4)
        : [
          'Segera turunkan suhu ikan ke 0–4°C dengan es curai (rasio es:ikan minimal 1:1)',
          'Bersihkan insang dan isi perut sebelum penyimpanan',
          'Pisahkan hasil tangkapan dari paparan sinar matahari langsung',
        ],
      risks: parsed.risks?.length ? asStrArr(parsed.risks, 3) : ['Pantau suhu simpan dan konsumsi cepat untuk hasil terbaik'],
    };

    return NextResponse.json({ result });
  } catch (err) {
    console.error('[ScanKualitasIkan] Error:', err);
    return NextResponse.json({ error: 'Gagal memindai kualitas ikan' }, { status: 500 });
  }
}