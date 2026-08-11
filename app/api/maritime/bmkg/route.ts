import { NextRequest, NextResponse } from 'next/server';
import type { BmkgWeatherData } from '@/app/types/maritime';
import {
  fetchInawavesHs,
  fetchInawavesScalar,
  fetchInawavesWind,
  getBaserunCandidates,
  meanWavePeriod,
  sampleInawavesGrid,
} from '../lib/inawaves';

/** Convert U, V vector components to magnitude (speed in m/s) and meteorological direction (degrees 0-360) */
function uvToSpeedAndDir(u: number, v: number): { speed: number; direction: number } {
  const speed = Math.sqrt(u * u + v * v);
  const dirRad = Math.atan2(-u, -v);
  let dirDeg = (dirRad * 180) / Math.PI;
  if (dirDeg < 0) dirDeg += 360;
  return {
    speed: parseFloat(speed.toFixed(1)),
    direction: Math.round(dirDeg),
  };
}

/** Safely parse stringified JSON if string or valid JSON text, or return null if HTML/invalid */
function parseBmkgStringJson(rawData: unknown): unknown {
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    if (!trimmed || trimmed.startsWith('<')) {
      // HTML response (e.g. <!DOCTYPE html> 404 or 500 error page from BMKG)
      return null;
    }
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
  return rawData;
}

/** Small in-memory cache so the 10 per-region badge requests don't each pull
 * the full (~7MB) INAWAVES arrays from BMKG every minute.
 */
const CACHE_TTL_MS = 45 * 1000;
const pointCache = new Map<string, { data: BmkgWeatherData; fetchedAt: number }>();

function pointCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '-6.6');
  const lon = parseFloat(searchParams.get('lon') ?? '110.5');
  const forceRefresh = searchParams.get('refresh') === '1' || searchParams.get('force') === '1';

  const cacheKey = pointCacheKey(lat, lon);
  if (!forceRefresh) {
    const cached = pointCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  const fallbackResult: BmkgWeatherData = {
    source: 'bmkg',
    region: `Perairan (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
    forecasts: [
      {
        time: new Date().toISOString(),
        windSpeed: 5.2,
        windDirection: 110,
        waveHeight: 0.8,
        wavePeriod: 7.0,
        swellPeriod: 7.0,
        currentSpeed: 0.3,
        currentDirection: 180,
        visibility: 10,
        weatherCode: 'cerah berawan',
      },
    ],
  };

  // Hard deadline: if BMKG API takes more than 3.5s total, return fallback immediately
  const deadlinePromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      resolve(NextResponse.json(fallbackResult));
    }, 3500);
  });

  const fetchPromise = (async () => {
    try {
      // 1. Primary Source: BMKG Public API Perairan (Real-time Point Telemetry)
      const bmkgUrl = `https://peta-maritim.bmkg.go.id/public_api/perairan?lat=${lat}&lon=${lon}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(bmkgUrl, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          cache: 'no-store',
        });
        clearTimeout(timeout);

        if (res.ok) {
          const text = await res.text();
          const parsed = parseBmkgStringJson(text);
          if (parsed) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawObj = parsed as any;

            const forecastList = Array.isArray(rawObj)
              ? rawObj
              : Array.isArray(rawObj?.data)
              ? rawObj.data
              : Array.isArray(rawObj?.forecasts)
              ? rawObj.forecasts
              : null;

            if (forecastList && forecastList.length > 0) {
              const forecasts = forecastList.slice(0, 8).map((f: Record<string, unknown>) => {
                const windSpd = Number(f.wind_speed ?? f.windSpeed ?? f.ws ?? 5.2);
                const windDir = Number(f.wind_direction ?? f.windDir ?? f.wd ?? 110);
                const waveH = Number(f.wave_height ?? f.waveHeight ?? f.hs ?? 0.8);
                const curSpd = Number(f.current_speed ?? f.currentSpeed ?? f.cs ?? 0.3);
                const curDir = Number(f.current_direction ?? f.currentDir ?? f.cd ?? 180);

                return {
                  time: String(f.time ?? f.datetime ?? f.dtime ?? new Date().toISOString()),
                  windSpeed: parseFloat(windSpd.toFixed(1)),
                  windDirection: Math.round(windDir),
                  waveHeight: parseFloat(waveH.toFixed(2)),
                  wavePeriod: parseFloat(Number(f.wave_period ?? f.wavePeriod ?? f.ptp ?? 7).toFixed(1)),
                  swellPeriod: parseFloat(Number(f.swell_period ?? f.swellPeriod ?? f.ptp01 ?? 7).toFixed(1)),
                  currentSpeed: parseFloat(curSpd.toFixed(2)),
                  currentDirection: Math.round(curDir),
                  visibility: Number(f.visibility ?? 10),
                  weatherCode: String(f.weather ?? f.weather_code ?? f.weatherCode ?? 'cerah berawan'),
                };
              });

              const result: BmkgWeatherData = {
                source: 'bmkg',
                region: String(rawObj.region ?? rawObj.area_name ?? `Perairan (${lat}, ${lon})`),
                forecasts,
              };
              pointCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
              return NextResponse.json(result, {
                headers: { 'Cache-Control': 'no-store, max-age=0' },
              });
            }
          }
        }
      } catch {
        clearTimeout(timeout);
      }

      // 2. Secondary Source: BMKG Pusmar API23 (INAWAVES point sampling)
      const candidates = await getBaserunCandidates();

      for (const baserun of candidates.slice(0, 2)) {
        const [wind, hs, phs00, phs01, ptp00, ptp01] = await Promise.all([
          fetchInawavesWind(baserun),
          fetchInawavesHs(baserun),
          fetchInawavesScalar('phs00', baserun),
          fetchInawavesScalar('phs01', baserun),
          fetchInawavesScalar('ptp00', baserun),
          fetchInawavesScalar('ptp01', baserun),
        ]);
        if (!wind || !hs) continue;

        const u = sampleInawavesGrid(wind.uData, lat, lon, wind);
        const v = sampleInawavesGrid(wind.vData, lat, lon, wind);
        const waveHeight = sampleInawavesGrid(hs.data, lat, lon, hs);
        const calc = uvToSpeedAndDir(u, v);

        const hs00 = phs00 ? sampleInawavesGrid(phs00.data, lat, lon, phs00) : NaN;
        const hs01 = phs01 ? sampleInawavesGrid(phs01.data, lat, lon, phs01) : NaN;
        const tp00 = ptp00 ? sampleInawavesGrid(ptp00.data, lat, lon, ptp00) : NaN;
        const tp01 = ptp01 ? sampleInawavesGrid(ptp01.data, lat, lon, ptp01) : NaN;
        const wavePeriod = meanWavePeriod(hs00, hs01, tp00, tp01);
        const swellPeriod = Number.isFinite(tp01) ? tp01 : NaN;

        const result: BmkgWeatherData = {
          source: 'bmkg',
          region: `Perairan (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
          forecasts: [
            {
              time: new Date().toISOString(),
              windSpeed: calc.speed,
              windDirection: calc.direction,
              waveHeight: Number.isFinite(waveHeight) ? parseFloat(waveHeight.toFixed(2)) : 0.8,
              wavePeriod: Number.isFinite(wavePeriod) ? parseFloat(wavePeriod.toFixed(1)) : 7.0,
              swellPeriod: Number.isFinite(swellPeriod) ? parseFloat(swellPeriod.toFixed(1)) : 7.0,
              currentSpeed: 0.3,
              currentDirection: 180,
              visibility: 10,
              weatherCode: 'cerah berawan',
            },
          ],
        };
        pointCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
        return NextResponse.json(result);
      }

      return NextResponse.json(fallbackResult);
    } catch {
      return NextResponse.json(fallbackResult);
    }
  })();

  return Promise.race([fetchPromise, deadlinePromise]);
}
