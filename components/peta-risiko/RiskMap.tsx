'use client';

import { useEffect, useRef, useState } from 'react';
import type { RiskPoint } from '@/app/types/maritime';

interface RiskMapProps {
  riskPoints: RiskPoint[];
  centerLat: number;
  centerLon: number;
  regionName: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const RISK_LABEL: Record<string, string> = {
  critical: 'KRITIS',
  high: 'TINGGI',
  medium: 'SEDANG',
  low: 'RENDAH',
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

export default function RiskMap({ riskPoints, centerLat, centerLon, regionName }: RiskMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<RiskPoint | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Load Leaflet CSS + JS dynamically
  useEffect(() => {
    if (document.getElementById('leaflet-css')) {
      const timer = setTimeout(() => setLeafletReady(true), 0);
      return () => clearTimeout(timer);
    }

    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map once Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [centerLat, centerLon],
      zoom: 9,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
  }, [leafletReady, centerLat, centerLon]);

  // Add risk point markers whenever data changes
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || riskPoints.length === 0) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    riskPoints.forEach((point, idx) => {
      const color = RISK_COLORS[point.riskLevel] ?? '#6b7280';
      const size = point.riskLevel === 'critical' ? 24 : point.riskLevel === 'high' ? 20 : 16;

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:3px solid rgba(255,255,255,0.9);
            border-radius:50%;
            box-shadow:0 0 ${size}px ${color}88,0 2px 8px rgba(0,0,0,0.5);
            cursor:pointer;
            animation: pulse-ring 2s ease-in-out infinite;
          "></div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([point.lat, point.lon], { icon });
      marker.addTo(map);
      marker.on('click', () => setSelectedPoint(point));

      // Rank label
      const labelIcon = L.divIcon({
        className: '',
        html: `<span style="
          background:rgba(15,23,42,0.85);
          color:#fff;font-size:10px;font-weight:700;
          padding:2px 5px;border-radius:4px;
          border:1px solid ${color};
          white-space:nowrap;pointer-events:none;
        ">#${idx + 1}</span>`,
        iconSize: [24, 16],
        iconAnchor: [-4, 8],
      });
      L.marker([point.lat, point.lon], { icon: labelIcon, interactive: false }).addTo(map);
    });

    // Fit bounds to all points
    if (riskPoints.length > 0) {
      const bounds = L.latLngBounds(riskPoints.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [leafletReady, riskPoints]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map container */}
      <div ref={mapRef} className="flex-1 w-full rounded-xl overflow-hidden" style={{ minHeight: 420 }} />

      {/* Legend */}
      <div className="absolute top-4 left-4 z-[999] bg-[#0f172a]/90 backdrop-blur border border-white/10 rounded-xl px-4 py-3 space-y-2 shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-1">Tingkat Risiko</p>
        {Object.entries(RISK_LABEL).map(([level, label]) => (
          <div key={level} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[level] }} />
            <span className="text-[11px] text-white/80 font-semibold">{label}</span>
          </div>
        ))}
      </div>

      {/* Region label */}
      <div className="absolute top-4 right-4 z-[999] bg-[#0f172a]/90 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
        <p className="text-[10px] text-sky-300 font-bold uppercase tracking-widest">Wilayah Analisis</p>
        <p className="text-xs text-white font-semibold mt-0.5">{regionName}</p>
      </div>

      {/* Selected point popup */}
      {selectedPoint && (
        <div className="absolute bottom-4 left-4 right-4 z-[999] bg-[#0f172a]/95 backdrop-blur border rounded-xl p-4 shadow-2xl"
          style={{ borderColor: RISK_COLORS[selectedPoint.riskLevel] + '60' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[selectedPoint.riskLevel] }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: RISK_COLORS[selectedPoint.riskLevel] }}>
                  {RISK_LABEL[selectedPoint.riskLevel]} — Skor {selectedPoint.riskScore}/100
                </span>
              </div>
              <p className="text-sm font-bold text-white">{selectedPoint.riskType}</p>
              <p className="text-xs text-white/70 leading-relaxed mt-1 line-clamp-3">{selectedPoint.description}</p>
              <p className="text-[10px] text-sky-400 mt-2 font-mono">
                {selectedPoint.lat.toFixed(5)}, {selectedPoint.lon.toFixed(5)}
              </p>
            </div>
            <button onClick={() => setSelectedPoint(null)} className="text-white/40 hover:text-white text-lg leading-none flex-shrink-0">×</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
