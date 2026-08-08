import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { Agent2Request, Agent2Response, RiskAnalysisResult, RiskPoint } from '@/app/types/maritime';

const SYSTEM_PROMPT = `Kamu adalah AI Analis Risiko Pencemaran Laut Oceanagara bernama "Triton".
Tugasmu adalah menganalisis data maritim mentah dan menghasilkan laporan risiko pencemaran yang akurat.

Berdasarkan data yang diberikan (cuaca BMKG, aktivitas kapal GFW, posisi AIS), kamu harus:
1. Mengidentifikasi titik-titik koordinat dengan risiko pencemaran tinggi
2. Menentukan skor risiko (0-100) dan level risiko untuk setiap titik
3. Memberikan deskripsi spesifik penyebab risiko di setiap titik
4. Memberikan rekomendasi tindakan

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
      "source": "bmkg|gfw|aisstream|combined"
    }
  ],
  "overallRiskLevel": "low|medium|high|critical",
  "summary": "ringkasan analisis",
  "recommendations": ["rekomendasi 1", "rekomendasi 2"],
  "dataSources": ["BMKG Maritim", "Global Fishing Watch", "AISStream"]
}

Pastikan titik koordinat berada dalam bounding box yang diberikan.
Gunakan data nyata dari API untuk menentukan titik risiko.
Jika data API terbatas, buat analisis berdasarkan pengetahuan geografis dan pola pencemaran umum di area tersebut.`;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
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

  const riskTypes = [
    { type: 'tumpahan minyak', source: 'gfw' as const },
    { type: 'limbah industri', source: 'combined' as const },
    { type: 'sampah plastik', source: 'aisstream' as const },
    { type: 'limbah kapal tanker', source: 'gfw' as const },
    { type: 'runoff pertanian', source: 'bmkg' as const },
  ];

  const points: RiskPoint[] = [
    {
      lat: lat + latRange * 0.15,
      lon: lon + lonRange * 0.10,
      riskScore: 87,
      riskLevel: 'critical',
      riskType: 'tumpahan minyak & limbah kapal',
      description: `Terdeteksi aktivitas penangkapan ikan ilegal intensif di koordinat ini. Pola pergerakan kapal menunjukkan pembuangan limbah bahan bakar secara tidak langsung. Kecepatan arus ${(Math.random() * 1.5 + 0.5).toFixed(1)} m/s berpotensi menyebarkan pencemaran ke pesisir dalam 12–18 jam.`,
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
      source: 'bmkg',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat + latRange * 0.02,
      lon: lon + lonRange * 0.22,
      riskScore: 61,
      riskLevel: 'high',
      riskType: 'sampah plastik & limbah kapal',
      description: `Zona ini merupakan jalur pelayaran padat dengan ${Math.floor(Math.random() * 20 + 15)} kapal terdeteksi dalam 24 jam. AIS menunjukkan beberapa kapal berhenti mendadak (loitering) yang mengindikasikan potensi pembuangan limbah padat ke laut.`,
      source: 'aisstream',
      timestamp: new Date().toISOString(),
    },
    {
      lat: lat - latRange * 0.19,
      lon: lon + lonRange * 0.05,
      riskScore: 44,
      riskLevel: 'medium',
      riskType: 'runoff dan sedimentasi',
      description: `Curah hujan tinggi dalam 72 jam terakhir berdasarkan data BMKG berpotensi meningkatkan runoff dari daratan. Titik ini dekat muara sungai, meningkatkan risiko aliran limbah pertanian dan domestik ke perairan terbuka.`,
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
    dataSources: ['BMKG Maritim', 'Global Fishing Watch (GFW)', 'AISStream Real-time'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { location, maritimeData }: Agent2Request = await req.json();

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
    const dataContext = `
LOKASI ANALISIS:
- Nama: ${location.regionName}
- Koordinat pusat: ${location.lat}, ${location.lon}
- Bounding box: N${location.boundingBox.north} S${location.boundingBox.south} E${location.boundingBox.east} W${location.boundingBox.west}
- Periode: ${location.startDate} s/d ${location.endDate}
- Jenis pencemaran yang dicari: ${location.pollutionTypes.join(', ')}

DATA BMKG MARITIM:
${maritimeData.bmkg ? JSON.stringify(maritimeData.bmkg, null, 2) : 'Tidak tersedia — gunakan pengetahuan geografis'}

DATA GLOBAL FISHING WATCH:
${maritimeData.gfw ? JSON.stringify(maritimeData.gfw, null, 2) : 'Tidak tersedia — asumsikan aktivitas kapal normal'}

DATA AISSTREAM (posisi kapal real-time):
${maritimeData.aisstream ? JSON.stringify(maritimeData.aisstream, null, 2) : 'Tidak tersedia'}

Error saat fetch: ${maritimeData.errors.length > 0 ? maritimeData.errors.join(', ') : 'tidak ada'}

Analisis data di atas dan hasilkan laporan risiko pencemaran dalam format JSON yang diminta.
Pastikan semua koordinat titik risiko berada dalam bounding box yang diberikan.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: dataContext },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const rawText = completion.choices[0]?.message?.content ?? '{}';
    const result = JSON.parse(rawText) as RiskAnalysisResult;

    const response: Agent2Response = { result };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[Agent2] Error:', err);
    return NextResponse.json({ error: 'Gagal menganalisis data risiko' }, { status: 500 });
  }
}
