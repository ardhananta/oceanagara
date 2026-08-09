'use client';

import { useEffect, useRef, useState } from 'react';
import type { FishQualityLayer, FishingZone, FishingZoneAnalysis } from '@/app/types/maritime';
import { loadLeaflet } from '@/components/dashboard/wave/leaflet';

interface FishingMapProps {
  analysis: Pick<FishingZoneAnalysis, 'zones' | 'gfw' | 'date'>;
  centerLat: number;
  centerLon: number;
  heightClass?: string;
  departure?: { lat: number; lon: number } | null;
  targetZone?: FishingZone | null;
  /** Penilaian kualitas ikan per zona — bila ada, warna zona mengikuti kualitas. */
  qualityScores?: ReadonlyArray<{
    zoneIndex: number;
    qualityScore: number;
    qualityLabel: string;
    pressureSources: string[];
    sstStress: number;
    habRisk: boolean;
    ph?: number;
    phStress?: number;
  }>;
  /** Prediksi tujuan pergerakan kawanan berikutnya (analisis kualitas). */
  nextSchool?: { lat: number; lon: number; label: string } | null;
  /** Bounds area analisis — untuk posisi citra overlay klorofil/SST. */
  bbox?: { north: number; south: number; east: number; west: number } | null;
  /** Citra overlay penyebaran klorofil-a, suhu laut & estimasi pH (PNG data URL). */
  layers?: { chl?: FishQualityLayer; sst?: FishQualityLayer; ph?: FishQualityLayer } | null;
}

const scoreColor = (score: number): string => {
  if (score >= 0.85) return '#059669';
  if (score >= 0.75) return '#10b981';
  if (score >= 0.65) return '#84cc16';
  return '#facc15';
};

const qualityColor = (score: number): string => {
  if (score >= 85) return '#059669';
  if (score >= 65) return '#10b981';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
};

export default function FishingMap({ analysis, centerLat, centerLon, heightClass = "h-[52vh] lg:h-[calc(100vh-160px)]", departure, targetZone, qualityScores, nextSchool, bbox, layers }: FishingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [overlayChl, setOverlayChl] = useState(true);
  const [overlaySst, setOverlaySst] = useState(true);
  const [overlayPh, setOverlayPh] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setLeafletReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Inisialisasi peta
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

  // Overlay penyebaran klorofil-a & suhu permukaan laut (citra hasil analisis)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map) return;
    const L = window.L;

    const overlayGroup = L.layerGroup().addTo(map);
    const bounds: [[number, number], [number, number]] | null = bbox
      ? [
          [bbox.south, bbox.west],
          [bbox.north, bbox.east],
        ]
      : null;

    if (overlayChl && layers?.chl && bounds) {
      L.imageOverlay(layers.chl.dataUrl, bounds, {
        opacity: 0.65,
        interactive: false,
      }).addTo(overlayGroup);
    }
    if (overlaySst && layers?.sst && bounds) {
      L.imageOverlay(layers.sst.dataUrl, bounds, {
        opacity: 0.65,
        interactive: false,
      }).addTo(overlayGroup);
    }
    if (overlayPh && layers?.ph && bounds) {
      L.imageOverlay(layers.ph.dataUrl, bounds, {
        opacity: 0.55,
        interactive: false,
      }).addTo(overlayGroup);
    }

    return () => {
      overlayGroup.remove();
    };
  }, [leafletReady, overlayChl, overlaySst, overlayPh, layers, bbox]);

  // Marker zona + panah arah kawanan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map || analysis.zones.length === 0) return;
    const L = window.L;

    const zoneLayer = L.layerGroup().addTo(map);

    // Hotspot konsentrasi kapal penangkap Global Fishing Watch
    const gfwLayer = L.layerGroup().addTo(map);
    if (analysis.gfw && !analysis.gfw.isMock && analysis.gfw.hotspots.length > 0) {
      analysis.gfw.hotspots.forEach((h) => {
        const size = Math.max(10, Math.min(26, 8 + h.count * 2.2));
        const arrow = h.headingDeg !== undefined
          ? `<div style="display:flex;align-items:center;justify-content:center;">
               <svg width="9" height="9" viewBox="0 0 24 24" fill="#7c3aed" style="transform:rotate(${h.headingDeg}deg);">
                 <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13"/>
               </svg>
             </div>`
          : '';
        const html = `
          <div style="position:relative;width:${size}px;height:${size}px;">
            <div style="position:absolute;inset:0;background:#7c3aed;border:2px solid #fff;border-radius:9999px;opacity:0.75;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-size:${size * 0.34}px;font-weight:800;line-height:1;">${h.count}</span>
            </div>
            ${arrow}
          </div>`;
        L.marker([h.lat, h.lon], {
          icon: L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
          zIndexOffset: 400,
        })
          .bindTooltip(
            `<div style="font-family:inherit;font-size:10px;max-width:220px;">
              <b style="color:#7c3aed">Kapal penangkap GFW</b>
              <div style="color:#64748b;line-height:1.6;margin-top:2px;">
                ${h.count} event (fishing/loitering) 7 hari<br/>
                ${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}${h.headingDeg !== undefined ? `<br/>Heading dominan: <b>${h.headingDeg}°</b>` : ''}
              </div>
            </div>`,
            { direction: 'top', opacity: 0.96 }
          )
          .addTo(gfwLayer);
      });
    }

    analysis.zones.forEach((z, zi) => {
      const sc = qualityScores?.find((s) => s.zoneIndex === zi);
      const color = sc ? qualityColor(sc.qualityScore) : scoreColor(z.score);
      const radiusKm = Math.max(2, Math.sqrt(z.areaKm2 / Math.PI));
      L.circle([z.lat, z.lon], {
        radius: radiusKm * 1000,
        color,
        weight: 1.6,
        fillColor: color,
        fillOpacity: 0.28,
      }).addTo(zoneLayer);

      const deg = z.movementDeg ?? 0;
      const arrowHtml = `
        <div style="position:relative;width:26px;height:26px;cursor:pointer;transform:rotate(${deg}deg);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.2">
            <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13"/>
          </svg>
        </div>
      `;
      const tooltipInner = sc
        ? `
            Kualitas ikan: <b>${sc.qualityScore}/100 (${sc.qualityLabel})</b><br/>
            Tekanan: ${sc.pressureSources.join('; ')}<br/>
            ${z.species.length ? `Ikan: <b>${z.species.join(', ')}</b><br/>` : ''}
            Suhu ${z.meanSst}°C · Klorofil ${z.meanChl} mg/m³ · pH ${sc.ph?.toFixed(2) ?? '—'}<br/>
            ${z.movementLabel}`
        : `
            Skor habitat: <b>${(z.score * 100).toFixed(0)}/100</b> · ±${z.areaKm2.toLocaleString('id-ID')} km²<br/>
            ${z.species.length ? `Ikan: <b>${z.species.join(', ')}</b><br/>` : ''}
            Suhu ${z.meanSst}°C · Klorofil ${z.meanChl} mg/m³<br/>
            ${z.movementLabel}`;
      L.marker([z.lat, z.lon], {
        icon: L.divIcon({ className: '', html: arrowHtml, iconSize: [26, 26], iconAnchor: [13, 13] }),
        zIndexOffset: 500,
      })
        .bindTooltip(
          `<div style="font-family:inherit;font-size:10px;max-width:240px;">
            <b style="color:${color}">${z.lat.toFixed(4)}, ${z.lon.toFixed(4)}</b>
            <div style="color:#64748b;line-height:1.6;margin-top:2px;">${tooltipInner}
            </div>
          </div>`,
          { direction: 'top', opacity: 0.96 }
        )
        .addTo(zoneLayer);
    });

    const latLngs = analysis.zones.map((z) => [z.lat, z.lon] as [number, number]);
    if (analysis.gfw && !analysis.gfw.isMock && analysis.gfw.hotspots.length > 0) {
      latLngs.push(...analysis.gfw.hotspots.map((h) => [h.lat, h.lon] as [number, number]));
    }
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });

    return () => {
      zoneLayer.remove();
      gfwLayer.remove();
    };
  }, [leafletReady, analysis, qualityScores]);

  // Marker titik berangkat + garis rute ke zona target
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map || !departure) return;
    const L = window.L;

    const navLayer = L.layerGroup().addTo(map);

    const depIcon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;background:#0ea5e9;border:3px solid #fff;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([departure.lat, departure.lon], { icon: depIcon, zIndexOffset: 600 })
      .bindTooltip(
        `<div style="font-family:inherit;font-size:10px;max-width:200px;">
          <b style="color:#0ea5e9">Titik Berangkat</b>
          <div style="color:#64748b;line-height:1.6;margin-top:2px;">${departure.lat.toFixed(4)}, ${departure.lon.toFixed(4)}</div>
        </div>`,
        { direction: 'right', opacity: 0.96 }
      )
      .addTo(navLayer);

    if (targetZone) {
      const targetLatLng: [number, number] = [targetZone.lat, targetZone.lon];
      L.polyline(
        [
          [departure.lat, departure.lon],
          targetLatLng,
        ],
        {
          color: '#0ea5e9',
          weight: 3,
          dashArray: '8 6',
          opacity: 0.9,
        }
      ).addTo(navLayer);

      // panah di ujung rute (arah dari titik berangkat ke zona)
      const deg = Math.atan2(targetZone.lon - departure.lon, targetZone.lat - departure.lat) * (180 / Math.PI);
      const headIcon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;transform:rotate(${deg}deg);">
                 <svg width="22" height="22" viewBox="0 0 24 24" fill="#0ea5e9" stroke="#fff" stroke-width="1.2">
                   <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13"/>
                 </svg>
               </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker(targetLatLng, { icon: headIcon, zIndexOffset: 550 }).addTo(navLayer);
    }

    // pastikan titik berangkat terlihat
    const routeBounds = targetZone
      ? L.latLngBounds([
          [departure.lat, departure.lon],
          [targetZone.lat, targetZone.lon],
        ])
      : L.latLngBounds([[departure.lat, departure.lon]]);
    map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 10 });

    return () => {
      navLayer.remove();
    };
  }, [leafletReady, analysis, departure, targetZone]);

  // Marker prediksi tujuan kawanan berikutnya (analisis kualitas ikan)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map || !nextSchool || !Number.isFinite(nextSchool.lat) || !Number.isFinite(nextSchool.lon) || nextSchool.lat === 0) return;
    const L = window.L;

    const nextLayer = L.layerGroup().addTo(map);
    const icon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:36px;height:36px;">
               <span style="position:absolute;inset:0;border-radius:9999px;background:#8b5cf6;opacity:0.25;"></span>
               <span style="position:absolute;inset:5px;border-radius:9999px;background:#8b5cf6;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
                 <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13"/></svg>
               </span>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    L.marker([nextSchool.lat, nextSchool.lon], { icon, zIndexOffset: 700 })
      .bindTooltip(
        `<div style="font-family:inherit;font-size:10px;max-width:260px;">
          <b style="color:#8b5cf6">Prediksi kawanan berikutnya</b>
          <div style="color:#64748b;line-height:1.6;margin-top:2px;">${nextSchool.lat.toFixed(4)}, ${nextSchool.lon.toFixed(4)}<br/>${nextSchool.label}</div>
        </div>`,
        { direction: 'top', opacity: 0.96 }
      )
      .addTo(nextLayer);

    map.flyTo([nextSchool.lat, nextSchool.lon], Math.max(map.getZoom(), 9), { duration: 0.5 });

    return () => {
      nextLayer.remove();
    };
  }, [leafletReady, nextSchool]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
      <div ref={mapRef} className={`w-full ${heightClass}`} />

      {/* Tombol overlay klorofil, suhu & pH */}
      <div className="absolute top-4 right-4 z-[999] flex flex-col gap-1.5">
        {layers?.chl && (
          <button
            type="button"
            onClick={() => setOverlayChl((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors ${
              overlayChl
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white/95 backdrop-blur text-zinc-600 border-zinc-300 hover:bg-emerald-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17m-4-9l4 4 4-4" transform="rotate(90 12 12)" />
            </svg>
            Klorofil
          </button>
        )}
        {layers?.sst && (
          <button
            type="button"
            onClick={() => setOverlaySst((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors ${
              overlaySst
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white/95 backdrop-blur text-zinc-600 border-zinc-300 hover:bg-rose-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a5 5 0 0 1 3 9c-.6.5-1 1.2-1 2v1.5a2 2 0 0 1-4 0V14c0-.8-.4-1.5-1-2A5 5 0 0 1 12 3zM12 3v1.5M12 19.5V21" />
            </svg>
            Suhu Laut
          </button>
        )}
        {layers?.ph && (
          <button
            type="button"
            onClick={() => setOverlayPh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors ${
              overlayPh
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white/95 backdrop-blur text-zinc-600 border-zinc-300 hover:bg-sky-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3 3 0 1 0 6 0c0-1.2-1.5-3-3-5.5-1.5 2.5-3 4.3-3 5.5z" />
              <path strokeLinecap="round" d="M10 21h4" />
            </svg>
            pH Laut
          </button>
        )}
      </div>

      {/* Legenda */}
      <div className="absolute top-4 left-4 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl shadow-lg p-3 max-w-[240px]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52] mb-2">
          {qualityScores ? 'Kualitas Ikan Zona' : 'Kualitas Zona'}
        </p>
        {(overlayChl || overlaySst || overlayPh) && (
          <div className="mb-2.5 space-y-2 border-t border-zinc-100 pt-2">
            {overlayChl && layers?.chl && (
              <div>
                <p className="text-[9px] font-bold text-emerald-700 mb-1">
                  Klorofil-a (mg/m³) · {layers.chl.date}
                </p>
                <div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg,#000080,#0080ff,#00c0c0,#00ff80,#c0ff00,#ff8000,#ff0000)' }} />
                <div className="flex justify-between text-[8px] text-zinc-500 font-semibold mt-0.5">
                  <span>{layers.chl.min.toLocaleString('id-ID')}</span>
                  <span>{(layers.chl.min * Math.sqrt(layers.chl.max / layers.chl.min)).toLocaleString('id-ID')}</span>
                  <span>{layers.chl.max.toLocaleString('id-ID')}+</span>
                </div>
              </div>
            )}
            {overlaySst && layers?.sst && (
              <div>
                <p className="text-[9px] font-bold text-rose-700 mb-1">
                  Suhu Permukaan Laut (°C) · {layers.sst.date}
                </p>
                <div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg,#3b0f70,#2d7bd4,#23c6c2,#58d858,#f0e442,#f28e2b,#d7191c)' }} />
                <div className="flex justify-between text-[8px] text-zinc-500 font-semibold mt-0.5">
                  <span>{layers.sst.min}</span>
                  <span>{Math.round((layers.sst.min + layers.sst.max) / 2)}</span>
                  <span>{layers.sst.max}+</span>
                </div>
              </div>
            )}
            {overlayPh && layers?.ph && (
              <div>
                <p className="text-[9px] font-bold text-sky-700 mb-1">
                  pH Permukaan Laut (estimasi) · {layers.ph.date}
                </p>
                <div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg,#be1e2d,#f28e2b,#f0e442,#58d858,#2394d6,#3b3cb4)' }} />
                <div className="flex justify-between text-[8px] text-zinc-500 font-semibold mt-0.5">
                  <span>{layers.ph.min}</span>
                  <span>{((layers.ph.min + layers.ph.max) / 2).toFixed(1)}</span>
                  <span>{layers.ph.max}+</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          {qualityScores
            ? [
                { c: '#059669', l: 'Sangat Baik (≥ 85)' },
                { c: '#10b981', l: 'Baik (65–84)' },
                { c: '#f59e0b', l: 'Sedang (45–64)' },
                { c: '#ef4444', l: 'Berisiko (< 45)' },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.c }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">{e.l}</span>
                </div>
              ))
            : [
                { c: '#059669', l: 'Sangat baik (≥ 0.85)' },
                { c: '#10b981', l: 'Baik (0.75–0.85)' },
                { c: '#84cc16', l: 'Cukup (0.65–0.75)' },
                { c: '#facc15', l: 'Layak (0.60–0.65)' },
              ].map((e) => (
                <div key={e.c} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.c }} />
                  <span className="text-[10px] text-zinc-500 font-semibold">{e.l}</span>
                </div>
              ))}
          <div className="flex items-center gap-2 pt-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="#0ea5e9">
              <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13" />
            </svg>
            <span className="text-[10px] text-zinc-500 font-semibold">Arah pergerakan kawanan</span>
          </div>
          {nextSchool && (
            <div className="flex items-center gap-2 pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600 border border-white flex-shrink-0" />
              <span className="text-[10px] text-zinc-500 font-semibold">Prediksi lokasi kawanan berikutnya</span>
            </div>
          )}
          {analysis.gfw && !analysis.gfw.isMock && analysis.gfw.hotspots.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600 border border-white flex-shrink-0" />
              <span className="text-[10px] text-zinc-500 font-semibold">
                Konsentrasi kapal penangkap (GFW){analysis.gfw.isMock ? ' · simulasi' : ''}
              </span>
            </div>
          )}
          {departure && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 border border-white flex-shrink-0" />
                <span className="text-[10px] text-zinc-500 font-semibold">Titik berangkat</span>
              </div>
              {targetZone && (
                <div className="flex items-center gap-2 pt-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="#0ea5e9">
                    <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13" />
                  </svg>
                  <span className="text-[10px] text-zinc-500 font-semibold">Rute menuju zona terbaik</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
