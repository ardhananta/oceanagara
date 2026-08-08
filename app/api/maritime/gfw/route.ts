import { NextRequest, NextResponse } from 'next/server';
import type { GfwData, GfwVesselEvent } from '@/app/types/maritime';
import { bearingDeg, isLandPoint, type GeoPoint } from '@/components/peta-risiko/distances';

const MAX_EVENTS = 20;

// Circuit breaker: gateway GFW sering lambat/down. Setelah satu kegagalan,
// skip API nyata selama 5 menit dan langsung pakai data mock — menghemat
// ~10s per request (timeout API) tanpa menahan pipeline prediksi.
const GFW_CIRCUIT_MS = 5 * 60 * 1000;
let lastGfwFailureAt = 0;

function clampLat(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}

/** Mock vessel name pool — realistic Indonesian + regional flags. */
const MOCK_VESSELS = [
  { name: 'KM SAMUDRA JAYA', type: 'fishing', flag: 'IDN' },
  { name: 'KM BINTANG LAUT 12', type: 'fishing', flag: 'IDN' },
  { name: 'MV NUSANTARA EXPRESS', type: 'cargo', flag: 'IDN' },
  { name: 'MV TANJUNG PERAK 3', type: 'cargo', flag: 'IDN' },
  { name: 'MT OIL STAR 88', type: 'tanker', flag: 'SGP' },
  { name: 'MT KAPUAS PETRO', type: 'tanker', flag: 'IDN' },
  { name: 'KM SABUK NUSANTARA 5', type: 'passenger', flag: 'IDN' },
  { name: 'MV HAI YANG 7', type: 'cargo', flag: 'CHN' },
  { name: 'FV PENABUR 01', type: 'fishing', flag: 'MYS' },
  { name: 'MT BALIKPAPAN GOLD', type: 'tanker', flag: 'IDN' },
];

/** Random water-only position inside the bbox (rejected when on land). */
function randomWaterPoint(bbox: { north: number; south: number; east: number; west: number }): GeoPoint | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const lat = clampLat(bbox.south + Math.random() * (bbox.north - bbox.south));
    const lon = bbox.west + Math.random() * (bbox.east - bbox.west);
    if (!isLandPoint(lat, lon)) return { lat, lon };
  }
  return null;
}

/** Geser titik sepanjang heading (dead reckoning sederhana untuk mock). */
function moveByHeading(lat: number, lon: number, headingDeg: number, speedKnots: number, hours: number): GeoPoint {
  const distanceKm = speedKnots * 1.852 * hours;
  const rad = (headingDeg * Math.PI) / 180;
  return {
    lat: lat + (distanceKm * Math.cos(rad)) / 111.32,
    lon: lon + (distanceKm * Math.sin(rad)) / (111.32 * Math.cos((lat * Math.PI) / 180)),
  };
}

/** Pertahankan titik agar tetap di dalam (atau dekat) area pindai. */
function clampToBbox(point: GeoPoint, bbox: { north: number; south: number; east: number; west: number }): GeoPoint {
  const pad = Math.max(0.2, (bbox.north - bbox.south) * 0.25);
  return {
    lat: Math.min(bbox.north + pad, Math.max(bbox.south - pad, point.lat)),
    lon: Math.min(bbox.east + pad, Math.max(bbox.west - pad, point.lon)),
  };
}

const EVENT_TYPES: GfwVesselEvent['type'][] = ['fishing', 'loitering', 'port_visit'];

/**
 * Data mock yang realistis untuk jendela [startDate, endDate]: tiap kapal punya
 * identitas tetap (id/nama/jenis/bendera) dan muncul 2–4× melintas dengan posisi
 * yang bergerak sepanjang heading-nya — konsisten untuk tampilan "riwayat lewat",
 * posisi saat ini, dan prediksi rute.
 */
export function getMockGfwData(
  bbox: { north: number; south: number; east: number; west: number },
  startDate?: string,
  endDate?: string
): GfwData {
  const start = new Date(startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]).getTime();
  const end = new Date(endDate ?? new Date().toISOString().split('T')[0]).getTime();
  const windowMs = Math.max(3600000, end - start);

  const events: GfwVesselEvent[] = [];
  for (let i = 0; i < MOCK_VESSELS.length; i++) {
    const vessel = MOCK_VESSELS[i];
    const vesselId = `VES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const heading = Math.floor(Math.random() * 360);
    const speedKnots = +(Math.random() * 9 + 3).toFixed(1);

    // 2–4 lintasan dengan waktu acak terurut dalam jendela.
    const passCount = 2 + Math.floor(Math.random() * 3);
    const times = Array.from({ length: passCount }, () => start + Math.random() * windowMs).sort((a, b) => a - b);

    let prev: { lat: number; lon: number; time: number } | null = null;
    for (const t of times) {
      let point: GeoPoint | null = null;
      if (prev) {
        // Geser sepanjang heading dari posisi sebelumnya, lalu jepit agar tetap
        // di dalam area pindai — tanpa ini, selisih waktu antar lintasan berhari-
        // hari bisa melempar posisi kapal ribuan km keluar peta.
        const moved = clampToBbox(
          moveByHeading(prev.lat, prev.lon, heading, speedKnots, (t - prev.time) / 3600000),
          bbox
        );
        point = isLandPoint(moved.lat, moved.lon) ? randomWaterPoint(bbox) : moved;
      }
      point = point ?? randomWaterPoint(bbox);
      if (!point) continue;

      const type = EVENT_TYPES[i % EVENT_TYPES.length];
      const durationHours = 1 + Math.random() * 7;
      events.push({
        type,
        lat: point.lat,
        lon: point.lon,
        startTime: new Date(t).toISOString(),
        endTime: new Date(t + durationHours * 3600000).toISOString(),
        vesselId,
        flag: vessel.flag,
        vesselName: vessel.name,
        vesselType: vessel.type,
        heading,
        speedKnots: type === 'loitering' ? +(Math.random() * 0.8).toFixed(1) : speedKnots,
        endDistanceFromShoreKm: +(Math.random() * 20 + 0.5).toFixed(1),
      });
      prev = { lat: point.lat, lon: point.lon, time: t };
    }
  }
  return { source: 'gfw', vesselEvents: events, totalEvents: events.length };
}

/**
 * Estimate vessel heading (0=N) from the event bounding box:
 * the corner farthest from the end position approximates the event start,
 * so the bearing start → position gives the general direction of travel.
 */
function estimateHeading(boundingBox: number[], position: GeoPoint): number | undefined {
  if (!Array.isArray(boundingBox) || boundingBox.length < 4) return undefined;
  const [minLon, minLat, maxLon, maxLat] = boundingBox;
  const corners: GeoPoint[] = [
    { lat: maxLat, lon: minLon },
    { lat: minLat, lon: maxLon },
    { lat: maxLat, lon: maxLon },
    { lat: minLat, lon: minLon },
  ];
  let best: { corner: GeoPoint; d: number } | null = null;
  for (const corner of corners) {
    const d = Math.hypot(corner.lat - position.lat, corner.lon - position.lon);
    if (!best || d > best.d) best = { corner, d };
  }
  if (!best || best.d < 0.0005) return undefined; // point-like event: no heading
  const deg = bearingDeg(best.corner, position);
  return Math.round(((deg % 360) + 360) % 360);
}

function mapEvent(e: Record<string, unknown>): GfwVesselEvent | null {
  const position = (e.position ?? {}) as Record<string, number>;
  if (typeof position.lat !== 'number' || typeof position.lon !== 'number') return null;

  // Posisi GFW asli dipertahankan apa adanya — posisi akhir event selalu di laut
  // (grid daratan 0.1° kita terlalu kasar untuk wilayah pantai).
  const lat = Number(position.lat);
  const lon = Number(position.lon);

  const vessel = (e.vessel ?? {}) as Record<string, unknown>;
  const distances = (e.distances ?? {}) as Record<string, number>;
  const fishing = (e.fishing ?? {}) as Record<string, number | null>;

  return {
    type: (String(e.type ?? 'fishing') === 'fishing' || String(e.type ?? '') === 'loitering' ? String(e.type) : 'fishing') as GfwVesselEvent['type'],
    lat,
    lon,
    startTime: String(e.start ?? ''),
    endTime: String(e.end ?? ''),
    vesselId: String(vessel.id ?? ''),
    flag: String(vessel.flag ?? ''),
    vesselName: String(vessel.name ?? ''),
    vesselType: String(vessel.type ?? ''),
    nextPort: vessel.nextPort ? String(vessel.nextPort) : undefined,
    heading: estimateHeading(e.boundingBox as number[], { lat, lon }),
    speedKnots: typeof fishing.averageSpeedKnots === 'number' ? Math.round(fishing.averageSpeedKnots * 10) / 10 : undefined,
    endDistanceFromShoreKm: typeof distances.endDistanceFromShoreKm === 'number' ? Math.round(distances.endDistanceFromShoreKm * 10) / 10 : undefined,
    endDistanceFromPortKm: typeof distances.endDistanceFromPortKm === 'number' ? Math.round(distances.endDistanceFromPortKm * 10) / 10 : undefined,
  };
}

/**
 * Ambil event kapal GFW untuk sebuah bounding box (server-side, dipakai juga
 * oleh prediksi penyebaran limbah): coba API nyata dengan GFW_TOKEN, fallback
 * ke data mock yang realistis.
 */
export async function fetchGfwEvents(params: {
  north: number;
  south: number;
  east: number;
  west: number;
  startDate?: string;
  endDate?: string;
  maxEvents?: number;
}): Promise<GfwData> {
  const { north, south, east, west } = params;
  const maxEvents = params.maxEvents ?? MAX_EVENTS;
  const startDate = params.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const endDate = params.endDate ?? new Date().toISOString().split('T')[0];

  const apiKey = process.env.GFW_TOKEN;

  if (apiKey && Date.now() - lastGfwFailureAt > GFW_CIRCUIT_MS) {
    try {
      // v3 Events API: limit/offset are QUERY params; dates go in the body as startDate/endDate
      const body = {
        datasets: ['public-global-fishing-events:latest'],
        startDate,
        endDate,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, north], [east, north], [east, south], [west, south], [west, north],
          ]],
        },
      };

      const res = await fetch(`https://gateway.api.globalfishingwatch.org/v3/events?limit=${maxEvents}&offset=0`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok || res.status === 201) {
        const raw = await res.json();
        const events: GfwVesselEvent[] = (raw.entries ?? [])
          .map((e: Record<string, unknown>) => mapEvent(e))
          .filter((e: GfwVesselEvent | null): e is GfwVesselEvent => e !== null)
          .slice(0, maxEvents);
        return { source: 'gfw', vesselEvents: events, totalEvents: raw.total ?? events.length };
      }
      console.warn('[GFW API] HTTP', res.status, (await res.text()).slice(0, 300));
    } catch (err) {
      lastGfwFailureAt = Date.now();
      console.warn(
        '[GFW API] gagal — fallback ke data mock untuk sementara:',
        err instanceof Error ? err.name : err
      );
    }
  }

  return getMockGfwData({ north, south, east, west }, startDate, endDate);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const north = parseFloat(searchParams.get('north') ?? '-5.5');
  const south = parseFloat(searchParams.get('south') ?? '-8.0');
  const east = parseFloat(searchParams.get('east') ?? '112.0');
  const west = parseFloat(searchParams.get('west') ?? '108.5');
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;

  const data = await fetchGfwEvents({ north, south, east, west, startDate, endDate });
  return NextResponse.json(data);
}
