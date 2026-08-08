import { CARDINALS, LONG_PERIOD_SWELL_S, SWELL_DANGER_MIN_HEIGHT_M, WAVE_HEIGHT_ALERT_M, WAVE_HEIGHT_MODERATE_M, WIND_STORM_KT, WIND_STRONG_KT, WIND_MODERATE_KT } from './constants';
import type { BmkgWeatherData, TrendPeriodPoint, TrendPoint, WindFieldGrid } from './types';

/** Convert compass degrees to cardinal direction info */
export function getCardinalInfo(deg: number) {
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return CARDINALS[index];
}

/** Wave danger classification per BMKG maritime scale, escalated by wave mean period */
export function waveDangerInfo(waveHeight: number, wavePeriod = 7) {
  let level: 0 | 1 | 2 | 3;
  if (waveHeight >= 4.0) level = 3;
  else if (waveHeight >= WAVE_HEIGHT_ALERT_M) level = 2;
  else if (waveHeight >= WAVE_HEIGHT_MODERATE_M) level = 1;
  else level = 0;

  // Long-period swell (≥12s) on top of at least moderate waves → escalate one level
  if (level >= 1 && level < 3 && wavePeriod >= LONG_PERIOD_SWELL_S) level += 1;

  switch (level) {
    case 3: return { label: 'Sangat Bahaya', color: '#ef4444', level };
    case 2: return { label: 'Bahaya', color: '#f97316', level };
    case 1: return { label: 'Waspada', color: '#f59e0b', level };
    default: return { label: 'Aman', color: '#10b981', level: 0 };
  }
}

/** Whether a long-period swell condition is active (drives the alert strip) */
export function isLongPeriodSwell(waveHeight: number, wavePeriod = 7): boolean {
  return waveHeight >= SWELL_DANGER_MIN_HEIGHT_M && wavePeriod >= LONG_PERIOD_SWELL_S;
}

/** Wave-height stroke color matching BMKG web scale */
export function waveStrokeColor(waveHeight: number): string {
  if (waveHeight >= 4.0) return '#ef4444';
  if (waveHeight >= WAVE_HEIGHT_ALERT_M) return '#f97316';
  if (waveHeight >= WAVE_HEIGHT_MODERATE_M) return '#f59e0b';
  return '#10b981';
}

/** Wind speed stroke color (knots) */
export function windStrokeColor(knots: number): string {
  if (knots >= WIND_STORM_KT) return '#ef4444';
  if (knots >= WIND_STRONG_KT) return '#f59e0b';
  if (knots >= WIND_MODERATE_KT) return '#10b981';
  return '#0284c7';
}

/** Calculate dynamic radius based on base radius + wave height + wind speed + wave period from BMKG */
export function calcDynamicRadius(baseRadiusKm: number, waveHeight: number, windSpeed: number, wavePeriod = 7): number {
  const waveExpansion = waveHeight * 18;
  const windExpansion = windSpeed * 2.5;
  // Long-period waves travel faster and carry energy further
  const periodExpansion = wavePeriod * 1.5;
  return Math.round(baseRadiusKm + waveExpansion + windExpansion + periodExpansion);
}

/** Convert m/s to Knots */
export function msToKnots(ms: number): number {
  return parseFloat((ms * 1.94384).toFixed(1));
}

/** Format BMKG baserun YYYYMMDDHHMM → "DD/MM/YYYY HH:MM UTC" */
export function formatBaserun(baserun: string): string {
  if (!/^\d{12}$/.test(baserun)) return baserun;
  const [y, mo, d, h, mi] = [
    baserun.slice(0, 4),
    baserun.slice(4, 6),
    baserun.slice(6, 8),
    baserun.slice(8, 10),
    baserun.slice(10, 12),
  ];
  return `${d}/${mo}/${y} ${h}:${mi} UTC`;
}

/** Format forecast time, fall back to raw string */
export function formatForecastTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Bilinear interpolation from the BMKG INAWAVES wind grid.
 * Returns U (eastward m/s) and V (northward m/s) at any lat/lon.
 */
export function sampleWindGrid(lat: number, lon: number, grid: WindFieldGrid) {
  const { lo1, la1, nx, ny, dx, dy, uData, vData } = grid;

  // Fractional grid coordinates
  const fx = (lon - lo1) / dx;
  const fy = (la1 - lat) / dy; // grid is N→S so la1 is top

  // Clamp to grid bounds
  const x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  // Bilinear weights
  const tx = fx - x0; // [0, 1]
  const ty = fy - y0;

  const idx = (row: number, col: number) => row * nx + col;

  const uVal =
    uData[idx(y0, x0)] * (1 - tx) * (1 - ty) +
    uData[idx(y0, x1)] * tx * (1 - ty) +
    uData[idx(y1, x0)] * (1 - tx) * ty +
    uData[idx(y1, x1)] * tx * ty;

  const vVal =
    vData[idx(y0, x0)] * (1 - tx) * (1 - ty) +
    vData[idx(y0, x1)] * tx * (1 - ty) +
    vData[idx(y1, x0)] * (1 - tx) * ty +
    vData[idx(y1, x1)] * tx * ty;

  const speedMs = Math.sqrt(uVal * uVal + vVal * vVal);
  const speedKnots = msToKnots(speedMs);
  return { u: uVal, v: vVal, speedMs, speedKnots };
}

/** Normalized X/Y series for the wave-height line on the mini trend chart */
export function buildTrendPoints(forecasts: BmkgWeatherData['forecasts']): TrendPoint[] {
  return forecasts.map((f, i) => {
    const maxH = Math.max(...forecasts.map((x) => x.waveHeight), 1);
    const x = (i / Math.max(forecasts.length - 1, 1)) * 100;
    const y = 32 - (f.waveHeight / maxH) * 26;
    return { x, y, value: f.waveHeight };
  });
}

/** Normalized X/Y series for the mean-period line (2–20s mapped to chart height) */
export function buildTrendPeriodPoints(forecasts: BmkgWeatherData['forecasts']): TrendPeriodPoint[] {
  return forecasts.map((f, i) => {
    const x = (i / Math.max(forecasts.length - 1, 1)) * 100;
    const p = Math.min(Math.max(f.wavePeriod ?? 7, 2), 20);
    const y = 40 - ((p - 2) / 18) * 34;
    return { x, y, long: (f.wavePeriod ?? 7) >= LONG_PERIOD_SWELL_S };
  });
}
