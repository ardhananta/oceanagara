'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLeaflet } from '@/components/dashboard/wave/leaflet';

interface LocationPickerMapProps {
  initialLat?: number | null;
  initialLon?: number | null;
  onSelectLocation: (lat: number, lon: number) => void;
}

export default function LocationPickerMap({
  initialLat,
  initialLon,
  onSelectLocation,
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(
    initialLat != null && initialLon != null ? { lat: initialLat, lon: initialLon } : null
  );

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

    const startLat = initialLat ?? -2.5;
    const startLon = initialLon ?? 118;
    const startZoom = initialLat != null && initialLon != null ? 12 : 5;

    const map = L.map(mapRef.current, {
      center: [startLat, startLon],
      zoom: startZoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const customIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:32px;height:32px;display:flex;items-center;justify-content:center;">
          <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;">
            <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    let marker: any = null;
    if (initialLat != null && initialLon != null) {
      marker = L.marker([initialLat, initialLon], { icon: customIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const lat = +pos.lat.toFixed(6);
        const lon = +pos.lng.toFixed(6);
        setSelectedCoords({ lat, lon });
        onSelectLocation(lat, lon);
      });
      markerRef.current = marker;
    }

    // Klik peta untuk memindahkan marker
    map.on('click', (e: any) => {
      const lat = +e.latlng.lat.toFixed(6);
      const lon = +e.latlng.lng.toFixed(6);
      setSelectedCoords({ lat, lon });
      onSelectLocation(lat, lon);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        const newMarker = L.marker([lat, lon], { icon: customIcon, draggable: true }).addTo(map);
        newMarker.on('dragend', () => {
          const pos = newMarker.getLatLng();
          const pLat = +pos.lat.toFixed(6);
          const pLon = +pos.lng.toFixed(6);
          setSelectedCoords({ lat: pLat, lon: pLon });
          onSelectLocation(pLat, pLon);
        });
        markerRef.current = newMarker;
      }
    });

    mapInstanceRef.current = map;
  }, [leafletReady, initialLat, initialLon, onSelectLocation]);

  // Update marker jika initialLat/Lon berubah dari luar
  useEffect(() => {
    if (!mapInstanceRef.current || initialLat == null || initialLon == null) return;
    const L = window.L;
    if (!L) return;

    setSelectedCoords({ lat: initialLat, lon: initialLon });

    if (markerRef.current) {
      markerRef.current.setLatLng([initialLat, initialLon]);
    } else {
      const customIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:32px;height:32px;display:flex;items-center;justify-content:center;">
            <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;">
              <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const newMarker = L.marker([initialLat, initialLon], { icon: customIcon, draggable: true }).addTo(
        mapInstanceRef.current
      );
      newMarker.on('dragend', () => {
        const pos = newMarker.getLatLng();
        const pLat = +pos.lat.toFixed(6);
        const pLon = +pos.lng.toFixed(6);
        setSelectedCoords({ lat: pLat, lon: pLon });
        onSelectLocation(pLat, pLon);
      });
      markerRef.current = newMarker;
    }
  }, [initialLat, initialLon, onSelectLocation]);

  return (
    <div className="space-y-2">
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-zinc-300 shadow-sm bg-zinc-100">
        <div ref={mapRef} className="w-full h-full" />
        {!leafletReady && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-zinc-600">Memuat Peta Interaktif…</span>
          </div>
        )}
        <div className="absolute top-3 left-3 z-[400] bg-[#162e52] text-white px-3 py-1.5 rounded-lg text-[10px] font-extrabold shadow-sm flex items-center gap-1.5 pointer-events-none">
          <svg className="w-3.5 h-3.5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          Klik atau geser penanda merah di peta
        </div>
      </div>

      {selectedCoords && (
        <div className="p-2.5 rounded-xl bg-white border border-zinc-300 flex items-center justify-between text-xs text-zinc-900 font-bold shadow-sm">
          <span className="flex items-center gap-1.5 text-[#162e52]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            Titik Ditandai di Peta:
          </span>
          <span className="font-mono text-[#162e52] font-black">
            {selectedCoords.lat.toFixed(5)}, {selectedCoords.lon.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
