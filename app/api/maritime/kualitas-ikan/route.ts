import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import type {
  FishQualityAnalysis,
  FishQualityLayer,
  FishQualityScore,
  FishingZone,
  SpeciesQuality,
} from '@/app/types/maritime';
import { analyzeZones, SPECIES, type Contaminant } from '../zona-tangkap/route';
import { phFromChl, phFromSst } from '../satelit/route';

/**
 * Analisis kualitas ikan terhadap perubahan iklim, suhu air, dan limbah.
 *
 * Memakai hasil analisis zona tangkap (analyzeZones — klorofil/SST NASA,
 * kontaminasi Sentinel-2/GIBS, arus BMKG, GFW) lalu menilai kualitas setiap
 * zona: tekanan suhu terhadap jendela habitat spesies, kesesuaian klorofil,
 * jarak ke titik kontaminasi terdekat, dan risiko ledakan alga (HAB).
 *
 * Skor 0-100 (tinggi = kualitas lebih baik). Output dikirim pendamping ke
 * /api/ai/kualitas-agent untuk narasi dampak iklim, limbah, dan prediksi
 * arah kawanan berikutnya.
 */

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const GENERIC_WINDOW = { name: '', sstMin: 20, sstMax: 30, chlMin: 0.15, chlMax: 4.0 };

/** pH optimal untuk habitat perikanan tropis (heuristik palet satelit). */
const PH_OPTIMAL = 8.0;
const PH_TOLERANCE = 1.0;

/** Estimasi pH permukaan laut zona — rata-rata heuristik klorofil & SST. */
export function zonePhOf(chl: number, sst: number): number {
  if (!(chl > 0) && !(sst > 0)) return 8.0;
  if (!(chl > 0)) return phFromSst(sst);
  if (!(sst > 0)) return phFromChl(chl);
  return (phFromChl(chl) + phFromSst(sst)) / 2;
}

function phStressOf(ph: number): number {
  return Math.round(clamp01(Math.abs(ph - PH_OPTIMAL) / PH_TOLERANCE) * 100);
}

function speciesQuality(
  name: string,
  meanSst: number,
  meanChl: number,
  habRisk: boolean,
  contKm: number | null,
  phStress: number
): SpeciesQuality {
  const spec = SPECIES.find((s) => s.name === name) ?? GENERIC_WINDOW;
  const sstMid = (spec.sstMin + spec.sstMax) / 2;
  const sstHalf = Math.max((spec.sstMax - spec.sstMin) / 2, 1);
  const chlMid = (spec.chlMin + spec.chlMax) / 2;
  const chlHalf = Math.max((spec.chlMax - spec.chlMin) / 2, 0.1);
  const sstStress = clamp01(Math.abs(meanSst - sstMid) / sstHalf);
  const chlStress = clamp01(Math.abs(meanChl - chlMid) / chlHalf);

  let penalty = sstStress * 35 + chlStress * 25;
  const notes: string[] = [];
  if (sstStress > 0.4) {
    notes.push(`stres suhu (${meanSst.toFixed(1)}°C vs optimal ~${sstMid.toFixed(0)}°C)`);
  }
  if (chlStress > 0.6) notes.push('klorofil di luar jendela habitat');
  if (habRisk) {
    penalty += 15;
    notes.push('risiko ledakan alga (HAB)');
  }
  if (contKm !== null && contKm < 20) {
    penalty += (1 - contKm / 20) * 20;
    notes.push(`kontaminasi terdekat ±${contKm.toFixed(0)} km`);
  }
  if (phStress > 40) {
    penalty += (phStress / 100) * 15;
    notes.push('pH air di luar kisaran optimal ~8.0');
  }
  if (notes.length === 0) notes.push('kondisi habitat sesuai');

  return {
    species: name,
    quality: Math.max(0, Math.round(100 - penalty)),
    note: notes.join('; '),
  };
}

function nearestContaminantTo(
  lat: number,
  lon: number,
  contaminants: Contaminant[]
): { km: number; label: string } | null {
  const midLatRad = (lat * Math.PI) / 180;
  let best: { km: number; label: string } | null = null;
  for (const c of contaminants) {
    const dLat = (lat - c.lat) * 111.32;
    const dLon = (lon - c.lon) * 111.32 * Math.cos(midLatRad);
    const d = Math.sqrt(dLat * dLat + dLon * dLon);
    if (best === null || d < best.km) best = { km: d, label: c.label };
  }
  return best;
}

function scoreZone(z: FishingZone, contaminants: Contaminant[], index: number): FishQualityScore {
  const habRisk = z.meanChl > 8;
  const near = nearestContaminantTo(z.lat, z.lon, contaminants);
  const contKm = near?.km ?? null;
  const ph = +zonePhOf(z.meanChl, z.meanSst).toFixed(2);
  const phStress = phStressOf(ph);
  const speciesList = z.species.length > 0 ? z.species : ['Ikan pelagis campuran'];
  const qualities = speciesList.map((s) =>
    speciesQuality(s, z.meanSst, z.meanChl, habRisk, contKm, phStress)
  );

  const pressureSources: string[] = [];
  if (qualities.some((q) => q.note.includes('stres suhu'))) {
    pressureSources.push('Stres suhu di luar jendela nyaman spesies');
  }
  if (habRisk) pressureSources.push('Risiko ledakan alga (HAB) — klorofil > 8 mg/m³');
  if (contKm !== null && contKm < 20) {
    pressureSources.push(`Dekat kontaminasi: ${near?.label ?? 'titik kontaminasi'} (±${contKm.toFixed(0)} km)`);
  }
  if (phStress > 40) {
    pressureSources.push(`pH tidak optimal untuk spesies (pH ${ph})`);
  }
  if (pressureSources.length === 0) pressureSources.push('Minim tekanan biotik');

  const qualityScore = Math.max(
    0,
    Math.round(qualities.reduce((a, q) => a + q.quality, 0) / qualities.length)
  );
  const qualityLabel =
    qualityScore >= 85 ? 'Sangat Baik' : qualityScore >= 65 ? 'Baik' : qualityScore >= 45 ? 'Sedang' : 'Berisiko';

  return {
    zoneIndex: index,
    lat: z.lat,
    lon: z.lon,
    qualityScore,
    qualityLabel,
    pressureSources: pressureSources.slice(0, 3),
    nearestContaminantKm: contKm !== null ? +contKm.toFixed(1) : null,
    nearestContaminantLabel: near?.label ?? null,
    speciesQuality: qualities,
    sstStress: sstStressOf(z),
    habRisk,
    ph,
    phStress,
  };
}

function sstStressOf(z: FishingZone): number {
  let max = 0;
  for (const s of z.species.length > 0 ? z.species : ['']) {
    const spec = SPECIES.find((x) => x.name === s) ?? GENERIC_WINDOW;
    const mid = (spec.sstMin + spec.sstMax) / 2;
    const half = Math.max((spec.sstMax - spec.sstMin) / 2, 1);
    max = Math.max(max, clamp01(Math.abs(z.meanSst - mid) / half));
  }
  return Math.round(max * 100);
}

// ── Citra overlay penyebaran (klorofil & SST) ──────────────────────────────
// Rasterisasi grid 256×256 hasil analisis menjadi PNG data URL dengan palet
// berhenti yang sama dengan legenda pada peta klien.

type Rgb = [number, number, number];

const CHL_STOPS: Array<[number, Rgb]> = [
  [0.0, [0, 0, 128]],
  [0.2, [0, 128, 255]],
  [0.4, [0, 192, 192]],
  [0.6, [0, 255, 128]],
  [0.75, [192, 255, 0]],
  [0.88, [255, 128, 0]],
  [1.0, [255, 0, 0]],
];

const SST_STOPS: Array<[number, Rgb]> = [
  [0.0, [59, 15, 112]],
  [0.25, [45, 123, 212]],
  [0.45, [35, 198, 194]],
  [0.6, [88, 216, 88]],
  [0.75, [240, 228, 66]],
  [0.88, [242, 142, 43]],
  [1.0, [215, 25, 28]],
];

// Palet pH: asam (merah) → netral (hijau) → basa (biru).
const PH_STOPS: Array<[number, Rgb]> = [
  [0.0, [190, 30, 45]],
  [0.25, [242, 142, 43]],
  [0.5, [240, 228, 66]],
  [0.68, [88, 216, 88]],
  [0.85, [35, 148, 214]],
  [1.0, [59, 60, 180]],
];

function interpolateStops(t: number, stops: Array<[number, Rgb]>): Rgb {
  if (t <= 0) return stops[0][1];
  if (t >= 1) return stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

async function gridToDataUrl(
  values: Float32Array,
  id: 'chl' | 'sst' | 'ph'
): Promise<FishQualityLayer | null> {
  const size = 256;
  const stops = id === 'chl' ? CHL_STOPS : id === 'sst' ? SST_STOPS : PH_STOPS;
  const min = id === 'chl' ? 0.05 : id === 'sst' ? 8 : 7.0;
  const max = id === 'chl' ? 10 : id === 'sst' ? 32 : 9.0;
  const log = id === 'chl';
  const logMin = Math.log10(min);
  const logSpan = Math.log10(max) - logMin;

  const rgba = Buffer.alloc(size * size * 4);
  let hasData = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!(v > 0)) continue;
    hasData = true;
    const t = log
      ? (Math.log10(v) - logMin) / logSpan
      : (v - min) / (max - min);
    const [r, g, b] = interpolateStops(t, stops);
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
  if (!hasData) return null;

  const png = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
  return { dataUrl: `data:image/png;base64,${png.toString('base64')}`, date: '', min, max };
}

/** Grid estimasi pH — kombinasi heuristik klorofil & SST per piksel. */
function phGridOf(chl: Float32Array, sst: Float32Array): Float32Array | null {
  const ph = new Float32Array(chl.length);
  let hasData = false;
  for (let i = 0; i < chl.length; i++) {
    const c = chl[i];
    const t = sst[i];
    if (c <= 0 && t <= 0) continue;
    hasData = true;
    ph[i] = zonePhOf(c, t);
  }
  return hasData ? ph : null;
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

  const bbox = {
    north: Math.min(90, Math.max(-90, north)),
    south: Math.min(90, Math.max(-90, south)),
    east: Math.min(180, Math.max(-180, east)),
    west: Math.min(180, Math.max(-180, west)),
  };
  const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '')
    ? searchParams.get('date')!
    : new Date().toISOString().slice(0, 10);

  const bundle = await analyzeZones(bbox, dateParam);
  const zones = bundle.analysis.zones;
  const scores = zones.map((z, i) => scoreZone(z, bundle.contaminants, i));

  const [chlLayer, sstLayer, phLayer] = await Promise.all([
    bundle.chl ? gridToDataUrl(bundle.chl, 'chl') : Promise.resolve(null),
    bundle.sst ? gridToDataUrl(bundle.sst, 'sst') : Promise.resolve(null),
    bundle.chl && bundle.sst
      ? gridToDataUrl(phGridOf(bundle.chl, bundle.sst)!, 'ph')
      : Promise.resolve(null),
  ]);
  const layers: FishQualityAnalysis['layers'] = {};
  if (chlLayer) layers.chl = { ...chlLayer, date: bundle.chlDate ?? bundle.date };
  if (sstLayer) layers.sst = { ...sstLayer, date: bundle.sstDate ?? bundle.date };
  if (phLayer) layers.ph = { ...phLayer, date: bundle.date };

  let summary: string;
  if (scores.length === 0) {
    summary =
      'Tidak ada zona aman di wilayah ini sehingga kualitas ikan tidak dapat dinilai — seluruh zona potensial ditolak karena berdekatan dengan kontaminasi (sampah padat/minyak/termal/turbiditas).';
  } else {
    const byScore = [...scores].sort((a, b) => b.qualityScore - a.qualityScore);
    const best = byScore[0];
    const worst = byScore[byScore.length - 1];
    const good = scores.filter((s) => s.qualityScore >= 65).length;
    summary =
      `${scores.length} zona aman dinilai: ${good} zona berstatus Baik atau lebih baik. ` +
      `Terbaik di ${best.lat.toFixed(3)},${best.lon.toFixed(3)} (skor kualitas ${best.qualityScore}/100 — ${best.qualityLabel}; ${best.pressureSources.join('; ')}). ` +
      `Kalibrasi air optimum pH ±${best.ph?.toFixed(2) ?? '—'} (tekanan pH ${best.phStress ?? 0}/100). ` +
      `Terendah ${worst.qualityScore}/100 — ${worst.pressureSources.join('; ')}.`;
  }

  const result: FishQualityAnalysis = {
    source: 'kualitas-ikan',
    date: bundle.date,
    zones,
    scores,
    layers: Object.keys(layers).length > 0 ? layers : undefined,
    summary,
    fetchedAt: new Date().toISOString(),
    disclaimer:
      'Penilaian kualitas ikan berbasis produk satelit resmi (SST & klorofil NASA), jarak ke kontaminasi (Sentinel-2/GIBS), estimasi pH (heuristik palet klorofil × SST), dan jendela habitat spesies dari literatur perikanan Indonesia. Estimasi — bukan jaminan mutu tangkapan; verifikasi sampel lapangan dianjurkan.',
  };

  return NextResponse.json(result);
}