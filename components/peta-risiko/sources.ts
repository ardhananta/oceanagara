import type { GfwData, RiskPoint, RiskSource } from '@/app/types/maritime';
import { bearingDeg, cardinalFromBearing, haversineKm, nearestCoast, nearestPort } from './distances';
import { POLLUTION_SOURCES } from './pollutionSources';
import { INDONESIAN_PORTS } from './ports';

const SOURCE_RADIUS_KM = 80;
const VESSEL_RADIUS_KM = 40;
const PORT_RADIUS_KM = 200;

/** A pollution source near a coordinate, with distance + direction. */
export interface NearbySource extends RiskSource {
  lat: number;
  lon: number;
}

/** Summarized GFW vessel activity around a coordinate. */
export interface VesselActivity {
  count: number;
  fishing: number;
  loitering: number;
  portVisits: number;
  /** Nama-nama kapal di area (maks 3) */
  vesselNames?: string[];
}

export function nearbyPollutionSources(lat: number, lon: number, maxKm = SOURCE_RADIUS_KM): NearbySource[] {
  return POLLUTION_SOURCES
    .map((s) => ({
      kind: s.kind,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      distanceKm: haversineKm({ lat, lon }, { lat: s.lat, lon: s.lon }),
      direction: cardinalFromBearing(bearingDeg({ lat, lon }, { lat: s.lat, lon: s.lon })),
    }))
    .filter((s) => s.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function vesselActivityNear(
  lat: number,
  lon: number,
  events: GfwData['vesselEvents'] | undefined,
  maxKm = VESSEL_RADIUS_KM
): VesselActivity | null {
  if (!events?.length) return null;
  const activity: VesselActivity = { count: 0, fishing: 0, loitering: 0, portVisits: 0 };
  const names: string[] = [];
  for (const e of events) {
    if (haversineKm({ lat, lon }, { lat: e.lat, lon: e.lon }) <= maxKm) {
      activity.count += 1;
      if (e.type === 'fishing') activity.fishing += 1;
      else if (e.type === 'loitering') activity.loitering += 1;
      else activity.portVisits += 1;
      if (e.vesselName && !names.includes(e.vesselName)) names.push(e.vesselName);
    }
  }
  if (activity.count === 0) return null;
  if (names.length) activity.vesselNames = names.slice(0, 3);
  return activity;
}

/**
 * Deterministic pollution-source attribution for a risk point:
 * nearest port, nearby factories/PLTU/refineries/smelters, and GFW vessel activity.
 */
export function attributeSources(point: RiskPoint, gfw?: GfwData | null): RiskSource[] {
  const sources: RiskSource[] = [];
  const origin = { lat: point.lat, lon: point.lon };

  // Nearest port (large-scale vessel traffic / port runoff)
  const port = nearestPort(point.lat, point.lon);
  if (port && port.distanceKm <= PORT_RADIUS_KM) {
    sources.push({
      kind: 'pelabuhan',
      name: port.port.name,
      distanceKm: port.distanceKm,
      direction: cardinalFromBearing(bearingDeg(origin, { lat: port.port.lat, lon: port.port.lon })),
    });
  }

  // Nearby industrial sources (top 3)
  sources.push(
    ...nearbyPollutionSources(point.lat, point.lon).slice(0, 3).map((s) => ({
      kind: s.kind,
      name: s.name,
      distanceKm: s.distanceKm,
      direction: s.direction,
    }))
  );

  // GFW vessel activity around the point
  const vessels = vesselActivityNear(point.lat, point.lon, gfw?.vesselEvents);
  if (vessels) {
    const parts: string[] = [];
    if (vessels.fishing > 0) parts.push(`${vessels.fishing} fishing`);
    if (vessels.loitering > 0) parts.push(`${vessels.loitering} loitering`);
    if (vessels.portVisits > 0) parts.push(`${vessels.portVisits} port-visit`);
    const detail = [
      parts.join(', '),
      ...(vessels.vesselNames?.length ? [`Kapal: ${vessels.vesselNames.join(', ')}`] : []),
    ].join(' · ');
    sources.push({
      kind: 'kapal',
      name: `${vessels.count} kapal dalam ${VESSEL_RADIUS_KM} km`,
      distanceKm: 0,
      direction: 'sekitar',
      count: vessels.count,
      detail,
    });
  }

  // Near-coast: runoff / estuary risk
  const coast = nearestCoast(point.lat, point.lon);
  if (coast && coast.distanceKm < 3) {
    sources.push({
      kind: 'muara',
      name: 'Zona pesisir & muara (runoff daratan)',
      distanceKm: coast.distanceKm,
      direction: 'pesisir',
    });
  }

  return sources;
}

/** Attach `nearbySources` to every risk point (in place, returns new array). */
export function enrichRiskPoints(points: RiskPoint[], gfw?: GfwData | null): RiskPoint[] {
  return points.map((p) => ({ ...p, nearbySources: attributeSources(p, gfw) }));
}

/** Preview of nearby industrial sources around a region center (for the form). */
export function regionSourcePreview(lat: number, lon: number, maxKm = 150): NearbySource[] {
  return nearbyPollutionSources(lat, lon, maxKm).slice(0, 5);
}

/** Human-readable context string passed to Agent 2 for source attribution. */
export function buildSourceContext(lat: number, lon: number, gfw?: GfwData | null): string {
  const lines: string[] = [];

  const sources = nearbyPollutionSources(lat, lon, 150).slice(0, 8);
  if (sources.length) {
    lines.push('Sumber industri terdekat (pabrik/kilang/PLTU/smelter):');
    for (const s of sources) {
      lines.push(`- ${s.name} — ${Math.round(s.distanceKm)} km (${s.direction})`);
    }
  } else {
    lines.push('Tidak ada sumber industri besar dalam 150 km dari pusat wilayah.');
  }

  const ports = INDONESIAN_PORTS
    .map((p) => ({ port: p, km: haversineKm({ lat, lon }, { lat: p.lat, lon: p.lon }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
  if (ports.length) {
    lines.push(`Pelabuhan terdekat: ${ports.map((p) => `${p.port.name} (${Math.round(p.km)} km)`).join(', ')}`);
  }

  if (gfw?.vesselEvents?.length) {
    const total = gfw.vesselEvents.length;
    const fishing = gfw.vesselEvents.filter((e) => e.type === 'fishing').length;
    const loitering = gfw.vesselEvents.filter((e) => e.type === 'loitering').length;
    const portVisits = gfw.vesselEvents.filter((e) => e.type === 'port_visit').length;
    lines.push(`Aktivitas kapal GFW di area: ${total} kejadian (${fishing} fishing, ${loitering} loitering, ${portVisits} port-visit).`);
    const names = gfw.vesselEvents.map((e) => e.vesselName).filter(Boolean).slice(0, 5);
    if (names.length) lines.push(`Kapal terdeteksi: ${names.join(', ')}.`);
  }

  return lines.join('\n');
}
