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

export default function ReportMap({ reports, onSelect, heightClass = 'h-[46vh] lg:h-[calc(100vh-300px)]' }: ReportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);

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
            `<div style="width:22px;height:22px;border-radius:9999px;background:${color};` +
            `border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: status === 'verified' ? 500 : 300,
      });
      marker.bindTooltip(
        `<div style="font-family:inherit;font-size:10px;max-width:230px;">
          <b style="color:${color}">${label}</b>
          <div style="color:#64748b;line-height:1.6;margin-top:2px;">
            ${r.wasteType.replace(/-/g, ' ')} · keyakinan ${confidence}%<br/>
            ${r.location.lat.toFixed(4)}, ${r.location.lon.toFixed(4)}<br/>
            ${formatReportDate(r.createdAt)}
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
    <div className={`rounded-2xl overflow-hidden border border-zinc-200 shadow-sm bg-white ${heightClass}`}>
      <div ref={mapRef} className="w-full h-full" />
      {reports.length === 0 && (
        <div className="absolute inset-0 z-[999] bg-white/90 flex items-center justify-center">
          <p className="text-xs text-zinc-400 font-semibold">Belum ada laporan pada filter ini</p>
        </div>
      )}
    </div>
  );
}