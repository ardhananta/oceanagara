import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import type {
  SatelliteAnalysis,
  SatelliteAnomaly,
  SatelliteLayerAnalysis,
  SatellitePhEstimate,
} from '@/app/types/maritime';
import { isLandPoint } from '@/components/peta-risiko/distances';
import { CHL_VALUE_LUT, SST_VALUE_LUT } from '../lib/gibsPalettes';

// NASA GIBS (Global Imagery Browse Services) — citra satelit gratis tanpa API key.
// WMS 1.3.0 + EPSG:4326 mengharuskan urutan axis BBOX = lat,lon (south,west,north,east).
const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const GIBS_WMS_3857 = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

const GRID = 256; // ukuran tile analisis (piksel)

const LAYERS: Array<{ layer: string; label: string; fallback?: string }> = [
  { layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'True Color (MODIS Terra)' },
  { layer: 'OCI_PACE_Chlorophyll_a', label: 'Klorofil-a (NASA PACE)', fallback: 'MODIS_Terra_L2_Chlorophyll_A' },
  { layer: 'GHRSST_L4_MUR25_Sea_Surface_Temperature', label: 'Suhu Permukaan Laut (MUR L4)' },
];

// Simulasi run sering berdekatan; cache hasil per tanggal+bbox+layer (5 menit).
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (cache.size > 60) cache.clear();
  cache.set(key, { at: Date.now(), value });
}

export interface Bbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function parseDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dateDaysAgo(0);
}

/** Ambil tile PNG GIBS untuk satu layer & tanggal, decode ke RGBA raw. */
export async function fetchTile(
  layer: string,
  bbox: Bbox,
  date: string,
  signal?: AbortSignal
): Promise<{ data: Buffer; width: number; height: number } | null> {
  const url =
    `${GIBS_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}` +
    `&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=${GRID}&HEIGHT=${GRID}` +
    `&CRS=EPSG:4326&BBOX=${bbox.south},${bbox.west},${bbox.north},${bbox.east}` +
    `&TIME=${date}`;

  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) return null;

  try {
    const { data, info } = await sharp(buf)
      .removeAlpha()
      .resize(GRID, GRID, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: Buffer.from(data), width: info.width, height: info.height };
  } catch {
    return null; // not a decodable PNG (error XML, dst.)
  }
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ─── Nilai fisik dari warna (reverse LUT palet GIBS) ──────────────────────────
// bucket 4-bit per channel: indeks LUT = (r>>4)<<8 | (g>>4)<<4 | (b>>4)

function colorBucket(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

export function chlOf(r: number, g: number, b: number): number {
  return CHL_VALUE_LUT[colorBucket(r, g, b)];
}

export function sstOf(r: number, g: number, b: number): number {
  return SST_VALUE_LUT[colorBucket(r, g, b)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Estimasi pH permukaan laut (heuristik empiris, bukan pengukuran):
 * - Klorofil tinggi (fotosintesis) → pH cenderung basa (alkali): +0.25/decade chl.
 * - Suhu lebih hangat → kelarutan CO2 turun, pH sedikit turun: -0.03/°C di atas 28°C.
 */
function phFromChl(chl: number): number {
  return clamp(7.9 + 0.25 * Math.log10(1 + chl), 7.0, 9.0);
}

function phFromSst(sst: number): number {
  return clamp(7.9 - 0.03 * (sst - 28), 7.2, 8.6);
}

function medianOf(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Ringkas statistik pH dari array nilai pH piksel. */
function summarizePh(phValues: number[]): SatellitePhEstimate | null {
  if (phValues.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let acid = 0;
  let alkaline = 0;
  for (const v of phValues) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    if (v < 7.5) acid++;
    else if (v > 8.4) alkaline++;
  }
  return {
    min: +min.toFixed(2),
    max: +max.toFixed(2),
    avg: +(sum / phValues.length).toFixed(2),
    acidFraction: +(acid / phValues.length).toFixed(3),
    alkalineFraction: +(alkaline / phValues.length).toFixed(3),
  };
}

interface PixelStats {
  valid: number;
  cloud: number;
  dark: number; // area gelap di laut (kandidat slick minyak)
  bloom: number; // merah/oranye dominan (klorofil tinggi)
  thermal: number; // merah terang (suhu tinggi)
}

/** Analisis piksel per layer menggunakan heuristik palet warna GIBS. */
function analyzePixels(layer: string, data: Buffer): PixelStats {
  const stats: PixelStats = { valid: 0, cloud: 0, dark: 0, bloom: 0, thermal: 0 };

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r === 0 && g === 0 && b === 0) continue; // transparan / no-data
    stats.valid++;

    const lum = luminance(r, g, b);
    const reddish = r > 110 && r > g * 1.1 && g > b * 0.85;

    if (layer === 'MODIS_Terra_CorrectedReflectance_TrueColor') {
      if (r > 205 && g > 205 && b > 205) stats.cloud++;
      else if (lum < 60) stats.dark++; // air sangat gelap (kandidat tumpahan)
    } else if (layer === 'OCI_PACE_Chlorophyll_a' || layer === 'MODIS_Terra_L2_Chlorophyll_A') {
      if (reddish) stats.bloom++; // palet GIBS: merah = klorofil sangat tinggi
    } else if (layer === 'GHRSST_L4_MUR25_Sea_Surface_Temperature') {
      if (r > 165 && r > g * 1.2 && g > b * 1.05) stats.thermal++; // merah = zona sangat hangat
    }
  }

  return stats;
}

/** Hitung centroid + area anomali dari piksel yang memenuhi predicate. */
function anomalyFromPixels(
  data: Buffer,
  width: number,
  height: number,
  bbox: Bbox,
  kind: SatelliteAnomaly['kind'],
  label: string,
  note: string,
  predicate: (r: number, g: number, b: number) => boolean,
  waterOnly = false,
  valueFn?: (r: number, g: number, b: number) => number
): SatelliteAnomaly | null {
  let count = 0;
  let sumLat = 0;
  let sumLon = 0;
  let valueSum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (!predicate(data[i], data[i + 1], data[i + 2])) continue;
      const lat = bbox.north - ((y + 0.5) / height) * (bbox.north - bbox.south);
      if (waterOnly && isLandPoint(lat, bbox.west + ((x + 0.5) / width) * (bbox.east - bbox.west))) continue;
      count++;
      const lon = bbox.west + ((x + 0.5) / width) * (bbox.east - bbox.west);
      sumLat += lat;
      sumLon += lon;
      if (valueFn) valueSum += valueFn(data[i], data[i + 1], data[i + 2]);
    }
  }
  if (count === 0) return null;

  const latSpanKm = ((bbox.north - bbox.south) / height) * 111.32;
  const lonSpanKm =
    ((bbox.east - bbox.west) / width) * 111.32 * Math.cos((((bbox.north + bbox.south) / 2) * Math.PI) / 180);
  const areaKm2 = count * latSpanKm * lonSpanKm;

  const anomaly: SatelliteAnomaly = {
    kind,
    label,
    fraction: count / (width * height),
    centerLat: sumLat / count,
    centerLon: sumLon / count,
    areaKm2: Math.round(areaKm2),
    note,
  };
  if (valueFn) {
    const mean = valueSum / count;
    if (kind === 'bloom') anomaly.chl = +mean.toFixed(2);
    if (kind === 'thermal') anomaly.sst = +mean.toFixed(2);
  }
  return anomaly;
}

/** Coba tanggal diminta + beberapa hari mundur; pilih yang coverage-nya terbaik. */
async function bestImagery(
  layer: string,
  bbox: Bbox,
  requestedDate: string,
  maxBackfillDays: number
): Promise<{ data: Buffer; width: number; height: number; date: string; usedLayer: string } | null> {
  // Urutan: tanggal yang diminta user, lalu hari ini, kemarin, … mundur.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const d of [requestedDate, ...Array.from({ length: maxBackfillDays + 1 }, (_, i) => dateDaysAgo(i))]) {
    if (!seen.has(d)) {
      seen.add(d);
      ordered.push(d);
    }
  }

  let best: { data: Buffer; width: number; height: number; date: string; coverage: number } | null = null;

  for (const date of ordered) {
    const tile = await fetchTile(layer, bbox, date);
    if (!tile) continue;
    const total = tile.width * tile.height;
    const coverage = total > 0 ? countValid(tile.data) / total : 0;
    if (!best || coverage > best.coverage) best = { ...tile, date, coverage };
    if (coverage >= 0.08) return { data: tile.data, width: tile.width, height: tile.height, date, usedLayer: layer }; // cukup — stop lebih awal
  }

  return best ? { ...best, usedLayer: layer } : null;
}

function countValid(data: Buffer): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (!(data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0)) n++;
  }
  return n;
}

/** Analisis penuh satu layer (dengan fallback layer cadangan). */
async function analyzeLayer(
  cfg: { layer: string; label: string; fallback?: string },
  bbox: Bbox,
  requestedDate: string
): Promise<SatelliteLayerAnalysis | null> {
  const maxBackfill = 7;
  let found = await bestImagery(cfg.layer, bbox, requestedDate, maxBackfill);

  if (!found && cfg.fallback) {
    found = await bestImagery(cfg.fallback, bbox, requestedDate, maxBackfill);
  }

  if (!found) return null;

  const { data, width, height, date, usedLayer } = found;
  const stats = analyzePixels(usedLayer, data);
  const total = width * height;
  const coveragePct = Math.round((stats.valid / total) * 100);

  const anomalies: SatelliteAnomaly[] = [];
  const latSpanKm = (bbox.north - bbox.south) * 111.32;
  const lonSpanKm =
    (bbox.east - bbox.west) * 111.32 * Math.cos((((bbox.north + bbox.south) / 2) * Math.PI) / 180);
  const regionKm2 = latSpanKm * lonSpanKm;

  const isTrueColor = usedLayer === 'MODIS_Terra_CorrectedReflectance_TrueColor';
  const isChl = usedLayer === 'OCI_PACE_Chlorophyll_a' || usedLayer === 'MODIS_Terra_L2_Chlorophyll_A';
  const isSst = usedLayer === 'GHRSST_L4_MUR25_Sea_Surface_Temperature';

  // ── Nilai fisik per piksel (LUT palet GIBS) + estimasi pH ──────────────────
  let phEstimate: SatellitePhEstimate | null = null;
  let medianChl: number | undefined;
  let medianSst: number | undefined;

  if (isChl) {
    const chlValues: number[] = [];
    const phValues: number[] = [];
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r === 0 && g === 0 && b === 0) continue;
      const chl = chlOf(r, g, b);
      chlValues.push(chl);
      phValues.push(phFromChl(chl));
    }
    phEstimate = summarizePh(phValues);
    medianChl = +medianOf(chlValues).toFixed(2);
  } else if (isSst) {
    const sstValues: number[] = [];
    const phValues: number[] = [];
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r === 0 && g === 0 && b === 0) continue;
      const sst = sstOf(r, g, b);
      sstValues.push(sst);
      phValues.push(phFromSst(sst));
    }
    phEstimate = summarizePh(phValues);
    medianSst = +medianOf(sstValues).toFixed(2);
  }

  // ── Anomali per layer ──────────────────────────────────────────────────────
  if (isTrueColor && stats.cloud / total > 0.02) {
    anomalies.push({
      kind: 'cloud',
      label: 'Tutupan awan',
      fraction: stats.cloud / total,
      centerLat: (bbox.north + bbox.south) / 2,
      centerLon: (bbox.west + bbox.east) / 2,
      areaKm2: Math.round((stats.cloud / total) * regionKm2),
      note: 'Awan menghalangi sebagian area — deteksi di bawahnya bisa terlewat.',
    });
  }

  if (isTrueColor) {
    // Netral-gelap (saturasi rendah) di atas LAUT — bukan biru laut dalam, bukan daratan
    const slick = anomalyFromPixels(
      data, width, height, bbox, 'slick', 'Area gelap di laut',
      'Piksel air netral-sangat-gelap — kandidat lapisan minyak, lumpur, atau zona anoksik; bukan laut dalam yang biru. pH cenderung asam karena dekomposisi.',
      (r, g, b) => {
        const lum = luminance(r, g, b);
        return lum < 45 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
      },
      true
    );
    if (slick && slick.areaKm2 >= 2) {
      slick.ph = +(phFromSst(28) - 0.3).toFixed(2); // zona gelap/degradasi → pH turun
      anomalies.push(slick);
    }

    // Plume sedimen/turbiditas (muara & buangan industri): air kecoklatan di LAUT
    const plume = anomalyFromPixels(
      data, width, height, bbox, 'turbidity', 'Plume sedimen / turbiditas',
      'Air kecoklatan di laut — kandidat muatan sedimen dari sungai atau buangan industri pesisir.',
      (r, g, b) => {
        const lum = luminance(r, g, b);
        return (
          lum > 45 &&
          r > 95 && r < 210 &&
          g > 70 && g < 185 &&
          b < 130 &&
          r - g < 50 &&
          g - b > 22
        );
      },
      true
    );
    if (plume && plume.areaKm2 >= 2) anomalies.push(plume);
  }

  if (isChl) {
    const bloom = anomalyFromPixels(
      data, width, height, bbox, 'bloom', 'Klorofil tinggi (merah/oranye)',
      'Palet GIBS: warna merah-oranye menandakan konsentrasi klorofil-a sangat tinggi — indikasi eutrofikasi / ledakan alga; fotosintesis tinggi menaikkan pH (alkali).',
      (r, g, b) => r > 110 && r > g * 1.1 && g > b * 0.85,
      true,
      chlOf
    );
    if (bloom && bloom.areaKm2 >= 2) {
      bloom.ph = +(phFromChl(bloom.chl ?? 5)).toFixed(2);
      anomalies.push(bloom);
    }
  }

  if (isSst) {
    // Relatif: piksel termasuk 5% paling merah di area & benar-benar merah-oranye.
    // Air tropis 28-30°C sudah oranye di palet MUR — pakai ambang persentil agar
    // hanya zona yang JAUH lebih panas dari sekitarnya yang dilaporkan.
    const rVals: number[] = [];
    for (let i = 0; i < data.length; i += 3) {
      if (!(data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0)) rVals.push(data[i]);
    }
    let threshold = 255;
    if (rVals.length > 0) {
      rVals.sort((a, b) => a - b);
      threshold = rVals[Math.floor(rVals.length * 0.95)];
    }
    const thermal = anomalyFromPixels(
      data, width, height, bbox, 'thermal', 'Zona suhu sangat hangat',
      'Area termasuk ~5% piksel terpanas di wilayah (merah palet MUR) — indikasi zona termal hangat, potensi buangan air panas industri.',
      (r, g, b) => r >= threshold && r > g && g > b,
      true,
      sstOf
    );
    if (thermal && thermal.areaKm2 >= 2) {
      thermal.ph = +(phFromSst(thermal.sst ?? 28)).toFixed(2);
      anomalies.push(thermal);
    }
  }

  const wmsUrl =
    `${GIBS_WMS_3857}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${usedLayer}` +
    `&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&CRS=EPSG:3857&TIME=${date}`;

  return {
    layer: usedLayer,
    label: cfg.label,
    imageryDate: date,
    coveragePct,
    cloudPct: isTrueColor ? Math.round((stats.cloud / total) * 100) : undefined,
    wmsUrl,
    anomalies,
    ...(phEstimate ? { ph: phEstimate } : {}),
    ...(medianChl !== undefined ? { medianChl } : {}),
    ...(medianSst !== undefined ? { medianSst } : {}),
  };
}

/** Analisis penuh citra satelit GIBS untuk satu bbox + tanggal (dengan cache). */
export async function analyzeSatellite(bbox: Bbox, requestedDate: string): Promise<SatelliteAnalysis> {
  const cacheKey = `sat:${JSON.stringify(bbox)}:${requestedDate}`;
  const cached = cacheGet<SatelliteAnalysis>(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const results = await Promise.all(
      LAYERS.map(async (cfg) => {
        try {
          return await analyzeLayer(cfg, bbox, requestedDate);
        } catch (err) {
          console.warn(`[Satelit] layer ${cfg.layer} gagal:`, err);
          return null;
        }
      })
    );

    const layers = results.filter((l): l is SatelliteLayerAnalysis => l !== null);

    let summary: string;
    if (layers.length === 0) {
      summary =
        'Citra satelit tidak tersedia untuk area ini pada jendela 7 hari terakhir (kemungkinan tutupan awan atau luar cakupan lintasan satelit harian).';
    } else {
      const parts = layers.map((l) => {
        const a = l.anomalies.filter((x) => x.kind !== 'cloud');
        const ph = l.ph ? `, pH ${l.ph.min}–${l.ph.max} (rata-rata ${l.ph.avg})` : '';
        return `${l.label} (${l.imageryDate}, cakupan ${l.coveragePct}%${ph}): ${
          a.length ? a.map((x) => `${x.label} ±${x.areaKm2} km²${x.ph ? `, pH ${x.ph}` : ''}`).join(', ') : 'tidak ada indikasi anomali'
        }`;
      });
      summary =
        `Analisis citra satelit NASA GIBS untuk area ini: ${parts.join('; ')}. ` +
        'Deteksi berbasis estimasi palet warna — perlu verifikasi lapangan.';
    }

    const analysis: SatelliteAnalysis = {
      source: 'satelit',
      layers,
      summary,
      fetchedAt: new Date().toISOString(),
      disclaimer:
        'Analisis citra satelit bersifat estimatif (berbasis palet warna GIBS), resolusi terbatas, dan dapat terhalang awan. Bukan pengukuran ilmiah — verifikasi lapangan diperlukan.',
    };

    cacheSet(cacheKey, analysis);
    return analysis;
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
  const requestedDate = parseDate(searchParams.get('date'));

  if (![north, south, east, west].every(Number.isFinite)) {
    return NextResponse.json({ error: 'north, south, east, west diperlukan' }, { status: 400 });
  }

  const bbox: Bbox = {
    north: Math.min(90, Math.max(-90, north)),
    south: Math.min(90, Math.max(-90, south)),
    east: Math.min(180, Math.max(-180, east)),
    west: Math.min(180, Math.max(-180, west)),
  };

  return NextResponse.json(await analyzeSatellite(bbox, requestedDate));
}
