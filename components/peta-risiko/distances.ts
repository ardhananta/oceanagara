import {
  LAND_COLS,
  LAND_GRID_B64,
  LAND_MAX_LAT,
  LAND_MIN_LON,
  LAND_ROWS,
} from './landGrid';
import { INDONESIAN_PORTS, type Port } from './ports';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface NearestCoast {
  point: GeoPoint;
  distanceKm: number;
}

export interface NearestPort {
  port: Port;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in km (Haversine). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Compass bearing (degrees, 0=N) from A to B. */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Midpoint between two coordinates (antimeridian-safe). */
export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  const lat = (a.lat + b.lat) / 2;
  const dLon = ((b.lon - a.lon + 540) % 360) - 180;
  const lon = (((a.lon + dLon / 2 + 540) % 360) + 540) % 360 - 180;
  return { lat, lon };
}

/** Cardinal abbreviation for a bearing. */
export function cardinalFromBearing(deg: number): string {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round(((deg % 360) + 360) / 45) % 8];
}

// ─── Land grid helpers (0.1° bitmap from Natural Earth) ──────────────────────

let landCells: Uint8Array | null = null;

function getLandCells(): Uint8Array {
  if (landCells) return landCells;
  const binary = typeof atob !== 'undefined' ? atob(LAND_GRID_B64) : Buffer.from(LAND_GRID_B64, 'base64').toString('binary');
  landCells = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) landCells[i] = binary.charCodeAt(i);
  return landCells;
}

/** Cell index for a coordinate; -1 when outside the grid. */
function cellIndex(lat: number, lon: number): number {
  const col = Math.floor((lon - LAND_MIN_LON) / 0.1);
  const row = Math.floor((LAND_MAX_LAT - lat) / 0.1);
  if (row < 0 || row >= LAND_ROWS || col < 0 || col >= LAND_COLS) return -1;
  return row * LAND_COLS + col;
}

function cellIsLand(lat: number, lon: number): boolean {
  const cells = getLandCells();
  const idx = cellIndex(lat, lon);
  if (idx < 0) return false;
  return (cells[idx >> 3] & (1 << (7 - (idx & 7)))) !== 0;
}

/** True when the coordinate falls on a land cell of the 0.1° grid. */
export function isLandPoint(lat: number, lon: number): boolean {
  return cellIsLand(lat, lon);
}

/** Nearest water (non-land) cell center within a ring radius; null if none. */
export function nearestWaterPoint(lat: number, lon: number, maxCells = 6): GeoPoint | null {
  if (!cellIsLand(lat, lon)) return { lat, lon };
  const row0 = Math.floor((LAND_MAX_LAT - lat) / 0.1);
  const col0 = Math.floor((lon - LAND_MIN_LON) / 0.1);
  for (let ring = 1; ring <= maxCells; ring++) {
    for (let r = -ring; r <= ring; r++) {
      const row = row0 + r;
      if (row < 0 || row >= LAND_ROWS) continue;
      const colRange = ring - Math.abs(r);
      for (const c of [col0 - colRange, col0 + colRange]) {
        if (c < 0 || c >= LAND_COLS) continue;
        const cellLat = LAND_MAX_LAT - (row + 0.5) * 0.1;
        const cellLon = LAND_MIN_LON + (c + 0.5) * 0.1;
        if (!cellIsLand(cellLat, cellLon)) {
          return { lat: cellLat, lon: cellLon };
        }
      }
    }
  }
  return null;
}

/**
 * Nearest land (coast) point + distance from any ocean location.
 * Expands outward ring-by-ring on the 0.1° grid until a land cell is found.
 * Returns null when the point is outside the grid or no land within maxKm.
 */
export function nearestCoast(lat: number, lon: number, maxKm = 400): NearestCoast | null {
  const startIdx = cellIndex(lat, lon);
  if (startIdx < 0) return null;
  if (cellIsLand(lat, lon)) return { point: { lat, lon }, distanceKm: 0 };

  const maxRing = Math.ceil(maxKm / (0.1 * 111.32));
  const row0 = Math.floor((LAND_MAX_LAT - lat) / 0.1);
  const col0 = Math.floor((lon - LAND_MIN_LON) / 0.1);

  for (let ring = 1; ring <= maxRing; ring++) {
    for (let r = -ring; r <= ring; r++) {
      const row = row0 + r;
      if (row < 0 || row >= LAND_ROWS) continue;
      const colRange = ring - Math.abs(r);
      for (const c of [col0 - colRange, col0 + colRange]) {
        if (c < 0 || c >= LAND_COLS) continue;
        const cellLat = LAND_MAX_LAT - (row + 0.5) * 0.1;
        const cellLon = LAND_MIN_LON + (c + 0.5) * 0.1;
        if (cellIsLand(cellLat, cellLon)) {
          const point: GeoPoint = { lat: cellLat, lon: cellLon };
          return { point, distanceKm: haversineKm({ lat, lon }, point) };
        }
      }
    }
  }
  return null;
}

/** Nearest Indonesian port from a location. */
export function nearestPort(lat: number, lon: number): NearestPort | null {
  let best: NearestPort | null = null;
  for (const port of INDONESIAN_PORTS) {
    const d = haversineKm({ lat, lon }, { lat: port.lat, lon: port.lon });
    if (!best || d < best.distanceKm) best = { port, distanceKm: d };
  }
  return best;
}

/** Format km with smart precision: <10 km → 1 decimal, else 0. */
export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('id-ID');
}
