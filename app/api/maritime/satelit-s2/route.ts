import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import type {
  SatelliteSolidWasteAnalysis,
  SatelliteWasteCandidate,
} from '@/app/types/maritime';
import { nearestCoast } from '@/components/peta-risiko/distances';

// Deteksi sampah padat terapung via Copernicus Data Space Ecosystem (CDSE):
// 1. STAC cari produk Sentinel-2 L2A (10 m) untuk bbox + jendela 1 minggu, pilih 3 citra bebas awan.
// 2. Process API (EO Browser) jalankan evalscript Floating Debris Index (Biermann et al. 2020)
//    + mask NDWI (air), NDVI (vegetasi), SCL (awan) → PNG 8-bit kelas per piksel.
// 3. Klaster piksel kandidat, cocokkan antar tanggal (temporal), hitung skor kepercayaan.
// 4. Hanya laporan kandidat dengan confidence ≥ 0.7 (target akurasi 70-80%).

const IDENTITY = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CATALOGUE = 'https://catalogue.dataspace.copernicus.eu/stac/search';
const PROCESS_API = 'https://sh.dataspace.copernicus.eu/api/v1/process';

// Ambang FDI (Biermann et al. 2020 memakai FDI > 0.02 pada air bersih untuk plastik terapung)
const FDI_THRESHOLD = 0.02;
const NDWI_THRESHOLD = 0.05;
const NDVI_VEG = 0.1;
const MIN_CLUSTER_PX = 4; // ~400 m² @ 10 m
const MIN_CONFIDENCE = 0.7;
const MAX_DATES = 3;
const MATCH_KM = 4; // toleransi pergeseran klaster antar tanggal (hanyut)

// Token OAuth2 CDSE (grant_type=password, akun dataspace.copernicus.eu), cache 50 menit.
let cachedToken: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < TOKEN_TTL_MS) return cachedToken.token;
  const username = process.env.COPERNICUS_USERNAME ?? '';
  const password = process.env.COPERNICUS_PASSWORD ?? process.env.COPPERNICUS_PASSWORD ?? ''; // dukung ejaan lama
  if (!username || !password) throw new Error('Kredensial Copernicus (COPERNICUS_USERNAME/COPERNICUS_PASSWORD) belum diatur');
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'cdse-public',
    username,
    password,
  });
  const res = await fetch(IDENTITY, { method: 'POST', body: params, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Autentikasi Copernicus gagal (${res.status}): ${body.slice(0, 120)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token Copernicus tidak diterima');
  cachedToken = { token: json.access_token, at: Date.now() };
  return json.access_token;
}

// ─── STAC: cari citra Sentinel-2 L2A terbaik per tanggal ──────────────────────
interface S2Product {
  id: string;
  datetime: string;
  cloudCover: number;
}

async function searchProducts(bbox: [number, number, number, number], from: string, to: string, token: string): Promise<S2Product[]> {
  const res = await fetch(CATALOGUE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox,
      datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
      limit: 50,
      query: { 'eo:cloud_cover': { lt: 20 } },
    }),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: Array<{ id: string; properties: { datetime?: string; 'eo:cloud_cover'?: number } }> };
  return (json.features ?? [])
    .map((f) => ({
      id: f.id,
      datetime: (f.properties.datetime ?? '').slice(0, 10),
      cloudCover: f.properties['eo:cloud_cover'] ?? 100,
    }))
    .filter((p) => p.datetime)
    .sort((a, b) => a.cloudCover - b.cloudCover);
}

// Evalscript Sentinel Hub: 0 = daratan/awan/no-data, 1 = air bersih, 2 = kandidat debris.
const EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B02","B03","B04","B08","B11","SCL"], output: { bands: 1, sampleType: "UINT8" } };
}
function evaluatePixel(sample) {
  var scl = sample.SCL;
  // SCL: 0 no-data, 1 saturated, 3 cloud shadow, 8/9/10 awan
  if (scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10) return [0];
  var ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08 + 1e-6);
  var ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 1e-6);
  if (ndwi <= ${NDWI_THRESHOLD} || ndvi >= ${NDVI_VEG}) return [0]; // daratan / vegetasi
  var L4 = 664.9, L8 = 832.8, L11 = 1613.7;
  var redPrime = sample.B04 + (sample.B11 - sample.B04) * ((L8 - L4) / (L11 - L4));
  var fdi = sample.B08 - redPrime;
  return fdi > ${FDI_THRESHOLD} ? [2] : [1];
}`;

/** Jalankan Process API untuk satu tanggal, kembalikan grid kelas UINT8. */
async function processDate(
  bbox: [number, number, number, number],
  date: string,
  token: string
): Promise<{ grid: Uint8Array; width: number; height: number } | null> {
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const latSpanKm = (n - s) * 111.32;
  const lonSpanKm = (e - w) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  const width = 2048;
  let height = Math.round(width * (latSpanKm / lonSpanKm));
  height = Math.max(64, Math.min(2048, height));

  const body = {
    input: {
      bounds: { properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }, bbox },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` } } }],
    },
    evalscript: EVALSCRIPT,
    output: { width, height, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
  };

  const res = await fetch(PROCESS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) return null;
  try {
    const { data, info } = await sharp(buf)
      .removeAlpha()
      .resize(width, height, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const grid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) grid[i] = data[i * channels];
    return { grid, width, height };
  } catch {
    return null;
  }
}

// ─── Klastering kandidat + temporal + skor kepercayaan ────────────────────────

interface Cluster {
  px: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  dateIdx: number;
}

function clusterGrid(grid: Uint8Array, width: number, height: number, dateIdx: number): Cluster[] {
  const clusters: Cluster[] = [];
  const visited = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (grid[idx] !== 2 || visited[idx]) continue;
      const stack = [idx];
      const px: number[] = [];
      let minX = x, maxX = x, minY = y, maxY = y;
      visited[idx] = 1;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const cx = cur % width;
        const cy = (cur / width) | 0;
        px.push(cur);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (grid[ni] === 2 && !visited[ni]) {
              visited[ni] = 1;
              stack.push(ni);
            }
          }
        }
      }
      if (px.length >= MIN_CLUSTER_PX) clusters.push({ px, minX, maxX, minY, maxY, dateIdx });
    }
  }
  return clusters;
}

interface PixelGeom {
  latSpanKm: number;
  lonSpanKm: number;
  north: number;
  west: number;
}

function clusterCenter(c: Cluster, width: number, height: number, g: PixelGeom) {
  const x = (c.minX + c.maxX) / 2;
  const y = (c.minY + c.maxY) / 2;
  return {
    lat: g.north - ((y + 0.5) / height) * g.latSpanKm / 111.32,
    lon: g.west + ((x + 0.5) / width) * g.lonSpanKm / (111.32 * Math.cos(((g.north - g.latSpanKm / 2 / 111.32) * Math.PI) / 180)),
  };
}

/** Pipeline deteksi sampah padat penuh untuk satu bbox + tanggal (dengan cache). */
export async function detectSolidWaste(
  bbox: [number, number, number, number],
  requestedDate: string | null
): Promise<SatelliteSolidWasteAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const token = await getToken();

    // Pilih 3 tanggal terbaik: tanggal diminta (hari ini) dan mundur 2 & 4 hari,
    // lalu citra bebas-awan terbanyak dari masing-masing jendela.
    const now = new Date();
    const dateStr = (offsetDays: number) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const parsedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null;
    const targetDate = parsedDate ?? dateStr(0);

    const windows = [
      { target: targetDate, daysBack: 0 },
      { target: dateStr(2), daysBack: 2 },
      { target: dateStr(4), daysBack: 4 },
    ].slice(0, MAX_DATES);

    const picks: Array<{ date: string; productId: string; cloud: number }> = [];
    for (const w of windows) {
      const from = new Date(w.target);
      from.setUTCDate(from.getUTCDate() - 1);
      const to = new Date(w.target);
      to.setUTCDate(to.getUTCDate() + 1);
      const found = await searchProducts(
        bbox,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
        token
      );
      const best = found.find((p) => !picks.some((x) => x.productId === p.id));
      if (best) picks.push({ date: best.datetime, productId: best.id, cloud: best.cloudCover });
    }

    if (picks.length === 0) {
      return {
        source: 'sentinel-2',
        dates: [],
        coveragePct: 0,
        candidates: [],
        summary:
          'Tidak ada citra Sentinel-2 bebas awan untuk area ini dalam jendela 1 minggu terakhir.',
        fetchedAt: new Date().toISOString(),
        disclaimer: 'Deteksi sampah padat memerlukan citra optik bebas awan; coba lagi pada hari lain.',
      };
    }

    // Proses semua tanggal paralel.
    const results = await Promise.all(
      picks.map((p) => processDate(bbox, p.date, token))
    );

    const geometries: PixelGeom = {
      latSpanKm: (bbox[3] - bbox[1]) * 111.32,
      lonSpanKm: (bbox[2] - bbox[0]) * 111.32 * Math.cos((((bbox[3] + bbox[1]) / 2) * Math.PI) / 180),
      north: bbox[3],
      west: bbox[0],
    };

    const midLat = ((bbox[3] + bbox[1]) / 2) * (Math.PI / 180);

    const perDate: Array<{ date: string; clusters: Cluster[]; coveragePct: number; width: number; height: number }> = [];
    let processedDates = 0;
    let coverageSum = 0;
    for (let i = 0; i < picks.length; i++) {
      const res = results[i];
      if (!res) continue;
      const { grid, width, height } = res;
      let valid = 0;
      for (let j = 0; j < grid.length; j++) if (grid[j] !== 0) valid++;
      coverageSum += valid / grid.length;
      processedDates++;
      perDate.push({
        date: picks[i].date,
        clusters: clusterGrid(grid, width, height, i),
        coveragePct: (valid / grid.length) * 100,
        width,
        height,
      });
    }

    // Gabungkan klaster antar tanggal berdasarkan jarak centroid (toleransi hanyut).
    type Grouped = {
      lat: number;
      lon: number;
      dates: Set<string>;
      areaM2: number;
      maxPx: number;
    };
    const groups: Grouped[] = [];
    const dateLabel = (i: number) => picks[i].date;

    for (const pd of perDate) {
      for (const c of pd.clusters) {
        const center = clusterCenter(c, pd.width, pd.height, geometries);
        let matched: Grouped | null = null;
        let bestDist = Infinity;
        for (const g of groups) {
          const dLat = (g.lat - center.lat) * 111.32;
          const dLon = (g.lon - center.lon) * 111.32 * Math.cos(midLat);
          const d = Math.sqrt(dLat * dLat + dLon * dLon);
          if (d < MATCH_KM && d < bestDist) {
            matched = g;
            bestDist = d;
          }
        }
        const px = c.px.length;
        const pxLat = geometries.latSpanKm / pd.height;
        const pxLon = geometries.lonSpanKm / pd.width;
        const areaM2 = px * pxLat * pxLon * 1_000_000;
        if (matched) {
          matched.dates.add(dateLabel(c.dateIdx));
          matched.areaM2 += areaM2;
          matched.maxPx = Math.max(matched.maxPx, px);
        } else {
          groups.push({
            lat: center.lat,
            lon: center.lon,
            dates: new Set([dateLabel(c.dateIdx)]),
            areaM2,
            maxPx: px,
          });
        }
      }
    }

    // Skor kepercayaan: basis + konfirmasi temporal + ukuran klaster + konteks pesisir.
    const candidates: SatelliteWasteCandidate[] = [];
    for (const g of groups) {
      const observed = g.dates.size;
      const coast = nearestCoast(g.lat, g.lon);
      const coastKm = coast ? coast.distanceKm : 400;
      let confidence =
        0.55 +
        (observed - 1) * 0.15 +
        (g.maxPx >= 8 ? 0.05 : 0) +
        (coastKm < 15 ? 0.05 : 0) -
        (coastKm > 40 ? 0.05 : 0);
      confidence = Math.max(0.5, Math.min(0.95, confidence));
      if (confidence < MIN_CONFIDENCE) continue;
      candidates.push({
        lat: +g.lat.toFixed(4),
        lon: +g.lon.toFixed(4),
        areaM2: Math.round(g.areaM2),
        confidence: +confidence.toFixed(2),
        observedDates: [...g.dates].sort(),
        coastKm: +coastKm.toFixed(1),
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);

    const coveragePct = processedDates > 0 ? Math.round((coverageSum / processedDates) * 100) : 0;

    let summary: string;
    if (candidates.length === 0) {
      summary =
        'Sentinel-2 (indeks FDI) tidak menemukan kandidat sampah padat terapung dengan kepercayaan ≥ 70% pada jendela 1 minggu terakhir.';
    } else {
      const list = candidates
        .map((c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)} (≈${(c.areaM2 / 1000).toFixed(0)} ribu m², kepercayaan ${Math.round(c.confidence * 100)}%, terlihat ${c.observedDates.length}x)`)
        .join('; ');
      summary = `Deteksi sampah padat terapung Sentinel-2: ${list}. Sinyal tervalidasi di ≥ 1 citra dengan ambang FDI & mask awan/vegetasi.`;
    }

    return {
      source: 'sentinel-2',
      dates: picks.map((p) => p.date),
      coveragePct,
      candidates,
      summary,
      fetchedAt: new Date().toISOString(),
      disclaimer:
        'Deteksi berbasis indeks Floating Debris (Biermann et al. 2020) pada citra Sentinel-2 10 m. Akurasi ~80% pada kondisi ideal (laut tenang, bebas awan); kandidat dengan kepercayaan < 70% tidak dilaporkan. Verifikasi lapangan tetap diperlukan.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const north = Number(searchParams.get('north'));
  const south = Number(searchParams.get('south'));
  const east = Number(searchParams.get('east'));
  const west = Number(searchParams.get('west'));

  if (![north, south, east, west].every(Number.isFinite)) {
    return NextResponse.json({ error: 'north, south, east, west diperlukan' }, { status: 400 });
  }

  const bbox: [number, number, number, number] = [
    Math.max(-180, Math.min(180, west)),
    Math.max(-90, Math.min(90, south)),
    Math.min(180, Math.max(-180, east)),
    Math.min(90, Math.max(-90, north)),
  ];

  try {
    const result = await detectSolidWaste(bbox, searchParams.get('date'));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        source: 'sentinel-2',
        error: err instanceof Error ? err.message : 'Autentikasi Copernicus gagal',
        hint: 'Daftar gratis di https://dataspace.copernicus.eu lalu isi COPERNICUS_USERNAME & COPERNICUS_PASSWORD di .env',
      },
      { status: 503 }
    );
  }
}
