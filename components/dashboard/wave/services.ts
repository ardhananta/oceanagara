import type { BmkgWeatherData } from '@/app/types/maritime';
import { INDONESIA_MARINE_REGIONS } from './constants';
import type { WaveRegionPoint, WindFieldGrid, WindFieldMeta } from './types';

export interface WindFieldResult {
  grid: WindFieldGrid | null;
  meta: WindFieldMeta | null;
}

/** Fetch the BMKG INAWAVES wind U/V grid for the whole map extent */
export async function fetchWindField(): Promise<WindFieldResult> {
  try {
    const res = await fetch('/api/maritime/bmkg-wind-field');
    const json = await res.json();
    if (json?.uData && json?.vData && json?.grid) {
      const grid: WindFieldGrid = { ...json.grid, uData: json.uData, vData: json.vData };
      const meta: WindFieldMeta = {
        source: json.source === 'bmkg-inawaves' ? 'bmkg-inawaves' : 'unknown',
        baserun: json.baserun ?? '',
      };
      return { grid, meta };
    }
  } catch {
    // fall through → null grid (animation falls back to IDW from region points)
  }
  return { grid: null, meta: null };
}

/** Fetch BMKG telemetry for every region; returns updated points + whether all requests failed */
export async function fetchRegionWaveData(): Promise<{ points: WaveRegionPoint[]; allFailed: boolean }> {
  const results = await Promise.allSettled(
    INDONESIA_MARINE_REGIONS.map(async (reg) => {
      try {
        const res = await fetch(`/api/maritime/bmkg?lat=${reg.lat}&lon=${reg.lon}`);
        const data: BmkgWeatherData = await res.json();
        if (data?.forecasts?.length) return { ...reg, data, loading: false };
        throw new Error('empty forecast');
      } catch {
        throw new Error('fetch failed');
      }
    })
  );

  const points = results.map((result, i) => {
    const reg = INDONESIA_MARINE_REGIONS[i];
    return result.status === 'fulfilled' ? result.value : { ...reg, loading: false, failed: true };
  });

  const allFailed = results.filter((r) => r.status === 'rejected').length === INDONESIA_MARINE_REGIONS.length;
  return { points, allFailed };
}
