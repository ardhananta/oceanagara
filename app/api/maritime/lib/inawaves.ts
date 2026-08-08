/**
 * BMKG Pusmar API23 — INAWAVES helpers
 *
 * Official docs:
 *   https://maritim.bmkg.go.id/pusmar/api23/modelrun                     → latest baseruns (JSON)
 *   https://maritim.bmkg.go.id/pusmar/api23/arr_req/inawaves/<param>/<baserun>/<dtime>
 *     params: wind (U V), dir (U V), hs, phs00, phs01, pdi00, pdi01, ptp00, ptp01, ptp02
 *
 * The array response is a STRINGIFIED JSON that must be decoded twice:
 *   "[{\"data\":[12.69,...],\"header\":{...},\"meta\":{...}},...]"
 *
 * - wind returns 2 objects: Eastward Wind (U, knots) then Northward Wind (V, knots)
 * - hs / phs00 / phs01 / ptp00 / ptp01 return 1 object each; scalar params may
 *   contain `null` values over land (masked), preserved as-is
 * - grid is row-major from NW corner: index = latRow * nx + lonCol
 *   (nx/ny are derived from lo1/la1/lo2/la2 + dx/dy because some params
 *    report a transposed header, e.g. hs reports nx/ny swapped)
 */

export const KNOTS_TO_MS = 0.514444;

export interface InawavesGridInfo {
  nx: number;
  ny: number;
  lo1: number;
  la1: number;
  lo2: number;
  la2: number;
  dx: number;
  dy: number;
}

export interface InawavesWindGrid extends InawavesGridInfo {
  uData: number[]; // eastward wind, m/s
  vData: number[]; // northward wind, m/s
  baserun: string;
}

export interface InawavesHsGrid extends InawavesGridInfo {
  data: number[]; // significant wave height, m
  baserun: string;
}

/** Scalar grid (e.g. phs00/phs01/ptp00/ptp01) — `null` marks land/masked cells */
export interface InawavesScalarGrid extends InawavesGridInfo {
  data: (number | null)[];
  baserun: string;
  param: string;
}

/** Double-decode the stringified JSON returned by BMKG Pusmar API23 */
export function parseBmkgStringJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try {
    const first = JSON.parse(trimmed);
    if (typeof first === 'string') {
      const inner = first.trim();
      if (!inner) return null;
      return JSON.parse(inner);
    }
    return first;
  } catch {
    return null;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-08-07T12:00:00Z" → "202608071200" */
export function isoToBaserun(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`;
}

/**
 * Candidate INAWAVES baseruns, newest first:
 * 1. inawaves (or inaflows) runs listed by the modelrun endpoint
 * 2. today / yesterday / day-before 00:00 UTC (INAWAVES runs daily at 00:00Z)
 *
 * Hasil di-cache 10 menit — endpoint `modelrun` lambat dan dipanggil untuk
 * hampir setiap titik arus yang belum ada di cache.
 */
let baserunCacheValue: string[] | null = null;
let baserunCacheFetchedAt = 0;

export async function getBaserunCandidates(): Promise<string[]> {
  if (baserunCacheValue && Date.now() - baserunCacheFetchedAt < 10 * 60 * 1000) {
    return baserunCacheValue;
  }

  const candidates: string[] = [];

  try {
    const res = await fetch('https://maritim.bmkg.go.id/pusmar/api23/modelrun', {
      headers: { Accept: 'application/json, text/plain' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const parsed = parseBmkgStringJson(await res.text());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        // Only INAWAVES runs are valid for the wave model — the other models
        // (inaflows, w3g_hires) return HTTP 500 from the inawaves endpoints.
        const runs = Array.isArray(obj.inawaves) ? obj.inawaves : [];
        for (const run of runs) {
          const b = isoToBaserun(String(run));
          if (b && !candidates.includes(b)) candidates.push(b);
        }
      }
    }
  } catch {
    // ignore — fall back to calculated runs
  }

  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    const b = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}0000`;
    if (!candidates.includes(b)) candidates.push(b);
  }

  baserunCacheValue = candidates;
  baserunCacheFetchedAt = Date.now();
  return candidates;
}

/** Derive true grid dims from bounds/resolution; null if it doesn't match the payload length */
export function deriveGrid(header: {
  lo1: number;
  la1: number;
  lo2: number;
  la2: number;
  dx: number;
  dy: number;
}, totalLength: number): InawavesGridInfo | null {
  const { lo1, la1, lo2, la2, dx, dy } = header;
  const nx = Math.round((lo2 - lo1) / dx) + 1;
  const ny = Math.round((la1 - la2) / dy) + 1;
  if (nx <= 0 || ny <= 0 || nx * ny !== totalLength) return null;
  return { nx, ny, lo1, la1, lo2, la2, dx, dy };
}

// ─── Grid cache ───────────────────────────────────────────────────────────────
// The raw INAWAVES payloads are ~2-5MB each. All per-region requests share the
// same baserun, so fetch each param once per modelrun and reuse the arrays.

const GRID_CACHE_TTL_MS = 10 * 60 * 1000;
const gridCache = new Map<string, { value: unknown; fetchedAt: number }>();

function gridCacheKey(param: string, baserun: string): string {
  return `${baserun}:${param}`;
}

function cachedFetchInawavesRaw(param: string, baserun: string): Promise<unknown[] | null> {
  const key = gridCacheKey(param, baserun);
  const cached = gridCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < GRID_CACHE_TTL_MS) {
    return Promise.resolve(cached.value as unknown[] | null);
  }
  return fetchInawavesRaw(param, baserun).then((parsed) => {
    // Only cache successful payloads — a failed fetch must not poison the
    // cache (BMKG hiccups are frequent and should be retried next request).
    if (parsed) gridCache.set(key, { value: parsed, fetchedAt: Date.now() });
    return parsed;
  });
}

/** Fetch raw param array for a baserun; null on any failure */
async function fetchInawavesRaw(param: string, baserun: string): Promise<unknown[] | null> {
  try {
    const url = `https://maritim.bmkg.go.id/pusmar/api23/arr_req/inawaves/${param}/${baserun}/${baserun}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const parsed = parseBmkgStringJson(await res.text());
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Fetch full U/V wind grid (knots → m/s) for a baserun */
export async function fetchInawavesWind(baserun: string): Promise<InawavesWindGrid | null> {
  const arr = await cachedFetchInawavesRaw('wind', baserun);
  if (!arr) return null;

  let u: number[] | null = null;
  let v: number[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let header: any = null;

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = item as any;
    if (!Array.isArray(obj.data) || !obj.header) continue;
    const name = String(obj.header.parameterNumberName ?? '').toLowerCase();
    const num = Number(obj.header.parameterNumber);
    if (name.includes('eastward') || num === 2) {
      u = obj.data.map(Number);
      header = header ?? obj.header;
    } else if (name.includes('northward') || num === 3) {
      v = obj.data.map(Number);
      header = header ?? obj.header;
    }
  }

  if (!u || !v || !header || u.length !== v.length) return null;
  const grid = deriveGrid(header, u.length);
  if (!grid) return null;

  return {
    ...grid,
    uData: u.map((k) => k * KNOTS_TO_MS),
    vData: v.map((k) => k * KNOTS_TO_MS),
    baserun,
  };
}

/** Fetch significant wave height grid (m) for a baserun */
export async function fetchInawavesHs(baserun: string): Promise<InawavesHsGrid | null> {
  const arr = await cachedFetchInawavesRaw('hs', baserun);
  if (!arr || !arr[0]) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = arr[0] as any;
  if (!Array.isArray(obj.data) || !obj.header) return null;

  const data = obj.data.map(Number);
  const grid = deriveGrid(obj.header, data.length);
  if (!grid) return null;

  return { ...grid, data, baserun };
}

/**
 * Fetch a single scalar grid (phs00, phs01, ptp00, ptp01, ...) for a baserun.
 * `null` cells (land mask) are preserved.
 */
export async function fetchInawavesScalar(param: string, baserun: string): Promise<InawavesScalarGrid | null> {
  const arr = await cachedFetchInawavesRaw(param, baserun);
  if (!arr || !arr[0]) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = arr[0] as any;
  if (!Array.isArray(obj.data) || !obj.header) return null;

  const data = obj.data.map((v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
  const grid = deriveGrid(obj.header, data.length);
  if (!grid) return null;

  return { ...grid, data, baserun, param };
}

/**
 * Bilinear sample of a row-major (NW origin) INAWAVES grid at lat/lon.
 * Null-safe: if any corner is null (land), falls back to the mean of the
 * nearest non-null neighbours; returns NaN if the cell is fully masked.
 */
export function sampleInawavesGrid(data: (number | null)[], lat: number, lon: number, grid: InawavesGridInfo): number {
  const { nx, ny, lo1, la1, dx, dy } = grid;
  const fx = (lon - lo1) / dx;
  const fy = (la1 - lat) / dy;

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const x0 = clamp(Math.floor(fx), 0, nx - 2);
  const y0 = clamp(Math.floor(fy), 0, ny - 2);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = clamp(fx - x0, 0, 1);
  const ty = clamp(fy - y0, 0, 1);

  const idx = (row: number, col: number) => row * nx + col;
  const a = data[idx(y0, x0)];
  const b = data[idx(y0, x1)];
  const c = data[idx(y1, x0)];
  const d = data[idx(y1, x1)];

  if (a !== null && b !== null && c !== null && d !== null) {
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  // Fallback: mean of nearest non-null neighbours (expanding ring)
  for (let r = 1; r <= 4; r++) {
    let sum = 0;
    let count = 0;
    for (let dRow = -r; dRow <= r; dRow++) {
      for (let dCol = -r; dCol <= r; dCol++) {
        const row = y0 + dRow;
        const col = x0 + dCol;
        if (row < 0 || row >= ny || col < 0 || col >= nx) continue;
        const v = data[row * nx + col];
        if (v !== null) {
          sum += v;
          count += 1;
        }
      }
    }
    if (count > 0) return sum / count;
  }

  return NaN;
}

/**
 * Mean wave period (s) from wind sea + primary swell components, weighted by
 * their heights: Tm = (Hs00·T00 + Hs01·T01) / (Hs00 + Hs01).
 * Falls back to whichever component is valid; NaN when nothing is valid.
 */
export function meanWavePeriod(
  hs00: number,
  hs01: number,
  tp00: number,
  tp01: number
): number {
  const valid00 = Number.isFinite(hs00) && Number.isFinite(tp00) && hs00 > 0 && tp00 > 0;
  const valid01 = Number.isFinite(hs01) && Number.isFinite(tp01) && hs01 > 0 && tp01 > 0;

  if (!valid00 && !valid01) {
    if (Number.isFinite(tp00) && tp00 > 0) return tp00;
    if (Number.isFinite(tp01) && tp01 > 0) return tp01;
    return NaN;
  }
  if (!valid01) return tp00;
  if (!valid00) return tp01;

  const hTotal = hs00 + hs01;
  if (hTotal <= 0) return tp00;
  return (hs00 * tp00 + hs01 * tp01) / hTotal;
}
