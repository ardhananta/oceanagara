import { NextRequest, NextResponse } from 'next/server';
import type { GfwData, GfwVesselEvent } from '@/app/types/maritime';

function getMockGfwData(bbox: { north: number; south: number; east: number; west: number }): GfwData {
  const latRange = bbox.north - bbox.south;
  const lonRange = bbox.east - bbox.west;
  const events: GfwVesselEvent[] = Array.from({ length: 12 }, (_, i) => {
    const types: GfwVesselEvent['type'][] = ['fishing', 'loitering', 'port_visit'];
    const flags = ['IDN', 'CHN', 'PHL', 'MYS', 'SGP', 'VNM'];
    const now = new Date();
    const start = new Date(now.getTime() - Math.random() * 48 * 3600000);
    const end = new Date(start.getTime() + Math.random() * 6 * 3600000);
    return {
      type: types[i % 3],
      lat: bbox.south + Math.random() * latRange,
      lon: bbox.west + Math.random() * lonRange,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      vesselId: `VES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      flag: flags[Math.floor(Math.random() * flags.length)],
    };
  });
  return { source: 'gfw', vesselEvents: events, totalEvents: events.length };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const north = parseFloat(searchParams.get('north') ?? '-5.5');
  const south = parseFloat(searchParams.get('south') ?? '-8.0');
  const east = parseFloat(searchParams.get('east') ?? '112.0');
  const west = parseFloat(searchParams.get('west') ?? '108.5');
  const startDate = searchParams.get('startDate') ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0];

  const apiKey = process.env.GFW_API_KEY;

  if (apiKey) {
    try {
      const body = {
        datasets: ['public-global-fishing-events:latest'],
        filters: [{ field: 'flag', values: [] }],
        'date-range': `${startDate},${endDate}`,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, north], [east, north], [east, south], [west, south], [west, north],
          ]],
        },
      };

      const res = await fetch('https://gateway.api.globalfishingwatch.org/v3/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const raw = await res.json();
        const events: GfwVesselEvent[] = (raw.entries ?? []).slice(0, 20).map((e: Record<string, unknown>) => ({
          type: (String(e.type ?? 'fishing')) as GfwVesselEvent['type'],
          lat: Number((e.position as Record<string, number>)?.lat ?? 0),
          lon: Number((e.position as Record<string, number>)?.lon ?? 0),
          startTime: String(e.start ?? ''),
          endTime: String(e.end ?? ''),
          vesselId: String((e.vessel as Record<string, string>)?.id ?? ''),
          flag: String((e.vessel as Record<string, string>)?.flag ?? ''),
        }));
        return NextResponse.json({ source: 'gfw', vesselEvents: events, totalEvents: raw.total ?? events.length });
      }
    } catch (err) {
      console.error('[GFW API]', err);
    }
  }

  return NextResponse.json(getMockGfwData({ north, south, east, west }));
}
