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
import { isLandPoint } from '@/components/peta-risiko/distances';

/**
 * Analisis kualitas ikan terhadap perubahan iklim, suhu air, dan limbah.
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

  const sstDist = Math.abs(meanSst - sstMid) / sstHalf;
  const chlDist = Math.abs(meanChl - chlMid) / chlHalf;

  let penalty = Math.max(0, (sstDist - 1) * 25) + Math.max(0, (chlDist - 1) * 20);
  const notes: string[] = [];

  if (sstDist > 1) notes.push(`stres suhu (${meanSst.toFixed(1)}°C)`);
  if (chlDist > 1) notes.push(`klorofil di luar jendela (${meanChl.toFixed(2)} mg/m³)`);

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
    pressureSources,
    nearestContaminantKm: contKm,
    nearestContaminantLabel: near?.label ?? null,
    speciesQuality: qualities,
    sstStress: Math.round(Math.abs(z.meanSst - 27) * 10),
    habRisk,
    ph,
    phStress,
  };
}

// ── Citra overlay penyebaran (klorofil & SST) ──────────────────────────────

type Rgb = [number, number, number];

const CHL_STOPS: Array<[number, Rgb]> = [
  [0.0, [10, 50, 180]],
  [0.2, [0, 160, 240]],
  [0.4, [0, 210, 160]],
  [0.6, [60, 230, 90]],
  [0.75, [240, 230, 40]],
  [0.88, [255, 130, 0]],
  [1.0, [230, 20, 20]],
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
  values: Float32Array | null,
  id: 'chl' | 'sst' | 'ph',
  bbox: { north: number; south: number; east: number; west: number }
): Promise<FishQualityLayer | null> {
  const size = 256;
  const stops = id === 'chl' ? CHL_STOPS : id === 'sst' ? SST_STOPS : PH_STOPS;
  const min = id === 'chl' ? 0.05 : id === 'sst' ? 8 : 7.0;
  const max = id === 'chl' ? 10 : id === 'sst' ? 32 : 9.0;
  const log = id === 'chl';
  const logMin = Math.log10(min);
  const logSpan = Math.log10(max) - logMin;

  const rgba = Buffer.alloc(size * size * 4);
  const latStep = (bbox.north - bbox.south) / size;
  const lonStep = (bbox.east - bbox.west) / size;

  for (let y = 0; y < size; y++) {
    const lat = bbox.north - y * latStep;
    for (let x = 0; x < size; x++) {
      const lon = bbox.west + x * lonStep;
      const idx = y * size + x;

      // Skip land pixels so land mass remains clean white/grey map background
      if (isLandPoint(lat, lon)) {
        continue;
      }

      let v = values ? values[idx] : 0;
      if (!(v > 0)) {
        // Fallback synthetic marine ocean model if satellite data is cloud-covered
        if (id === 'chl') {
          const coastal = Math.exp(-Math.pow((lat + 6.3) / 2.2, 2));
          const noise = Math.sin(lat * 6.5) * Math.cos(lon * 6.0) * 0.4;
          v = Math.min(8.5, Math.max(0.08, 0.3 + coastal * 2.2 + Math.max(0, noise)));
        } else if (id === 'sst') {
          v = 28.5 + Math.sin(lat * 3) * 1.5;
        } else {
          v = 8.05;
        }
      }

      const t = log
        ? (Math.log10(v) - logMin) / logSpan
        : (v - min) / (max - min);
      const [r, g, b] = interpolateStops(t, stops);
      const o = idx * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 175; // ~68% opacity so ocean has rich vibrant heatmap colors while labels remain readable
    }
  }

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
    gridToDataUrl(bundle.chl, 'chl', bbox),
    gridToDataUrl(bundle.sst, 'sst', bbox),
    gridToDataUrl(bundle.chl && bundle.sst ? phGridOf(bundle.chl, bundle.sst) : null, 'ph', bbox),
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