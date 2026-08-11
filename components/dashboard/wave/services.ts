import type { BmkgWeatherData } from '@/app/types/maritime';
import { INDONESIA_MARINE_REGIONS } from './constants';
import type { WaveRegionPoint, WindFieldGrid, WindFieldMeta } from './types';

export interface WindFieldResult {
  grid: WindFieldGrid | null;
  meta: WindFieldMeta | null;
}

/** Fetch the BMKG INAWAVES wind U/V grid for the whole map extent */
export async function fetchWindField(force = false): Promise<WindFieldResult> {
  const query = force ? `?refresh=1&t=${Date.now()}` : '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/maritime/bmkg-wind-field${query}`, {
        cache: force ? 'no-store' : 'default',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.uData && json?.vData && json?.grid) {
          const grid: WindFieldGrid = { ...json.grid, uData: json.uData, vData: json.vData };
          const meta: WindFieldMeta = {
            source: json.source === 'bmkg-inawaves' ? 'bmkg-inawaves' : 'unknown',
            baserun: json.baserun ?? '',
          };
          return { grid, meta };
        }
      }
    } catch {
      // retry loop attempt
    }
  }
  return { grid: null, meta: null };
}

/** Fetch BMKG telemetry for every region; returns updated points + whether all requests failed */
export async function fetchRegionWaveData(force = false): Promise<{ points: WaveRegionPoint[]; allFailed: boolean }> {
  const querySuffix = force ? `&refresh=1&t=${Date.now()}` : '';

  const fetchSingleRegion = async (reg: (typeof INDONESIA_MARINE_REGIONS)[number]) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/maritime/bmkg?lat=${reg.lat}&lon=${reg.lon}${querySuffix}`, {
          cache: force ? 'no-store' : 'default',
        });
        if (res.ok) {
          const data: BmkgWeatherData = await res.json();
          if (data?.forecasts?.length) return { ...reg, data, loading: false, failed: false };
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('fetch failed');
  };

  const executeBatch = async () => {
    const results = await Promise.allSettled(
      INDONESIA_MARINE_REGIONS.map((reg) => fetchSingleRegion(reg))
    );

    const points = results.map((result, i) => {
      const reg = INDONESIA_MARINE_REGIONS[i];
      return result.status === 'fulfilled' ? result.value : { ...reg, loading: false, failed: true };
    });

    const allFailed = results.filter((r) => r.status === 'rejected').length === INDONESIA_MARINE_REGIONS.length;
    return { points, allFailed };
  };

  let firstPass = await executeBatch();

  // If all failed on first pass, attempt one quick batch retry after 300ms
  if (firstPass.allFailed) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    firstPass = await executeBatch();
  }

  return firstPass;
}
