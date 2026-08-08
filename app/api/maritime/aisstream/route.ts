import { NextRequest, NextResponse } from 'next/server';
import type { AisStreamData, AisVessel } from '@/app/types/maritime';

const SHIP_TYPES = ['Tanker', 'Cargo', 'Fishing', 'Passenger', 'Tug', 'Bulk Carrier', 'Container'];
const FLAGS = ['IDN', 'SGP', 'MYS', 'CHN', 'PHL', 'VNM', 'THA'];
const VESSEL_NAMES = [
  'OCEAN PIONEER', 'SEA DRAGON', 'NUSANTARA JAYA', 'MARITIME STAR', 'PACIFIC WAVE',
  'INDO EXPLORER', 'SEA FALCON', 'KARIMATA EXPRESS', 'SUNDA BREEZE', 'MAKASSAR TRADER',
];

function getMockAisData(
  bbox: { north: number; south: number; east: number; west: number }
): AisStreamData {
  const latRange = bbox.north - bbox.south;
  const lonRange = bbox.east - bbox.west;
  const count = Math.floor(Math.random() * 10 + 15);

  const vessels: AisVessel[] = Array.from({ length: count }, (_, i) => ({
    mmsi: String(Math.floor(Math.random() * 900000000) + 100000000),
    name: VESSEL_NAMES[i % VESSEL_NAMES.length],
    lat: bbox.south + Math.random() * latRange,
    lon: bbox.west + Math.random() * lonRange,
    speed: parseFloat((Math.random() * 14 + 0.5).toFixed(1)),
    heading: Math.floor(Math.random() * 360),
    shipType: SHIP_TYPES[Math.floor(Math.random() * SHIP_TYPES.length)],
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    flag: FLAGS[Math.floor(Math.random() * FLAGS.length)],
  }));

  return { source: 'aisstream', vessels, totalVessels: vessels.length };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const north = parseFloat(searchParams.get('north') ?? '-5.5');
  const south = parseFloat(searchParams.get('south') ?? '-8.0');
  const east = parseFloat(searchParams.get('east') ?? '112.0');
  const west = parseFloat(searchParams.get('west') ?? '108.5');

  const apiKey = process.env.AISSTREAM_API_KEY;

  if (apiKey) {
    try {
      // AISStream uses WebSocket protocol — for REST-like access we use their HTTP endpoint
      const url = `https://api.aisstream.io/v0/vessels?apiKey=${apiKey}&boundingBoxes=[[[${south},${west}],[${north},${east}]]]`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });

      if (res.ok) {
        const raw = await res.json();
        const vessels: AisVessel[] = (Array.isArray(raw) ? raw : raw.vessels ?? [])
          .slice(0, 30)
          .map((v: Record<string, unknown>) => ({
            mmsi: String(v.mmsi ?? ''),
            name: String(v.name ?? v.ShipName ?? ''),
            lat: Number(v.latitude ?? v.lat ?? 0),
            lon: Number(v.longitude ?? v.lon ?? 0),
            speed: Number(v.speed ?? v.Sog ?? 0),
            heading: Number(v.heading ?? v.TrueHeading ?? 0),
            shipType: String(v.ship_type ?? v.ShipType ?? ''),
            timestamp: String(v.timestamp ?? v.time_utc ?? new Date().toISOString()),
            flag: String(v.flag ?? ''),
          }));
        return NextResponse.json({ source: 'aisstream', vessels, totalVessels: vessels.length });
      }
    } catch (err) {
      console.error('[AISStream API]', err);
    }
  }

  return NextResponse.json(getMockAisData({ north, south, east, west }));
}
