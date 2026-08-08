import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { Agent2Request, Agent2Response, RiskAnalysisResult, RiskPoint } from '@/app/types/maritime';

const SYSTEM_PROMPT = `Kamu adalah AI Analis Risiko Pencemaran Laut Oceanagara bernama "Triton".
Tugasmu adalah menganalisis data maritim mentah dan menghasilkan laporan risiko pencemaran yang akurat.

Berdasarkan data yang diberikan (cuaca BMKG, aktivitas kapal GFW, sumber industri terdekat), kamu harus:
1. Mengidentifikasi titik-titik koordinat dengan risiko pencemaran tinggi
2. Menentukan skor risiko (0-100) dan level risiko untuk setiap titik
3. Memberikan deskripsi spesifik penyebab risiko di setiap titik
4. **Sebutkan SUMBER pencemarannya secara spesifik** — apakah dari pabrik/kilang/PLTU/smelter di dekatnya, pelabuhan, atau kapal yang melintas/berhenti (lihat daftar sumber yang diberikan). Contoh: "Terdeteksi kapal fishing + loitering 8 km dari Kilang Cilacap."
5. Memberikan rekomendasi tindakan

Output HARUS berupa JSON valid dengan struktur:
{
  "locationName": "nama lokasi",
  "analysisTimestamp": "ISO timestamp",
  "riskPoints": [
    {
      "lat": [angka],
      "lon": [angka],
      "riskScore": [0-100],
      "riskLevel": "low|medium|high|critical",
      "riskType": "jenis pencemaran",
      "description": "penjelasan spesifik",
      "spillRadiusKm": [perkiraan radius sebaran limbah dalam km, misal 8.5],
      "wasteForm": "bentuk/fase limbah, misal 'cairan minyak', 'partikel padat terapung', 'limbah cair industri', 'sampah plastik padat', 'sedimen terlarut'",
      "source": "bmkg|gfw|combined"
    }
  ],
  "overallRiskLevel": "low|medium|high|critical",
  "summary": "ringkasan analisis",
  "recommendations": ["rekomendasi 1", "rekomendasi 2"],
  "dataSources": ["BMKG Maritim", "Global Fishing Watch (GFW)"]
}

Pastikan titik koordinat berada dalam bounding box yang diberikan.
Gunakan data nyata dari API untuk menentukan titik risiko.
Jika data API terbatas, buat analisis berdasarkan pengetahuan geografis dan pola pencemaran umum di area tersebut.`;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY2 ?? process.env.GROQ_API_KEY1;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function generateMockRiskPoints(
  lat: number,
  lon: number,
  bbox: { north: number; south: number; east: number; west: number },
  regionName: string
): RiskAnalysisResult {
  const latRange = bbox.north - bbox.south;
  const lonRange = bbox.east - bbox.west;

  const points: RiskPoint[] = [
    {
      lat: lat + latRange * 0.15,
      lon: lon + lonRange * 0.10,
      riskScore: 87,
      riskLevel: 'critical',
      riskType: 'tumpahan minyak & limbah kapal',
      description: `Terdeteksi aktivitas penangkapan ikan ilegal intensif di koordinat ini. Pola pergerakan kapal menunjukkan pembuangan limbah bahan bakar secara tidak langsung. Kecepatan arus ${(Math.random() * 1.5 + 0.5).toFixed(1)} m/s berpotensi menyebarkan pencemaran ke pesisir dalam 12–18 jam.`,
      spillRadiusKm: 18.5,
      wasteForm: 'cairan minyak (hydrocarbon film)',
      source: 'combined',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat - latRange * 0.08,
      lon: lon - lonRange * 0.12,
      riskScore: 73,
      riskLevel: 'high',
      riskType: 'limbah industri',
      description: `Analisis data arus BMKG menunjukkan aliran massa air dari arah kawasan industri pesisir. Kandungan sedimen abnormal dan suhu air yang lebih tinggi dari normal (+${(Math.random() * 2 + 1).toFixed(1)}°C) mengindikasikan pembuangan limbah termal dari industri.`,
      spillRadiusKm: 9.5,
      wasteForm: 'limbah cair industri (termal & kimia)',
      source: 'bmkg',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat + latRange * 0.02,
      lon: lon + lonRange * 0.22,
      riskScore: 61,
      riskLevel: 'high',
      riskType: 'sampah plastik & limbah kapal',
      description: `Zona ini merupakan jalur pelayaran padat dengan ${Math.floor(Math.random() * 20 + 15)} aktivitas kapal terdeteksi oleh GFW dalam 24 jam. Pola kapal berhenti mendadak (loitering) mengindikasikan potensi pembuangan limbah padat ke laut.`,
      spillRadiusKm: 12.0,
      wasteForm: 'sampah plastik padat terapung',
      source: 'gfw',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat - latRange * 0.19,
      lon: lon + lonRange * 0.05,
      riskScore: 44,
      riskLevel: 'medium',
      riskType: 'runoff dan sedimentasi',
      description: `Curah hujan tinggi dalam 72 jam terakhir berdasarkan data BMKG berpotensi meningkatkan runoff dari daratan. Titik ini dekat muara sungai, meningkatkan risiko aliran limbah pertanian dan domestik ke perairan terbuka.`,
      spillRadiusKm: 6.5,
      wasteForm: 'sedimen terlarut & partikel tersuspensi',
      source: 'bmkg',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat + latRange * 0.25,
      lon: lon - lonRange * 0.18,
      riskScore: 28,
      riskLevel: 'low',
      riskType: 'pencemaran ringan',
      description: `Aktivitas kapal rendah di zona ini. Terdapat beberapa kapal penangkap ikan skala kecil yang melintas. Kondisi cuaca cukup baik dengan gelombang ${(Math.random() * 0.5 + 0.3).toFixed(1)}m, risiko penyebaran pencemaran minimal.`,
      spillRadiusKm: 3.0,
      wasteForm: 'cairan sisa oli ringan',
      source: 'combined',
      timestamp: new Date().toISOString(),
    },
  ];

  return {
    locationName: regionName,
    analysisTimestamp: new Date().toISOString(),
    riskPoints: points,
    overallRiskLevel: 'high',
    summary: `Analisis data maritim di ${regionName} menunjukkan tingkat risiko pencemaran TINGGI. Teridentifikasi ${points.length} titik risiko dengan 1 titik kritis (skor 87/100) akibat aktivitas kapal intensif dan indikasi tumpahan minyak. Data BMKG mengkonfirmasi kondisi arus yang berpotensi mempercepat penyebaran pencemaran ke arah pesisir.`,
    recommendations: [
      'Segera lakukan pemantauan lapangan di titik kritis (koordinat prioritas 1)',
      'Koordinasi dengan Bakamla dan KLHK untuk investigasi kapal-kapal yang teridentifikasi',
      'Pasang bouys pemantauan kualitas air di 3 titik risiko tinggi',
      'Monitoring intensif dalam 24–48 jam ke depan mengingat kondisi arus aktif',
      'Siapkan tim respons pencemaran di pelabuhan terdekat sebagai antisipasi',
    ],
    dataSources: ['BMKG Maritim', 'Global Fishing Watch (GFW)'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { location, maritimeData, sourceContext }: Agent2Request = await req.json();

    if (!location || !maritimeData) {
      return NextResponse.json({ error: 'location dan maritimeData diperlukan' }, { status: 400 });
    }

    const groq = getGroqClient();

    // ── No API key: use mock ──────────────────────────────────────────────
    if (!groq) {
      const mockResult = generateMockRiskPoints(
        location.lat,
        location.lon,
        location.boundingBox,
        location.regionName
      );
      const response: Agent2Response = { result: mockResult };
      return NextResponse.json(response);
    }

    // ── Real Groq call ────────────────────────────────────────────────────
    // Keep the payload lean: llama-3.1-8b-instant on the free tier is limited
    // to 6000 TPM — compact JSON + trimmed samples prevent 413 rate limits.
    const bmkgForecasts = maritimeData.bmkg?.forecasts?.slice(0, 3) ?? [];
    const gfwEvents = (maritimeData.gfw?.vesselEvents ?? []).slice(0, 10).map((e) => ({
      type: e.type,
      lat: e.lat,
      lon: e.lon,
      startTime: e.startTime,
      endTime: e.endTime,
      vesselName: e.vesselName,
      vesselType: e.vesselType,
      flag: e.flag,
      heading: e.heading,
      speedKnots: e.speedKnots,
    }));

    // Compact satellite summary (anomalies only) to respect Groq token limits
    const satellite = maritimeData.satellite?.layers?.length
      ? {
          layers: maritimeData.satellite.layers.map((l) => ({
            label: l.label,
            imageryDate: l.imageryDate,
            coveragePct: l.coveragePct,
            ph: l.ph,
            medianChl: l.medianChl,
            medianSst: l.medianSst,
            anomalies: l.anomalies
              .filter((a) => a.kind !== 'cloud')
              .map((a) => ({
                kind: a.kind,
                label: a.label,
                areaKm2: a.areaKm2,
                centerLat: +a.centerLat.toFixed(3),
                centerLon: +a.centerLon.toFixed(3),
                ph: a.ph,
                chl: a.chl,
                sst: a.sst,
              })),
          })),
        }
      : null;

    // Compact Sentinel-2 solid waste candidates (confidence ≥ 0.7 only)
    const solidWaste = maritimeData.solidWaste?.candidates?.length
      ? {
          source: 'Sentinel-2 (FDI, Biermann et al. 2020)',
          dates: maritimeData.solidWaste.dates,
          candidates: maritimeData.solidWaste.candidates.map((c) => ({
            lat: c.lat,
            lon: c.lon,
            areaM2: c.areaM2,
            confidence: c.confidence,
            observedDates: c.observedDates,
          })),
        }
      : null;

    const dataContext = `
LOKASI ANALISIS:
- Nama: ${location.regionName}
- Koordinat pusat: ${location.lat}, ${location.lon}
- Bounding box: N${location.boundingBox.north} S${location.boundingBox.south} E${location.boundingBox.east} W${location.boundingBox.west}
- Periode: ${location.startDate} s/d ${location.endDate}
- Jenis pencemaran yang dicari: ${location.pollutionTypes.join(', ')}

DATA BMKG MARITIM (cuaca & arus terdekat):
${bmkgForecasts.length ? JSON.stringify(bmkgForecasts) : 'Tidak tersedia — gunakan pengetahuan geografis'}

DATA GLOBAL FISHING WATCH (maks 10 event):
${gfwEvents.length ? JSON.stringify(gfwEvents) : 'Tidak tersedia — asumsikan aktivitas kapal normal'}

DATA CITRA SATELIT NASA GIBS (analisis piksel berbasis palet warna):
${satellite ? JSON.stringify(satellite) : 'Tidak tersedia — gunakan pengetahuan geografis'}

DATA SENTINEL-2 SAMPAH PADAT TERAPUNG (indeks FDI, kepercayaan ≥ 70%):
${solidWaste ? JSON.stringify(solidWaste) : 'Tidak tersedia'}

SUMBER PENCEMARAN POTENSIAL DI WILAYAH (pabrik/kilang/PLTU/smelter/pelabuhan/kapal):
${sourceContext ?? 'Tidak tersedia — gunakan pengetahuan geografis'}

Error saat fetch: ${maritimeData.errors.length > 0 ? maritimeData.errors.join(', ') : 'tidak ada'}

Analisis data di atas dan hasilkan laporan risiko pencemaran dalam format JSON yang diminta.
**PRIORITASKAN data citra satelit**: setiap anomali satelit (bloom/slick/thermal/turbidity) memiliki koordinat centroid (centerLat/centerLon) yang sudah terverifikasi dari citra — jadikan koordinat tersebut sebagai titik risiko (atau titik risiko yang sangat dekat), jangan asal pilih koordinat lain. Kandidat sampah padat Sentinel-2 (candidates dengan lat/lon dan confidence) juga wajib dijadikan titik risiko "Sampah padat terapung" — ini deteksi paling akurat yang tersedia. Sertakan nilai estimasi (klorofil mg/m³, suhu °C, pH, kepercayaan %) dan luas area pada description. Gunakan data satelit sebagai bukti utama; BMKG/GFW sebagai pendukung.
Pastikan semua koordinat titik risiko berada dalam bounding box yang diberikan.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: dataContext },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      // TPM/rate-limit (413/429): degrade to the deterministic mock instead of failing
      if (/413|429|rate_limit|Request too large|TPM/i.test(message)) {
        console.warn('[Agent2] Groq rate-limited, falling back to mock:', message.slice(0, 200));
        return null;
      }
      throw err;
    });

    if (!completion) {
      const mockResult = generateMockRiskPoints(
        location.lat,
        location.lon,
        location.boundingBox,
        location.regionName
      );
      return NextResponse.json({ result: mockResult, degraded: true } satisfies Agent2Response & { degraded?: boolean });
    }

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(rawText) as RiskAnalysisResult;

    const response: Agent2Response = { result };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[Agent2] Error:', err);
    return NextResponse.json({ error: 'Gagal menganalisis data risiko' }, { status: 500 });
  }
}
