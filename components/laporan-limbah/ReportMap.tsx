'use client';

import { useEffect, useRef, useState } from 'react';
import type { WasteReportEntry } from '@/app/service/wasteReports';
import { formatReportDate } from '@/app/service/wasteReports';
import { loadLeaflet } from '@/components/dashboard/wave/leaflet';

const STATUS_COLORS: Record<string, string> = {
  verified: '#059669',
  suspected: '#f59e0b',
  rejected: '#ef4444',
  pending: '#64748b',
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Terverifikasi',
  suspected: 'Perlu Diuji',
  rejected: 'Ditolak',
  pending: 'Belum Divalidasi',
};

interface ReportMapProps {
  reports: WasteReportEntry[];
  onSelect: (report: WasteReportEntry) => void;
  heightClass?: string;
}

export default function ReportMap({ reports, onSelect, heightClass = 'h-[48vh] lg:h-[calc(100vh-280px)]' }: ReportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chlOverlayRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [showChlorophyll, setShowChlorophyll] = useState(true);
  const [loadingChl, setLoadingChl] = useState(false);

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

  // Inisialisasi peta Leaflet
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [-2.5, 118],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;
  }, [leafletReady]);

  // Overlay Citra Satelit Klorofil-a (Berbasis API /api/maritime/kualitas-ikan)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map) return;
    const L = window.L;

    if (chlOverlayRef.current) {
      map.removeLayer(chlOverlayRef.current);
      chlOverlayRef.current = null;
    }

    if (!showChlorophyll) return;

    let cancelled = false;
    setLoadingChl(true);

    // Tentukan Bounding Box (Default seluruh Indonesia atau disesuaikan dengan laporan)
    let north = 6.0, south = -11.0, east = 141.0, west = 95.0;
    if (reports.length > 0) {
      const lats = reports.map((r) => r.location.lat);
      const lons = reports.map((r) => r.location.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      north = Math.min(6, maxLat + 2.5);
      south = Math.max(-11, minLat - 2.5);
      east = Math.min(141, maxLon + 3.5);
      west = Math.max(95, minLon - 3.5);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    fetch(`/api/maritime/kualitas-ikan?north=${north}&south=${south}&east=${east}&west=${west}&date=${todayStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLoadingChl(false);
        if (data?.layers?.chl?.dataUrl) {
          const dataUrl = data.layers.chl.dataUrl;
          const b = data.bbox || { north, south, east, west };
          const bounds: [[number, number], [number, number]] = [
            [b.south, b.west],
            [b.north, b.east],
          ];
          const imgLayer = L.imageOverlay(dataUrl, bounds, {
            opacity: 0.68,
            interactive: false,
          });
          imgLayer.addTo(map);
          chlOverlayRef.current = imgLayer;
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadingChl(false);
        console.warn('[ReportMap] Satellite Chlorophyll overlay fetch error:', err);
      });

    return () => {
      cancelled = true;
      if (chlOverlayRef.current) {
        map.removeLayer(chlOverlayRef.current);
        chlOverlayRef.current = null;
      }
    };
  }, [leafletReady, showChlorophyll, reports]);

  // Markers Laporan Limbah
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!leafletReady || !map) return;
    const L = window.L;

    markersRef.current.forEach((m) => m?.remove?.());
    markersRef.current = [];

    if (reports.length === 0) return;

    const latLngs: [number, number][] = [];

    reports.forEach((r) => {
      const { lat, lon } = r.location;
      latLngs.push([lat, lon]);
      const status = r.validation?.status ?? 'pending';
      const color = STATUS_COLORS[status] ?? '#64748b';
      const label = STATUS_LABELS[status] ?? 'Belum Divalidasi';
      const confidence = r.validation?.confidence ?? 0;
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: '',
          html:
            `<div style="width:24px;height:24px;border-radius:9999px;background:${color};` +
            `border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: status === 'verified' ? 500 : 300,
      });
      marker.bindTooltip(
        `<div style="font-family:inherit;font-size:10px;max-width:230px;">
          <b style="color:${color}">${label}</b>
          <div style="color:#162e52;font-weight:600;line-height:1.6;margin-top:2px;">
            ${r.wasteType.replace(/-/g, ' ')} · AI ${confidence}%<br/>
            📍 ${r.location.lat.toFixed(4)}, ${r.location.lon.toFixed(4)}<br/>
            📅 ${formatReportDate(r.createdAt || r.capturedAt)}
          </div>
        </div>`,
        { direction: 'top', opacity: 0.96 }
      );
      marker.on('click', () => onSelect(r));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
    } else if (latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 14 });
    }
    return () => {
      markersRef.current.forEach((m) => m?.remove?.());
      markersRef.current = [];
    };
  }, [leafletReady, reports, onSelect]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm bg-white ${heightClass}`}>
      <div ref={mapRef} className="w-full h-full" />

      {/* Layer Control Button */}
      <div className="absolute top-3 right-3 z-[400] bg-white/95 border border-zinc-200 rounded-xl p-1.5 shadow-md flex items-center gap-2 text-xs font-extrabold text-[#162e52]">
        <button
          type="button"
          onClick={() => setShowChlorophyll(!showChlorophyll)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs ${
            showChlorophyll
              ? 'bg-[#162e52] text-white border-[#162e52]'
              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <svg className={`w-4 h-4 text-emerald-400 ${loadingChl ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
          </svg>
          {loadingChl ? 'Memuat Satelit...' : 'Layer Klorofil (Satelit)'}
        </button>
      </div>

      {/* Legend Klorofil */}
      {showChlorophyll && (
        <div className="absolute bottom-6 left-3 z-[400] bg-white/95 border border-zinc-200 rounded-xl p-2.5 shadow-md space-y-1.5 max-w-[210px]">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52] flex items-center justify-between">
            <span>Kadar Klorofil-a</span>
            <span className="text-zinc-400 text-[9px]">Satelit NASA</span>
          </p>
          <div className="h-2 rounded-full bg-gradient-to-r from-blue-700 via-cyan-400 via-emerald-400 via-yellow-400 to-red-600" />
          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-600 font-mono">
            <span>0.05</span>
            <span>0.5</span>
            <span>2.0</span>
            <span>10.0 mg/m³</span>
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="absolute inset-0 z-[399] bg-white/90 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-zinc-500 font-bold bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">
            Tidak ada laporan pada tanggal / filter ini
          </p>
        </div>
      )}
    </div>
  );
}