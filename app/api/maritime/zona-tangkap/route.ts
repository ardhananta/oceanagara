import { NextRequest, NextResponse } from 'next/server';
import type {
  FishingZone,
  FishingZoneAnalysis,
  FishingGfwActivity,
  GfwVesselEvent,
} from '@/app/types/maritime';
import { analyzeSatellite, fetchTile, type Bbox } from '../satelit/route';
import { detectSolidWaste } from '../satelit-s2/route';
import { chlOf, sstOf } from '../satelit/route';
import { fetchGfwEvents } from '../gfw/route';
import { cardinalFromBearing, nearestCoast } from '@/components/peta-risiko/distances';

// Rekomendasi zona tangkap ikan berbasis data satelit asli (NASA GIBS):
// 1. Klorofil-a (makanan fitoplankton) & SST dari produk resmi NASA.
// 2. Skor kesesuaian habitat = fungsi klorofil × fungsi suhu.
// 3. Spesies ikan dipetakan dari jendela suhu & klorofil (literatur perikanan Indonesia).
// 4. Arah gerak kawanan: dominan arus laut (BMKG) + gradien klorofil (arah makanan).
// 5. Aktivitas kapal penangkap Global Fishing Watch (AIS/VMS) → hotspot konsentrasi
//    & arah migrasi ikan komersial (heading dominan kapal di dekat zona).
// 6. Zona dalam buffer kontaminasi (sampah padat Sentinel-2, slick minyak, termal,
//    turbiditas GIBS) DITOLAK — hanya zona aman yang direkomendasikan.

const CHL_LAYERS = ['OCI_PACE_Chlorophyll_a', 'MODIS_Terra_L2_Chlorophyll_A'];
const SST_LAYER = 'GHRSST_L4_MUR25_Sea_Surface_Temperature';

const GRID = 256;

// Jendela suhu (°C) & klorofil (mg/m³) per spesies — kompilasi literatur
// perikanan pelagis Indonesia (KKP, riset penginderaan jauh perikanan).
const SPECIES: Array<{ name: string; sstMin: number; sstMax: number; chlMin: number; chlMax: number }> = [
  { name: 'Cakalang (Skipjack)', sstMin: 20, sstMax: 30, chlMin: 0.15, chlMax: 0.8 },
  { name: 'Madidihang (Yellowfin)', sstMin: 18, sstMax: 29, chlMin: 0.15, chlMax: 1.5 },
  { name: 'Tuna Mata Besar (Bigeye)', sstMin: 14, sstMax: 24, chlMin: 0.15, chlMax: 1.2 },
  { name: 'Tongkol (Little Tuna)', sstMin: 18, sstMax: 30, chlMin: 0.25, chlMax: 2.0 },
  { name: 'Layang (Scad)', sstMin: 20, sstMax: 28, chlMin: 0.3, chlMax: 2.5 },
  { name: 'Kembung (Mackerel)', sstMin: 22, sstMax: 30, chlMin: 0.3, chlMax: 3.0 },
  { name: 'Tenggiri (Spanish Mackerel)', sstMin: 24, sstMax: 30, chlMin: 0.4, chlMax: 3.0 },
  { name: 'Lemuru (Bali Sardinella)', sstMin: 16, sstMax: 24, chlMin: 0.5, chlMax: 3.5 },
  { name: 'Teri (Anchovy)', sstMin: 22, sstMax: 30, chlMin: 0.4, chlMax: 4.0 },
  { name: 'Kakap Merah (Pesisir)', sstMin: 24, sstMax: 31, chlMin: 0.5, chlMax: 3.5 },
];

function chlScore(chl: number): number {
  if (chl < 0.05) return 0.15;
  if (chl < 0.1) return 0.5;
  if (chl < 0.3) return 0.85;
  if (chl <= 3) return 1.0;
  if (chl <= 5) return 0.85;
  if (chl <= 10) return 0.6;
  return 0.35;
}

function sstScore(sst: number): number {
  if (sst < 14) return 0.1;
  if (sst < 18) return 0.5;
  if (sst < 22) return 0.85;
  if (sst <= 30) return 1.0;
  if (sst <= 32) return 0.8;
  return 0.4;
}

/** Arus laut dari API publik BMKG (titik pusat wilayah). */
async function fetchCurrent(
  lat: number,
  lon: number
): Promise<{ speed: number; direction: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://peta-maritim.bmkg.go.id/public_api/perairan?lat=${lat}&lon=${lon}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text().catch(() => '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any = null;
    try {
      raw = JSON.parse(text);
      if (typeof raw === 'string') raw = JSON.parse(raw);
    } catch {
      return null;
    }
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.forecasts)
          ? raw.forecasts
          : null;
    if (!list || list.length === 0) return null;
    const f = list[0];
    const speed = Number(f.current_speed ?? f.currentSpeed ?? f.cs ?? 0.3);
    const dir = Number(f.current_direction ?? f.currentDir ?? f.cd ?? 180);
    return { speed: parseFloat(speed.toFixed(2)), direction: Math.round(dir) };
  } catch {
    return null;
  }
}

/** Ambil grid klorofil/SST dengan fallback tanggal (reuse logika best-coverage GIBS). */
async function fetchLayerGrid(
  layers: string[],
  bbox: Bbox,
  date: string
): Promise<{ values: Float32Array; date: string } | null> {
  for (const layer of layers) {
    for (let back = 0; back <= 7; back++) {
      const d = new Date(date);
      d.setUTCDate(d.getUTCDate() - back);
      const day = d.toISOString().slice(0, 10);
      const tile = await fetchTile(layer, bbox, day);
      if (!tile) continue;
      const values = new Float32Array(GRID * GRID);
      let valid = 0;
      for (let i = 0; i < tile.data.length; i += 3) {
        const r = tile.data[i];
        const g = tile.data[i + 1];
        const b = tile.data[i + 2];
        if (r === 0 && g === 0 && b === 0) continue;
        values[(i / 3) | 0] = layer.includes('Chlorophyll') ? chlOf(r, g, b) : sstOf(r, g, b);
        valid++;
      }
      if (valid / (GRID * GRID) >= 0.08) return { values, date: day };
    }
  }
  return null;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Hitung arah (derajat) dari vektor gradien pada grid (0=N, searah jarum jam). */
function bearingOfGradient(gx: number, gy: number): number {
  // gy positif = ke arah selatan (y gambar ke bawah); gx positif = ke timur.
  const north = -gy;
  const east = gx;
  let deg = (Math.atan2(east, north) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/** Heading rata-rata (sirkular, 0=N) dari sekumpulan heading. */
function meanHeading(headings: number[]): number {
  if (headings.length === 0) return NaN;
  let sinSum = 0;
  let cosSum = 0;
  for (const h of headings) {
    const rad = (h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  let deg = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/** Ringkasan aktivitas kapal penangkap GFW: hotspot klaster + statistik. */
function summarizeGfwActivity(
  events: GfwVesselEvent[],
  bbox: Bbox,
  isMock: boolean
): FishingGfwActivity {
  const fishingEvents = events.filter((e) => e.type === 'fishing').length;
  const loiteringEvents = events.filter((e) => e.type === 'loitering').length;

  // Klasterkan event ke grid sel ±0.25° (~27 km) — konsentrasi kapal di sel
  // yang sama = indikasi titik penangkapan (feeding ground komersial).
  const CELL_DEG = 0.25;
  const cellKey = (lat: number, lon: number) =>
    `${Math.round((lat - bbox.south) / CELL_DEG)},${Math.round((lon - bbox.west) / CELL_DEG)}`;

  const cells = new Map<string, { latSum: number; lonSum: number; count: number; headings: number[] }>();
  for (const e of events) {
    const key = cellKey(e.lat, e.lon);
    const cell = cells.get(key) ?? { latSum: 0, lonSum: 0, count: 0, headings: [] };
    cell.latSum += e.lat;
    cell.lonSum += e.lon;
    cell.count += 1;
    if (typeof e.heading === 'number' && Number.isFinite(e.heading)) {
      cell.headings.push(((e.heading % 360) + 360) % 360);
    }
    cells.set(key, cell);
  }

  const hotspots = [...cells.entries()]
    .map(([rawKey, cell]) => ({
      lat: +(cell.latSum / cell.count).toFixed(4),
      lon: +(cell.lonSum / cell.count).toFixed(4),
      count: cell.count,
      headingDeg:
        cell.headings.length >= 2
          ? Math.round(meanHeading(cell.headings))
          : undefined,
      rawKey,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ lat, lon, count, headingDeg }) => ({ lat, lon, count, headingDeg }));

  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - 7 * 86_400_000);
  return {
    totalEvents: events.length,
    fishingEvents,
    loiteringEvents,
    isMock,
    hotspots,
    period: `${periodStart.toISOString().slice(0, 10)} s/d ${periodEnd.toISOString().slice(0, 10)}`,
  };
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

  const bbox: Bbox = {
    north: Math.min(90, Math.max(-90, north)),
    south: Math.min(90, Math.max(-90, south)),
    east: Math.min(180, Math.max(-180, east)),
    west: Math.min(180, Math.max(-180, west)),
  };
  const bboxArr: [number, number, number, number] = [bbox.west, bbox.south, bbox.east, bbox.north];

  const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '')
    ? searchParams.get('date')!
    : dateDaysAgo(0);
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;

  const [satRes, wasteRes, currentRes, chlRes, sstRes, gfwRes] = await Promise.all([
    analyzeSatellite(bbox, dateParam).catch(() => null),
    detectSolidWaste(bboxArr, dateParam).catch(() => null),
    fetchCurrent(centerLat, centerLon),
    fetchLayerGrid(CHL_LAYERS, bbox, dateParam),
    fetchLayerGrid([SST_LAYER], bbox, dateParam),
    fetchGfwEvents({
      north: bbox.north,
      south: bbox.south,
      east: bbox.east,
      west: bbox.west,
      startDate: dateDaysAgo(7),
      endDate: dateDaysAgo(0),
      maxEvents: 60,
    }).catch(() => null),
  ]);

  if (!chlRes || !sstRes) {
    return NextResponse.json({
      source: 'zona-tangkap',
      date: dateParam,
      zones: [],
      avoidedCount: 0,
      rejectedZones: 0,
      summary:
        'Citra klorofil/SST tidak tersedia untuk area ini dalam jendela 7 hari (tutupan awan atau di luar lintasan satelit). Coba wilayah lain atau beberapa hari ke depan.',
      fetchedAt: new Date().toISOString(),
      disclaimer: 'Rekomendasi berbasis citra satelit estimatif — cek kondisi lapangan sebelum melaut.',
    } satisfies FishingZoneAnalysis);
  }

  const chl = chlRes.values;
  const sst = sstRes.values;

  // ── Skor kesesuaian per piksel (klorofil × suhu) ─────────────────────────
  const suitability = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const c = chl[i];
    const t = sst[i];
    if (c <= 0 || t <= 0) continue;
    suitability[i] = chlScore(c) * sstScore(t);
  }

  const latSpanKm = (bbox.north - bbox.south) * 111.32;
  const lonSpanKm =
    (bbox.east - bbox.west) * 111.32 * Math.cos((((bbox.north + bbox.south) / 2) * Math.PI) / 180);
  const pxLatKm = latSpanKm / GRID;
  const pxLonKm = lonSpanKm / GRID;

  // ── Klaster zona potensial (BFS 8-konektivitas) ──────────────────────────
  const MIN_CLUSTER_PX = 6;
  const SUIT_THRESHOLD = 0.5;
  const MAX_ZONE_PX = 500; // klaster lebih besar dipecah jadi zona fokus
  const visited = new Uint8Array(GRID * GRID);
  const clusters: Array<{ px: number[] }> = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      if (suitability[idx] < SUIT_THRESHOLD || visited[idx]) continue;
      const stack = [idx];
      const px: number[] = [];
      visited[idx] = 1;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        px.push(cur);
        const cx = cur % GRID;
        const cy = (cur / GRID) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
            const ni = ny * GRID + nx;
            if (suitability[ni] >= SUIT_THRESHOLD && !visited[ni]) {
              visited[ni] = 1;
              stack.push(ni);
            }
          }
        }
      }
      if (px.length >= MIN_CLUSTER_PX) clusters.push({ px });
    }
  }

  // ── Pecah klaster besar menjadi zona fokus di sekitar puncak kesesuaian ──
  // Local maxima: skor rata-rata lingkungan 9×9; non-max suppression 18 px.
  const localMean = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      if (suitability[idx] < SUIT_THRESHOLD) continue;
      let sum = 0;
      let cnt = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (suitability[ni] >= SUIT_THRESHOLD) {
            sum += suitability[ni];
            cnt++;
          }
        }
      }
      localMean[idx] = cnt > 0 ? sum / cnt : 0;
    }
  }

  const SEED_MIN_DIST = 18;
  const ZONE_RADIUS = 14;
  const zoneSeeds: Array<{ px: number[] }> = [];
  for (const cluster of clusters) {
    if (cluster.px.length <= MAX_ZONE_PX) {
      zoneSeeds.push(cluster);
      continue;
    }
    // Kandidat seed = piksel dengan localMean tertinggi (non-max suppression)
    const sorted = [...cluster.px].sort((a, b) => localMean[b] - localMean[a]);
    const kept: Array<{ idx: number; x: number; y: number }> = [];
    for (const idx of sorted) {
      const x = idx % GRID;
      const y = (idx / GRID) | 0;
      let tooClose = false;
      for (const k of kept) {
        const dx = k.x - x;
        const dy = k.y - y;
        if (dx * dx + dy * dy < SEED_MIN_DIST * SEED_MIN_DIST) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) kept.push({ idx, x, y });
      if (kept.length >= 8) break;
    }
    // Setiap piksel klaster bergabung ke seed terdekat dalam radius zona
    for (const seed of kept) {
      zoneSeeds.push({ px: [seed.idx] });
    }
    const memberOf = new Int16Array(GRID * GRID).fill(-1);
    for (let s = 0; s < kept.length; s++) {
      const { x, y } = kept[s];
      for (let dy = -ZONE_RADIUS; dy <= ZONE_RADIUS; dy++) {
        for (let dx = -ZONE_RADIUS; dx <= ZONE_RADIUS; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (suitability[ni] < SUIT_THRESHOLD) continue;
          if (memberOf[ni] === -1) {
            memberOf[ni] = s;
            zoneSeeds[s].px.push(ni);
          } else {
            // reassign hanya bila seed ini lebih dekat
            const cur = kept[memberOf[ni]];
            const curD = (cur.x - nx) ** 2 + (cur.y - ny) ** 2;
            const newD = (x - nx) ** 2 + (y - ny) ** 2;
            if (newD < curD) {
              zoneSeeds[memberOf[ni]].px = zoneSeeds[memberOf[ni]].px.filter((p) => p !== ni);
              memberOf[ni] = s;
              zoneSeeds[s].px.push(ni);
            }
          }
        }
      }
    }
  }

  // ── Titik kontaminasi (buffer penolakan zona) ────────────────────────────
  type Contaminant = { lat: number; lon: number; radiusKm: number; label: string };
  const contaminants: Contaminant[] = [];
  for (const c of wasteRes?.candidates ?? []) {
    contaminants.push({ lat: c.lat, lon: c.lon, radiusKm: 4, label: 'sampah padat terapung' });
  }
  for (const layer of satRes?.layers ?? []) {
    for (const a of layer.anomalies) {
      if (a.kind === 'cloud') continue;
      const radiusKm = Math.max(5, Math.sqrt(a.areaKm2 / Math.PI) * 1.5);
      contaminants.push({ lat: a.centerLat, lon: a.centerLon, radiusKm, label: a.label });
    }
  }

  const midLatRad = (((bbox.north + bbox.south) / 2) * Math.PI) / 180;

  // ── Bangun zona final + eksklusi kontaminasi ─────────────────────────────
  const zones: FishingZone[] = [];
  let rejectedZones = 0;

  for (const cluster of zoneSeeds) {
    const px = cluster.px.filter((idx) => suitability[idx] >= SUIT_THRESHOLD);
    if (px.length < MIN_CLUSTER_PX) continue;
    let sumScore = 0;
    let sumSst = 0;
    let sumChl = 0;
    let sumX = 0;
    let sumY = 0;
    let gx = 0;
    let gy = 0;
    for (const idx of px) {
      const x = idx % GRID;
      const y = (idx / GRID) | 0;
      sumScore += suitability[idx];
      sumSst += sst[idx];
      sumChl += chl[idx];
      sumX += x;
      sumY += y;
      const left = x > 0 ? chl[idx - 1] : 0;
      const right = x < GRID - 1 ? chl[idx + 1] : 0;
      const up = y > 0 ? chl[idx - GRID] : 0;
      const down = y < GRID - 1 ? chl[idx + GRID] : 0;
      gx += right - left;
      gy += down - up;
    }
    const n = px.length;
    const cLat = bbox.north - ((sumY / n + 0.5) / GRID) * latSpanKm / 111.32;
    const cLon = bbox.west + ((sumX / n + 0.5) / GRID) * lonSpanKm / (111.32 * Math.cos(midLatRad));

    // Eksklusi: centroid dalam buffer kontaminan?
    let blockedBy: string | null = null;
    for (const cont of contaminants) {
      const dLat = (cLat - cont.lat) * 111.32;
      const dLon = (cLon - cont.lon) * 111.32 * Math.cos(midLatRad);
      const d = Math.sqrt(dLat * dLat + dLon * dLon);
      if (d < cont.radiusKm) {
        blockedBy = cont.label;
        break;
      }
    }

    const meanSst = sumSst / n;
    const meanChl = sumChl / n;
    const score = sumScore / n;
    const coast = nearestCoast(cLat, cLon);
    const coastKm = coast ? coast.distanceKm : 400;

    // Arah gerak kawanan: dominan arus laut; tanpa arus → gradien klorofil.
    const gradDeg = bearingOfGradient(gx, gy);
    const current = currentRes;
    let movementDeg: number;
    let movementLabel: string;
    if (current && current.speed >= 0.15) {
      movementDeg = current.direction;
      movementLabel = `Mengikuti arus laut ${cardinalFromBearing(current.direction)} (${current.speed} m/s)`;
    } else {
      movementDeg = gradDeg;
      movementLabel = `Menuju gradien makanan (klorofil) ${cardinalFromBearing(gradDeg)}`;
    }

    // Aktivitas kapal penangkap di sekitar zona (radius 30 km) — indikasi
    // feeding ground komersial; heading dominan kapal ≈ arah migrasi ikan.
    let vesselsNear = 0;
    let vesselHeading: number | undefined;
    if (gfwRes && !gfwRes.isMock) {
      const headings: number[] = [];
      for (const e of gfwRes.vesselEvents) {
        if (e.type !== 'fishing' && e.type !== 'loitering') continue;
        const dLat = (cLat - e.lat) * 111.32;
        const dLon = (cLon - e.lon) * 111.32 * Math.cos(midLatRad);
        const d = Math.sqrt(dLat * dLat + dLon * dLon);
        if (d <= 30) {
          vesselsNear += 1;
          if (typeof e.heading === 'number' && Number.isFinite(e.heading)) {
            headings.push(((e.heading % 360) + 360) % 360);
          }
        }
      }
      if (headings.length >= 2) vesselHeading = Math.round(meanHeading(headings));
    }

    // Spesies: jendela suhu & klorofil zona.
    const species = SPECIES.filter(
      (s) => meanSst >= s.sstMin && meanSst <= s.sstMax && meanChl >= s.chlMin && meanChl <= s.chlMax
    )
      .map((s) => s.name)
      .slice(0, 4);

    const flagged = meanChl > 8 ? 'Bloom klorofil ekstrem (>8 mg/m³) — risiko ledakan alga (HAB), waspada' : undefined;

    if (blockedBy) {
      rejectedZones++;
      continue;
    }

    zones.push({
      lat: +cLat.toFixed(4),
      lon: +cLon.toFixed(4),
      areaKm2: Math.round((n * pxLatKm * pxLonKm + Number.EPSILON) * 100) / 100,
      score: +score.toFixed(2),
      species,
      meanSst: +meanSst.toFixed(2),
      meanChl: +meanChl.toFixed(2),
      ...(current ? { currentSpeed: current.speed, currentDirection: current.direction } : {}),
      movementDeg: +movementDeg.toFixed(0),
      movementLabel,
      coastKm: +coastKm.toFixed(1),
      ...(vesselsNear > 0 ? { nearbyVessels: vesselsNear } : {}),
      ...(vesselHeading !== undefined ? { vesselHeading } : {}),
      ...(flagged ? { flagged } : {}),
    });
  }

  zones.sort((a, b) => b.score - a.score);
  const top = zones.slice(0, 5);

  let summary: string;
  if (zones.length === 0) {
    summary =
      `Tidak ada zona tangkap yang lolos verifikasi keselamatan di wilayah ini — ${rejectedZones} zona potensial ditolak karena berdekatan dengan kontaminasi (${contaminants.length} titik: sampah padat/minyak/termal/turbiditas).`;
  } else {
    const list = top
      .map(
        (z) =>
          `${z.lat.toFixed(3)},${z.lon.toFixed(3)} (skor ${z.score.toFixed(2)}; ${z.species.length ? z.species.join(', ') : 'spesies campuran'}; ${z.movementLabel})`
      )
      .join('; ');
    summary =
      `${zones.length} zona aman direkomendasikan (${rejectedZones} zona potensial ditolak karena kontaminasi; ${contaminants.length} titik kontaminasi dihindari). Terbaik: ${list}.`;
  }

  return NextResponse.json({
    source: 'zona-tangkap',
    date: chlRes.date !== sstRes.date ? `${chlRes.date} & ${sstRes.date}` : chlRes.date,
    zones,
    avoidedCount: contaminants.length,
    rejectedZones,
    summary,
    ...(gfwRes
      ? { gfw: summarizeGfwActivity(gfwRes.vesselEvents, bbox, gfwRes.isMock ?? false) }
      : {}),
    fetchedAt: new Date().toISOString(),
    disclaimer:
      'Rekomendasi berbasis produk satelit resmi (klorofil & SST NASA), arus BMKG, dan aktivitas kapal Global Fishing Watch. Spesies ikan adalah estimasi jendela suhu/klorofil — bukan jaminan tangkapan. Selalu cek kondisi cuaca & verifikasi lapangan.',
  } satisfies FishingZoneAnalysis);
}
