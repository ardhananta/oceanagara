'use client';

import { useEffect, useRef, useState } from 'react';
import type { GfwVesselEvent, RiskPoint, SatelliteAnalysis, SatelliteSolidWasteAnalysis } from '@/app/types/maritime';
import { bearingDeg, cardinalFromBearing, formatKm, haversineKm, midpoint, nearestCoast, nearestPort } from './distances';
import type { NearbySource } from './sources';

interface RiskMapProps {
  riskPoints: RiskPoint[];
  centerLat: number;
  centerLon: number;
  vessels?: GfwVesselEvent[];
  nearbySources?: NearbySource[];
  /** Analisis citra satelit NASA GIBS — memungkinkan overlay TrueColor/Klorofil/SST */
  satellite?: SatelliteAnalysis | null;
  /** Kandidat sampah padat terapung Sentinel-2 (kepercayaan ≥ 0.7) */
  solidWaste?: SatelliteSolidWasteAnalysis | null;
  /** Kelas tinggi peta (default: 52vh mobile, sisa viewport desktop) */
  heightClass?: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const RISK_LABEL: Record<string, string> = {
  critical: 'KRITIS',
  high: 'TINGGI',
  medium: 'SEDANG',
  low: 'RENDAH',
};

const COAST_COLOR = '#0d9488';
const PORT_COLOR = '#4f46e5';

const SOURCE_COLORS: Record<string, string> = {
  kilang: '#7c3aed',
  pltu: '#c2410c',
  'kawasan-industri': '#b91c1c',
  smelter: '#be185d',
};

const SOURCE_LABEL: Record<string, string> = {
  kilang: 'KILANG',
  pltu: 'PLTU',
  'kawasan-industri': 'INDUSTRI',
  smelter: 'SMELTER',
};

const VESSEL_COLORS: Record<string, string> = {
  fishing: '#0284c7',
  loitering: '#d97706',
  port_visit: '#7c3aed',
};

const GIBS_WMS_3857 = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

const SAT_LAYERS: Array<{ layer: string; label: string; base: string }> = [
  { layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'True Color', base: '#0ea5e9' },
  { layer: 'OCI_PACE_Chlorophyll_a', label: 'Klorofil', base: '#16a34a' },
  { layer: 'MODIS_Terra_L2_Chlorophyll_A', label: 'Klorofil', base: '#16a34a' },
  { layer: 'GHRSST_L4_MUR25_Sea_Surface_Temperature', label: 'Suhu Laut', base: '#dc2626' },
];

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

// Shared Leaflet loader — same promise for all remounts, so the script is only
// injected once and components never mark "ready" before the JS is actually loaded.
let leafletPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || window.L) {
      resolve();
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => {
      leafletPromise = null; // allow retry on next mount
      reject(new Error('Gagal memuat Leaflet dari CDN'));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

/** SVG icon per pollution type, shown inside the risk pin tooltip. */
function riskTypeIcon(type: string): string {
  const t = type.toLowerCase();
  const icon = (paths: string, fill = true): string => `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${fill ? 0 : 2}">
      ${paths}
    </svg>`;
  if (t.includes('minyak') || t.includes('oli') || t.includes('fuel'))
    return icon('<path d="M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-13-7-13Zm0 17.5a3 3 0 0 1-3-3c0-1.8 3-5 3-5s3 3.2 3 5a3 3 0 0 1-3 3Z"/>');
  if (t.includes('industri') || t.includes('limbah'))
    return icon('<path d="M2 21h20M4 21V9l5 3V9l5 3V9l6 3v9H4Z"/><path d="M9 4h2v2H9zM13 2h2v2h-2z"/>', false);
  if (t.includes('plastik') || t.includes('sampah'))
    return icon('<path d="M5 8h14l-1.5 13h-11L5 8Zm4 0V6a3 3 0 0 1 6 0v2M9 12v6M12 12v6M15 12v6"/>', false);
  if (t.includes('kapal') || t.includes('tanker') || t.includes('pelayaran'))
    return icon('<path d="M3 15c2 1 4 1 5 0s3-1 5 0 3 1 5 0l3-2-2 8H4L3 15Zm6-7h6l-1 5h-4L9 8Zm1-3a2 2 0 1 1 4 0"/>', false);
  if (t.includes('runoff') || t.includes('pertanian') || t.includes('sedimen'))
    return icon('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M12 20a2.5 2.5 0 0 0 2.5-2.5c0-1.6-2.5-3.9-2.5-3.9S9.5 15.9 9.5 17.5A2.5 2.5 0 0 0 12 20Z"/>', false);
  return icon('<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 5v5l3.5 3.5"/>');
}

export default function RiskMap({ riskPoints, centerLat, centerLon, vessels = [], nearbySources = [], satellite = null, solidWaste = null, heightClass = "h-[52vh] lg:h-[calc(100vh-160px)]" }: RiskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const satOverlayRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundsRef = useRef<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [satLayer, setSatLayer] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);

  // Available satellite layers from the analysis (with actual imagery)
  const availableSatLayers = (satellite?.layers ?? [])
    .map((l) => ({ layer: l.layer, date: l.imageryDate }))
    .filter((l) => l.layer !== 'MODIS_Terra_L2_Chlorophyll_A' || !satellite?.layers.some((x) => x.layer === 'OCI_PACE_Chlorophyll_a'));

  // Selection is only honored while the analysis actually contains that layer
  const activeSatLayer = satellite && satLayer && satellite.layers.some((l) => l.layer === satLayer) ? satLayer : null;

  // Load Leaflet CSS + JS dynamically (once, shared across remounts)
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setLeafletReady(true);
      })
      .catch(() => {
        // CDN unavailable — leave map empty rather than crashing
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize map once Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLon],
      zoom: 9,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
  }, [leafletReady, centerLat, centerLon]);

  // Add risk markers + coast/port distance lines whenever data changes
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || riskPoints.length === 0) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    const riskLayer = L.layerGroup().addTo(map);
    const distLayer = L.layerGroup().addTo(map);
    const contextLayer = L.layerGroup().addTo(map);
    const spillLayer = L.layerGroup().addTo(map);

    // ── Industrial pollution sources (factories / PLTU / refineries / smelters) ──
    nearbySources.forEach((s) => {
      if (!SOURCE_COLORS[s.kind]) return;
      const color = SOURCE_COLORS[s.kind];
      L.marker([s.lat, s.lon], {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:22px;height:22px;cursor:pointer;">
              <span style="position:absolute;inset:0;background:${color};border:2px solid #fff;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.5);"></span>
              <span style="position:absolute;inset:4px 0 0 0;color:#fff;font-size:8px;font-weight:800;text-align:center;line-height:1;">${SOURCE_LABEL[s.kind].slice(0, 2)}</span>
            </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 100,
      })
        .bindTooltip(
          `<div style="font-family:inherit;font-size:10px;">
            <b>${s.name}</b><br/>
            <span style="color:#64748b;">${Math.round(s.distanceKm)} km dari pusat (${s.direction})</span>
          </div>`,
          { direction: 'top', opacity: 0.95 }
        )
        .addTo(contextLayer);
    });

    // ── GFW vessel events ──
    vessels.forEach((v) => {
      const color = VESSEL_COLORS[v.type] ?? '#94a3b8';
      const headingDeg = typeof v.heading === 'number' && isFinite(v.heading) ? ((v.heading % 360) + 360) % 360 : 0;
      const headingLabel =
        typeof v.heading === 'number' && isFinite(v.heading)
          ? `${cardinalFromBearing(v.heading)} ${Math.round(headingDeg)}°`
          : '—';
      const speedLabel = typeof v.speedKnots === 'number' ? `${v.speedKnots.toFixed(1)} kn` : '';
      const shoreLabel = typeof v.endDistanceFromShoreKm === 'number' ? `${v.endDistanceFromShoreKm.toFixed(1)} km dr pantai` : '';
      const typeLabel = v.vesselType ? v.vesselType.replace('_', ' ') : v.type;

      // Direction arrow: ship glyph rotated by heading
      const arrowHtml = `
        <div style="position:relative;width:20px;height:20px;cursor:pointer;transform:rotate(${headingDeg}deg);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1">
            <path d="M12 2l2.6 6.8a4.4 4.4 0 0 1-5.2 0L12 2zM6.5 20.5l5.5-3 5.5 3-1 2h-9l-1-2zM9 10.6c.9.3 1.9.5 3 .5s2.1-.2 3-.5l-.5 7.4h-5L9 10.6z"/>
          </svg>
        </div>
      `;
      const marker = L.marker([v.lat, v.lon], {
        icon: L.divIcon({ className: '', html: arrowHtml, iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 300,
      });
      marker.bindTooltip(
        `<div style="font-family:inherit;min-width:150px;">
          <div style="display:flex;align-items:center;gap:5px;font-weight:800;font-size:11px;margin-bottom:2px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
            ${v.vesselName || 'Kapal tak dikenal'}
          </div>
          <div style="font-size:10px;color:#64748b;line-height:1.6;">
            <b>${typeLabel}</b>${v.flag ? ` · Bendera ${v.flag}` : ''}${v.vesselId ? ` · ${v.vesselId.slice(0, 8)}` : ''}<br/>
            ${headingLabel}${speedLabel ? ` · ${speedLabel}` : ''}${shoreLabel ? `<br/>${shoreLabel}` : ''}
          </div>
        </div>`,
        { direction: 'top', opacity: 0.96 }
      );
      marker.addTo(contextLayer);
    });

    riskPoints.forEach((point, idx) => {
      const color = RISK_COLORS[point.riskLevel] ?? '#6b7280';
      const label = RISK_LABEL[point.riskLevel] ?? '—';
      const score = Math.round(point.riskScore);

      // Distance computations
      const coast = nearestCoast(point.lat, point.lon);
      const port = nearestPort(point.lat, point.lon);

      // ── Distance visualizations ──────────────────────────────────────────
      if (coast && coast.distanceKm > 0.5) {
        const line = L.polyline([[point.lat, point.lon], [coast.point.lat, coast.point.lon]], {
          color: COAST_COLOR,
          weight: 1.6,
          dashArray: '6, 5',
          opacity: 0.9,
          interactive: false,
        }).addTo(distLayer);
        L.circleMarker([coast.point.lat, coast.point.lon], {
          radius: 4,
          color: '#fff',
          weight: 1.5,
          fillColor: COAST_COLOR,
          fillOpacity: 1,
          interactive: false,
        }).addTo(distLayer);
        const mid = midpoint({ lat: point.lat, lon: point.lon }, coast.point);
        L.marker([mid.lat, mid.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${COAST_COLOR};color:#fff;font-size:9px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid rgba(255,255,255,.75);white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.4);">Pesisir ${formatKm(coast.distanceKm)} km</div>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(distLayer);
        void line;
      }

      if (port) {
        const line = L.polyline([[point.lat, point.lon], [port.port.lat, port.port.lon]], {
          color: PORT_COLOR,
          weight: 1.4,
          dashArray: '2, 6',
          opacity: 0.85,
          interactive: false,
        }).addTo(distLayer);
        L.circleMarker([port.port.lat, port.port.lon], {
          radius: 5,
          color: '#fff',
          weight: 1.5,
          fillColor: PORT_COLOR,
          fillOpacity: 1,
          interactive: false,
        }).addTo(distLayer);
        const mid = midpoint({ lat: point.lat, lon: point.lon }, port.port);
        L.marker([mid.lat, mid.lon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${PORT_COLOR};color:#fff;font-size:9px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid rgba(255,255,255,.75);white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.4);">${formatKm(port.distanceKm)} km</div>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(distLayer);
        void line;
      }

      // ── Simple flat circle marker with score ─────────────────────────────
      // Spill radius circle (drawn below the marker)
      if (typeof point.spillRadiusKm === 'number' && isFinite(point.spillRadiusKm) && point.spillRadiusKm > 0) {
        L.circle([point.lat, point.lon], {
          radius: point.spillRadiusKm * 1000,
          color,
          weight: 1.2,
          dashArray: '4, 6',
          fillColor: color,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(spillLayer);
      }

      const iconHtml = `
        <div style="position:relative;width:26px;height:26px;cursor:pointer;">
          <span style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);"></span>
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${score >= 100 ? 9 : 10}px;font-family:inherit;line-height:1;">${score}</span>
          <span style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);color:#334155;font-size:7px;font-weight:700;letter-spacing:.3px;white-space:nowrap;">${label}</span>
        </div>
      `;

      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({ className: '', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] }),
        zIndexOffset: point.riskLevel === 'critical' ? 1000 : point.riskLevel === 'high' ? 800 : 500,
      });
      marker.addTo(riskLayer);

      const coastLine = coast && coast.distanceKm > 0.5
        ? `Pesisir: <b>${formatKm(coast.distanceKm)} km</b> (${cardinalFromBearing(bearingDeg({ lat: point.lat, lon: point.lon }, coast.point))})`
        : 'Pesisir: di garis pantai';
      const portLine = port
        ? `Pelabuhan: <b>${formatKm(port.distanceKm)} km</b> — ${port.port.name}`
        : 'Pelabuhan: —';
      const spillLine =
        typeof point.spillRadiusKm === 'number' && point.spillRadiusKm > 0
          ? `Radius sebaran: <b>${formatKm(point.spillRadiusKm)} km</b>${point.wasteForm ? ` · ${point.wasteForm}` : ''}`
          : '';

      marker.bindTooltip(
        `<div style="font-family:inherit;">
          <div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:11px;margin-bottom:3px;">
            <span style="color:${color}">${riskTypeIcon(point.riskType)}</span>
            <span>#${idx + 1} ${point.riskType}</span>
          </div>
          <div style="font-size:10px;color:#64748b;line-height:1.6;">
            ${spillLine ? `${spillLine}<br/>` : ''}${coastLine}<br/>${portLine}
          </div>
        </div>`,
        { direction: 'top', offset: [0, -12], opacity: 0.96 }
      );
      marker.on('click', () => setSelectedPoint(point));
    });

    // ── Sentinel-2 solid waste candidates (confidence ≥ 0.7) ─────────────
    const wasteLayer = L.layerGroup().addTo(map);
    solidWaste?.candidates.forEach((c) => {
      const conf = Math.round(c.confidence * 100);
      const iconHtml = `
        <div style="position:relative;width:20px;height:20px;cursor:pointer;">
          <span style="position:absolute;inset:0;background:#e11d48;border:2px solid #fff;transform:rotate(45deg);border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.4);"></span>
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:8px;font-family:inherit;line-height:1;">${conf}</span>
        </div>
      `;
      L.marker([c.lat, c.lon], {
        icon: L.divIcon({ className: '', html: iconHtml, iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 600,
      })
        .bindTooltip(
          `<div style="font-family:inherit;font-size:10px;">
            <b>Sampah padat terapung (Sentinel-2)</b><br/>
            <span style="color:#64748b;">Kepercayaan ${conf}% · ≈${(c.areaM2 / 1000).toLocaleString('id-ID')} ribu m²</span><br/>
            <span style="color:#64748b;">Terlihat ${c.observedDates.length}x citra · ${formatKm(c.coastKm)} dari pantai</span>
          </div>`,
          { direction: 'top', opacity: 0.96 }
        )
        .addTo(wasteLayer);
    });

    // Fit bounds to all points — include the coast target (usually close),
    // but only nearby ports so the view doesn't zoom out across the country.
    if (riskPoints.length > 0 || solidWaste?.candidates.length) {
      const pts = riskPoints.flatMap((p) => {
        const c = nearestCoast(p.lat, p.lon);
        const port = nearestPort(p.lat, p.lon);
        return [
          [p.lat, p.lon],
          ...(c ? [[c.point.lat, c.point.lon]] : []),
          ...(port && port.distanceKm < 150 ? [[port.port.lat, port.port.lon]] : []),
        ];
      });
      solidWaste?.candidates.forEach((c) => pts.push([c.lat, c.lon]));
      const bounds = L.latLngBounds(pts);
      boundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }

    return () => {
      riskLayer.remove();
      distLayer.remove();
      contextLayer.remove();
      spillLayer.remove();
      wasteLayer.remove();
    };
  }, [leafletReady, riskPoints, vessels, nearbySources, solidWaste]);

  // Satellite imagery overlay (NASA GIBS WMS, EPSG:3857)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map) return;

    if (satOverlayRef.current) {
      map.removeLayer(satOverlayRef.current);
      satOverlayRef.current = null;
    }

    if (!activeSatLayer) return;

    const meta = (satellite?.layers ?? []).find((l) => l.layer === activeSatLayer);
    if (!meta) return;

    const L = window.L;
    satOverlayRef.current = L.tileLayer.wms(GIBS_WMS_3857, {
      layers: activeSatLayer,
      version: '1.3.0',
      transparent: true,
      format: 'image/png',
      opacity: 0.65,
      maxZoom: 12,
      params: { TIME: meta.imageryDate },
    }).addTo(map);
  }, [leafletReady, activeSatLayer, satellite]);

  const selectedCoast = selectedPoint ? nearestCoast(selectedPoint.lat, selectedPoint.lon) : null;
  const selectedPort = selectedPoint ? nearestPort(selectedPoint.lat, selectedPoint.lon) : null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
      {/* Map container */}
      <div ref={mapRef} className={`w-full ${heightClass}`} />

      {/* Legend — collapsible */}
      <div className="absolute top-4 left-4 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl shadow-lg max-w-[210px]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">
            Legenda
          </p>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="p-1 rounded-md text-zinc-500 hover:text-[#162e52] hover:bg-zinc-100 transition-colors"
            aria-label={legendOpen ? "Tutup legenda" : "Buka legenda"}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${legendOpen ? "" : "-rotate-90"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>
        {legendOpen && (
          <div className="px-3 pb-3 space-y-2 max-h-[52vh] overflow-y-auto scroll-slim border-t border-zinc-100 pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52] mb-1">Tingkat Risiko</p>
            {Object.entries(RISK_LABEL).map(([level, label]) => (
              <div key={level} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full border border-white/60 flex-shrink-0"
                  style={{ background: RISK_COLORS[level] }}
                />
                <span className="text-[11px] text-zinc-700 font-semibold">{label}</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-4 h-0 border-t-2 border-dashed inline-block" style={{ borderColor: COAST_COLOR }} />
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold">Jarak ke pesisir terdekat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-4 h-0 border-t-2 inline-block" style={{ borderColor: PORT_COLOR }} />
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold">Jarak ke pelabuhan terdekat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-3.5 h-3.5 rounded-full border border-zinc-400 flex-shrink-0" style={{ background: '#dc262615', borderColor: '#dc262655' }} />
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold">Radius sebaran limbah</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Sumber Industri</p>
              {Object.entries(SOURCE_COLORS).map(([kind, color]) => (
                <div key={kind} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-[4px] border border-white/60 flex-shrink-0" style={{ background: color }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">{SOURCE_LABEL[kind]}</span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Aktivitas Kapal (GFW)</p>
              {Object.entries(VESSEL_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-white/60 flex-shrink-0" style={{ background: color }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">{type === 'port_visit' ? 'Port-visit' : type}</span>
                </div>
              ))}
            </div>
            {satellite && (
              <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Citra Satelit</p>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm border border-zinc-400 flex-shrink-0" style={{ background: '#0ea5e950' }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">Overlay aktif (True Color / Klorofil / Suhu)</span>
                </div>
              </div>
            )}
            {solidWaste?.candidates.length ? (
              <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Sampah Padat</p>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 flex-shrink-0" style={{ background: '#e11d48', transform: 'rotate(45deg)', borderRadius: 2 }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">Kandidat terapung (Sentinel-2, ≥70%)</span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Tombol pas tampilan ke hasil analisis */}
      <button
        onClick={() => {
          const m = mapInstanceRef.current;
          const b = boundsRef.current;
          if (m && b) m.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
        }}
        className="absolute bottom-5 left-4 z-[999] flex items-center gap-1.5 bg-white/95 backdrop-blur border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 hover:text-[#162e52] hover:bg-white shadow-md transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        Pas ke Hasil
      </button>

      {/* Satellite layer toggle */}
      {satellite && availableSatLayers.length > 0 && (
        <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl p-1.5 shadow-lg flex flex-col gap-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#162e52] px-2 pt-0.5">
            Citra Satelit
          </p>
          {[
            { layer: null, label: 'Peta Dasar', base: '#71717a' },
            ...availableSatLayers.map((l) => {
              const meta = SAT_LAYERS.find((s) => s.layer === l.layer);
              return { layer: l.layer, label: meta?.label ?? l.layer, base: meta?.base ?? '#0ea5e9' };
            }),
          ].map((opt) => (
            <button
              key={opt.label + (opt.layer ?? 'base')}
              onClick={() => setSatLayer(opt.layer)}
              className={`flex items-center gap-2 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-colors ${
                activeSatLayer === opt.layer ? 'bg-[#162e52] text-white' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm border border-white/70 flex-shrink-0"
                style={{ background: activeSatLayer === opt.layer ? opt.base : 'transparent' }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Selected point popup */}
      {selectedPoint && (
        <div className="absolute bottom-4 left-4 right-4 z-[999] bg-white/98 border rounded-xl p-4 shadow-2xl"
          style={{ borderColor: RISK_COLORS[selectedPoint.riskLevel] + '55' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[selectedPoint.riskLevel] }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: RISK_COLORS[selectedPoint.riskLevel] }}>
                  {RISK_LABEL[selectedPoint.riskLevel]} — Skor {selectedPoint.riskScore}/100
                </span>
              </div>
              <p className="text-sm font-bold text-zinc-900">{selectedPoint.riskType}</p>
              {(selectedPoint.wasteForm || typeof selectedPoint.spillRadiusKm === 'number') && (
                <p className="text-[11px] text-zinc-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {selectedPoint.wasteForm && (
                    <span className="flex items-center gap-1 font-semibold">
                      <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      Bentuk limbah: {selectedPoint.wasteForm}
                    </span>
                  )}
                  {typeof selectedPoint.spillRadiusKm === 'number' && selectedPoint.spillRadiusKm > 0 && (
                    <span className="flex items-center gap-1 font-semibold">
                      <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25 21 12m0 0-5.25 3.75M21 12H3" />
                      </svg>
                      Radius sebaran: {formatKm(selectedPoint.spillRadiusKm)} km
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs text-zinc-600 leading-relaxed mt-1.5 line-clamp-3">{selectedPoint.description}</p>
              {selectedPoint.nearbySources && selectedPoint.nearbySources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedPoint.nearbySources.slice(0, 4).map((src, i) => (
                    <span key={i} className="text-[9px] font-bold text-zinc-800 bg-zinc-100 border border-zinc-300 rounded-lg px-1.5 py-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SOURCE_COLORS[src.kind] ?? VESSEL_COLORS[src.kind] ?? '#f472b6' }} />
                      {src.name}
                      <span className="text-zinc-500 font-semibold">
                        {src.kind === 'kapal' || src.kind === 'muara' ? '' : formatKm(src.distanceKm)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {selectedCoast && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-300 rounded-lg px-2 py-1">
                    <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 18h16M6 18v-5M10 18v-8M14 18v-5M18 18v-8M3 21h18" />
                    </svg>
                    Pesisir {formatKm(selectedCoast.distanceKm)} km
                    <span className="text-teal-600 font-semibold">
                      ({cardinalFromBearing(bearingDeg({ lat: selectedPoint.lat, lon: selectedPoint.lon }, selectedCoast.point))})
                    </span>
                  </span>
                )}
                {selectedPort && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-1">
                    <svg className="w-3 h-3 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14V6m0 0-8 2m8-2 4 2v8M19 6l-4 1m4 7 4 2m-4-2-4 2m4-9v9M7 14V8l-4 2m4-2 8-2m-8 2 4 1" />
                    </svg>
                    {formatKm(selectedPort.distanceKm)} km — {selectedPort.port.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 font-mono">
                {selectedPoint.lat.toFixed(5)}, {selectedPoint.lon.toFixed(5)} · {haversineKm({ lat: selectedPoint.lat, lon: selectedPoint.lon }, { lat: centerLat, lon: centerLon }).toFixed(1)} km dari pusat
              </p>
            </div>
            <button onClick={() => setSelectedPoint(null)} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
