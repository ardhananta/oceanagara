'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLeaflet } from '@/components/dashboard/wave/leaflet';
import { nearestWaterPoint } from '@/components/peta-risiko/distances';

interface MapPointPickerProps {
  initialLat: number;
  initialLon: number;
  onChange: (lat: number, lon: number) => void;
}

export default function MapPointPicker({ initialLat, initialLon, onChange }: MapPointPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [point, setPoint] = useState({ lat: initialLat, lon: initialLon });
  const pointRef = useRef({ lat: initialLat, lon: initialLon });

  const updatePoint = (lat: number, lon: number) => {
    pointRef.current = { lat, lon };
    setPoint({ lat, lon });
  };

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

  // Inisialisasi peta + marker titik berangkat
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;

    const p = pointRef.current;
    const map = L.map(containerRef.current, {
      center: [p.lat, p.lon],
      zoom: 9,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:26px;height:26px;background:#0ea5e9;border:3px solid #fff;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
             </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([p.lat, p.lon], { icon, draggable: true }).addTo(map);
    marker.on('drag', () => {
      const ll = marker.getLatLng();
      updatePoint(ll.lat, ll.lng);
    });
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      updatePoint(ll.lat, ll.lng);
      onChange(ll.lat, ll.lng);
    });
    markerRef.current = marker;

    // Klik di peta → pindahkan titik berangkat
    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      const water = nearestWaterPoint(e.latlng.lat, e.latlng.lng, 8);
      const lat = water ? water.lat : e.latlng.lat;
      const lon = water ? water.lon : e.latlng.lng;
      marker.setLatLng([lat, lon]);
      updatePoint(lat, lon);
      onChange(lat, lon);
    };
    map.on('click', onClick);

    return () => {
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 font-mono">
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        Titik berangkat: {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
        <span className="ml-auto text-[9px] text-zinc-400 font-semibold hidden sm:block">klik peta untuk pindah</span>
      </div>
      <div ref={containerRef} className="w-full h-[220px] rounded-xl overflow-hidden border border-zinc-200 z-0" />
      <p className="text-[10px] text-zinc-400 italic">
        Seret marker atau klik di perairan untuk menentukan titik keberangkatan kapal.
      </p>
    </div>
  );
}
