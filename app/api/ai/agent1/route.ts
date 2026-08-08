import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { ChatMessage, Agent1Response, LocationQuery } from '@/app/types/maritime';

const SYSTEM_PROMPT = `Kamu adalah Asisten Peneliti Kelautan Oceanagara bernama "Aruna". 
Tugasmu adalah mengumpulkan informasi lokasi dari pengguna untuk analisis risiko pencemaran laut.

Kamu harus menanyakan secara natural dan ramah:
1. Lokasi perairan yang ingin dianalisis (contoh: Laut Jawa pesisir Semarang, Teluk Jakarta, Selat Makassar)
2. Rentang waktu yang diinginkan (default: 7 hari terakhir jika tidak disebutkan)
3. Jenis pencemaran yang dicari (opsional: minyak, limbah industri, plastik, dll)

Setelah mendapatkan informasi yang cukup (minimal lokasi), WAJIB sertakan blok JSON berikut di akhir responsmu:
<location_data>
{
  "ready": true,
  "regionName": "nama lokasi lengkap",
  "lat": [latitude pusat],
  "lon": [longitude pusat],
  "boundingBox": {
    "north": [lat utara],
    "south": [lat selatan],
    "east": [lon timur],
    "west": [lon barat]
  },
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "pollutionTypes": ["jenis1", "jenis2"],
  "summary": "Analisis pencemaran di [lokasi] periode [tanggal]"
}
</location_data>

Koordinat Indonesia umum:
- Laut Jawa: lat -5 to -8, lon 105 to 115
- Selat Malaka: lat 1 to 5, lon 99 to 104
- Teluk Jakarta: lat -5.8 to -6.1, lon 106.6 to 107.0
- Laut Banda: lat -3 to -7, lon 126 to 132
- Selat Makassar: lat -1 to -5, lon 116 to 120
- Laut Flores: lat -7 to -9, lon 116 to 122

Jika informasi belum cukup, jangan sertakan blok <location_data>. Tetap natural dan gunakan Bahasa Indonesia.`;

// Initialize Groq client — safe to construct even without key (will fail at API call time)
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY1 ?? process.env.GROQ_API_KEY2;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/** Parse location data block from AI response */
function parseLocationData(text: string): LocationQuery | null {
  const match = text.match(/<location_data>([\s\S]*?)<\/location_data>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as LocationQuery;
  } catch {
    return null;
  }
}

/** Strip the <location_data> block from the display message */
function cleanMessage(text: string): string {
  return text.replace(/<location_data>[\s\S]*?<\/location_data>/g, '').trim();
}

/** Mock AI response when Groq key is not available */
function getMockResponse(messages: ChatMessage[]): Agent1Response {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() ?? '';

  const hasLocation =
    lastUserMsg.includes('laut jawa') ||
    lastUserMsg.includes('semarang') ||
    lastUserMsg.includes('jakarta') ||
    lastUserMsg.includes('makassar') ||
    lastUserMsg.includes('teluk') ||
    lastUserMsg.includes('selat') ||
    lastUserMsg.includes('pesisir') ||
    lastUserMsg.includes('laut') ||
    lastUserMsg.includes('perairan');

  if (!hasLocation) {
    return {
      message: `Halo! Saya Aruna, asisten peneliti kelautan Oceanagara\n\nSaya akan membantu menganalisis risiko pencemaran laut di lokasi yang Anda inginkan.\n\n**Mohon sebutkan lokasi perairan yang ingin dianalisis**, misalnya:\n- "Laut Jawa pesisir Semarang"\n- "Teluk Jakarta"\n- "Selat Makassar"\n- "Perairan Bali"\n\nApakah ada lokasi spesifik yang ingin Anda teliti?`,
      location: null,
    };
  }

  // Derive mock coordinates based on mentioned location
  let lat = -6.9, lon = 110.4, regionName = 'Laut Jawa Pesisir Semarang';
  let bbox = { north: -5.5, south: -8.0, east: 112.0, west: 108.5 };

  if (lastUserMsg.includes('jakarta') || lastUserMsg.includes('teluk jakarta')) {
    lat = -5.97; lon = 106.83; regionName = 'Teluk Jakarta';
    bbox = { north: -5.8, south: -6.1, east: 107.0, west: 106.6 };
  } else if (lastUserMsg.includes('makassar') || lastUserMsg.includes('selat makassar')) {
    lat = -3.0; lon = 118.0; regionName = 'Selat Makassar';
    bbox = { north: -1.0, south: -5.0, east: 120.0, west: 116.0 };
  }

  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];

  const location: LocationQuery = {
    ready: true,
    regionName,
    lat,
    lon,
    boundingBox: bbox,
    startDate,
    endDate,
    pollutionTypes: ['minyak', 'limbah industri', 'sampah plastik'],
    summary: `Analisis pencemaran laut di ${regionName} periode ${startDate} s/d ${endDate}`,
  };

  return {
    message: `Baik! Saya telah mengidentifikasi lokasi **${regionName}** untuk analisis risiko pencemaran laut.\n\n📍 **Koordinat Pusat**: ${lat.toFixed(4)}, ${lon.toFixed(4)}\n📅 **Periode**: ${startDate} hingga ${endDate}\n🔍 **Jenis pencemaran**: Minyak, limbah industri, sampah plastik\n\nSemua informasi sudah siap. Klik **"Mulai Analisis"** untuk melanjutkan ke proses pengambilan data maritim dan analisis risiko oleh AI kami.`,
    location,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: ChatMessage[] } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages diperlukan' }, { status: 400 });
    }

    const groq = getGroqClient();

    // ── No API key: use mock ──────────────────────────────────────────────
    if (!groq) {
      const mockResult = getMockResponse(messages);
      return NextResponse.json(mockResult);
    }

    // ── Real Groq call ────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    const location = parseLocationData(rawText);
    const message = cleanMessage(rawText);

    const response: Agent1Response = { message, location };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[Agent1] Error:', err);
    return NextResponse.json({ error: 'Gagal memproses permintaan AI' }, { status: 500 });
  }
}
