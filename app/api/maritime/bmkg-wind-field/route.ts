/**
 * BMKG Wind Field Grid API
 *
 * Fetches the FULL INAWAVES wind grid (U/V, knots → m/s) from the official
 * BMKG Pusmar API23 `arr_req/inawaves/wind` endpoint, downsamples it to a
 * manageable resolution, and returns structured U/V arrays for canvas
 * velocity rendering.
 *
 * Response is double-encoded stringified JSON: 2 objects with `data`
 * (Eastward Wind, then Northward Wind), `header` (grid definition) and `meta`.
 */

import { NextResponse } from 'next/server';
import {
  fetchInawavesWind,
  getBaserunCandidates,
  sampleInawavesGrid,
} from '../lib/inawaves';
import type { InawavesGridInfo, InawavesWindGrid } from '../lib/inawaves';

// Downsampled output grid for velocity rendering (lower resolution)
const OUT_GRID: InawavesGridInfo & { nx: 24; ny: 15 } = {
  lo1: 95.0,
  la1: 10.0,
  lo2: 141.0,
  la2: -11.0,
  nx: 24, // Downsampled longitude cols
  ny: 15, // Downsampled latitude rows
  dx: (141.0 - 95.0) / (24 - 1),
  dy: (10.0 - -11.0) / (15 - 1),
};

// In-memory cache: the raw INAWAVES payload is ~4.7MB, don't re-fetch it
// from BMKG on every client request (clients auto-refresh every 1 min).
// TTL kept below the client refresh cadence so each minute poll gets fresh data.
const CACHE_TTL_MS = 45 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: { payload: any; fetchedAt: number } | null = null;

/** Downsample the real INAWAVES grid (bilinear) onto OUT_GRID */
function buildResponseFromBmkg(wind: InawavesWindGrid) {
  const dLon = (OUT_GRID.lo2 - OUT_GRID.lo1) / (OUT_GRID.nx - 1);
  const dLat = (OUT_GRID.la1 - OUT_GRID.la2) / (OUT_GRID.ny - 1);

  const uOut: number[] = [];
  const vOut: number[] = [];

  for (let iy = 0; iy < OUT_GRID.ny; iy++) {
    const lat = OUT_GRID.la1 - iy * dLat; // North to South
    for (let ix = 0; ix < OUT_GRID.nx; ix++) {
      const lon = OUT_GRID.lo1 + ix * dLon;

      const u = sampleInawavesGrid(wind.uData, lat, lon, wind);
      const v = sampleInawavesGrid(wind.vData, lat, lon, wind);

      uOut.push(parseFloat(u.toFixed(3)));
      vOut.push(parseFloat(v.toFixed(3)));
    }
  }

  return {
    source: 'bmkg-inawaves' as const,
    baserun: wind.baserun,
    grid: {
      lo1: OUT_GRID.lo1,
      la1: OUT_GRID.la1,
      lo2: OUT_GRID.lo2,
      la2: OUT_GRID.la2,
      nx: OUT_GRID.nx,
      ny: OUT_GRID.ny,
      dx: dLon,
      dy: dLat,
    },
    uData: uOut,
    vData: vOut,
  };
}

export async function GET() {
  // Serve from cache when fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  let payload: ReturnType<typeof buildResponseFromBmkg> | null = null;

  try {
    // Probe candidate baseruns until one yields a valid wind grid
    const candidates = await getBaserunCandidates();
    for (const baserun of candidates) {
      const wind = await fetchInawavesWind(baserun);
      if (wind) {
        payload = buildResponseFromBmkg(wind);
        break;
      }
    }
  } catch (err) {
    console.error('[BMKG Wind Field Error]:', err);
  }

  if (!payload) {
    // No real data: never fabricate a synthetic field — report failure so the
    // client can show a loading/error state instead of fake wind animation.
    return NextResponse.json(
      { error: 'Grid angin INAWAVES BMKG tidak tersedia saat ini.' },
      { status: 503 }
    );
  }

  cache = { payload, fetchedAt: Date.now() };

  return NextResponse.json(payload);
}
