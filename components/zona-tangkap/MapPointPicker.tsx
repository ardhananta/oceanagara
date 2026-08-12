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
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
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
      html: `<div style="width:28px;height:28px;background:#0c2d52;border:3px solid #38bdf8;border-radius:9999px;box-shadow:0 3px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c-3.9 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
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

  // Fitur Deteksi GPS Lokasi Terkini Nelayan
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGeoMsg('GPS tidak didukung oleh peramban ini.');
      return;
    }
    setGeoLoading(true);
    setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        updatePoint(lat, lon);
        onChange(lat, lon);
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([lat, lon], 12, { duration: 1 });
          markerRef.current.setLatLng([lat, lon]);
        }
        setGeoLoading(false);
        setGeoMsg('Lokasi GPS berhasil terdeteksi!');
      },
      (err) => {
        console.warn('[GPS Geolocation Error]:', err);
        setGeoLoading(false);
        setGeoMsg('Gagal mengambil GPS. Silakan aktifkan izin lokasi di HP/browser.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50 border-2 border-zinc-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-800 font-mono font-bold">
          <svg className="w-4 h-4 text-sky-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span>Koordinat: {point.lat.toFixed(4)}, {point.lon.toFixed(4)}</span>
        </div>
        <button
          type="button"
          onClick={handleDetectGPS}
          disabled={geoLoading}
          className="px-4 py-2 bg-[#0c2d52] hover:bg-[#163e6e] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow flex-shrink-0 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${geoLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2m15 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />
          </svg>
          <span>{geoLoading ? 'Mendeteksi GPS…' : 'Gunakan Lokasi GPS Terkini'}</span>
        </button>
      </div>

      {geoMsg && (
        <p className={`text-xs font-bold ${geoMsg.includes('berhasil') ? 'text-emerald-700' : 'text-amber-700'}`}>
          {geoMsg}
        </p>
      )}

      {/* Map Display Container (Perbesar tinggi peta) */}
      <div ref={containerRef} className="w-full h-[320px] rounded-xl overflow-hidden border-2 border-zinc-200 z-0 shadow-inner" />
      <p className="text-xs text-zinc-500 font-medium">
        Klik tombol GPS di atas untuk mendeteksi posisi Anda saat ini, atau geser marker biru di peta untuk berpindah pelabuhan.
      </p>
    </div>
  );
}
