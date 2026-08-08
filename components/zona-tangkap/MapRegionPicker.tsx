'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLeaflet } from '@/components/dashboard/wave/leaflet';

export interface RegionBBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MapRegionPickerProps {
  initialBbox: RegionBBox;
  onChange: (bbox: RegionBBox) => void;
}

const CORNER_HANDLES = [
  { key: 'nw', icon: 'nw' },
  { key: 'ne', icon: 'ne' },
  { key: 'se', icon: 'se' },
  { key: 'sw', icon: 'sw' },
] as const;

type CornerKey = (typeof CORNER_HANDLES)[number]['key'];

export default function MapRegionPicker({ initialBbox, onChange }: MapRegionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rectRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRefs = useRef<Record<CornerKey, any>>({} as any);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<{ lat: number; lng: number } | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [bbox, setBbox] = useState<RegionBBox>(initialBbox);
  const bboxRef = useRef(initialBbox);

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

  const emitBbox = (b: RegionBBox) => {
    bboxRef.current = b;
    setBbox(b);
    onChange(b);
  };

  // Inisialisasi peta + rectangle yang bisa digeser & diresize
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;

    const b = bboxRef.current;
    const map = L.map(containerRef.current, {
      center: [(b.north + b.south) / 2, (b.east + b.west) / 2],
      zoom: 9,
      zoomControl: true,
      boxZoom: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;

    const makeRect = (north: number, south: number, east: number, west: number) => {
      const bounds: [[number, number], [number, number]] = [
        [south, west],
        [north, east],
      ];
      const rect = L.rectangle(bounds, {
        color: '#162e52',
        weight: 2,
        fillColor: '#162e52',
        fillOpacity: 0.12,
        draggable: true,
        bubblingMouseEvents: false,
      }).addTo(map);
      rect.on('dragend', () => {
        const bnd = rect.getBounds();
        const nb = {
          north: bnd.getNorth(),
          south: bnd.getSouth(),
          east: bnd.getEast(),
          west: bnd.getWest(),
        };
        syncHandles(nb);
        emitBbox(nb);
      });
      rectRef.current = rect;
    };

    const makeHandle = (key: CornerKey) => {
      const b = bboxRef.current;
      const pos: [number, number] =
        key === 'nw'
          ? [b.north, b.west]
          : key === 'ne'
            ? [b.north, b.east]
            : key === 'se'
              ? [b.south, b.east]
              : [b.south, b.west];
      const handle = L.circleMarker(pos, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#162e52',
        fillOpacity: 1,
        draggable: true,
      }).addTo(map);
      handle.on('drag', () => {
        const ll = handle.getLatLng();
        const cur = bboxRef.current;
        const nb = { ...cur };
        if (key === 'nw' || key === 'ne') nb.north = ll.lat;
        else nb.south = ll.lat;
        if (key === 'nw' || key === 'sw') nb.west = ll.lng;
        else nb.east = ll.lng;
        // jaga agar area tetap valid (minimal 0.05° di tiap sisi)
        if (nb.north - nb.south < 0.05) {
          nb.north = nb.south + 0.05;
        }
        if (nb.east - nb.west < 0.05) {
          nb.east = nb.west + 0.05;
        }
        rectRef.current.setBounds([
          [nb.south, nb.west],
          [nb.north, nb.east],
        ]);
        bboxRef.current = nb;
        setBbox(nb);
      });
      handle.on('dragend', () => {
        emitBbox(bboxRef.current);
        syncHandles(bboxRef.current);
      });
      handleRefs.current[key] = handle;
    };

    const syncHandles = (b: RegionBBox) => {
      if (!handleRefs.current.nw) return;
      handleRefs.current.nw.setLatLng([b.north, b.west]);
      handleRefs.current.ne.setLatLng([b.north, b.east]);
      handleRefs.current.se.setLatLng([b.south, b.east]);
      handleRefs.current.sw.setLatLng([b.south, b.west]);
    };

    makeRect(b.north, b.south, b.east, b.west);
    CORNER_HANDLES.forEach(({ key }) => makeHandle(key));

    // Mode gambar: klik dua titik untuk menentukan area
    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      if (!drawingRef.current) return;
      if (!drawStartRef.current) {
        drawStartRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };
        rectRef.current.setBounds([
          [e.latlng.lat, e.latlng.lng],
          [e.latlng.lat, e.latlng.lng],
        ]);
      } else {
        const s = drawStartRef.current;
        const nb = {
          north: Math.max(s.lat, e.latlng.lat),
          south: Math.min(s.lat, e.latlng.lat),
          east: Math.max(s.lng, e.latlng.lng),
          west: Math.min(s.lng, e.latlng.lng),
        };
        rectRef.current.setBounds([
          [nb.south, nb.west],
          [nb.north, nb.east],
        ]);
        drawStartRef.current = null;
        drawingRef.current = false;
        setDrawing(false);
        syncHandles(nb);
        emitBbox(nb);
        map.fitBounds([
          [nb.south, nb.west],
          [nb.north, nb.east],
        ]);
      }
    };
    map.on('click', onClick);

    return () => {
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      rectRef.current = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleRefs.current = {} as Record<CornerKey, any>;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  const startDrawing = () => {
    drawingRef.current = true;
    drawStartRef.current = null;
    setDrawing(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 font-mono">
          {drawing
            ? 'Klik titik pertama (pojok area), lalu klik titik kedua (pojok berseberangan).'
            : `Lu: ${bbox.north.toFixed(3)} · Ls: ${bbox.south.toFixed(3)} · Tm: ${bbox.west.toFixed(3)} · Tg: ${bbox.east.toFixed(3)}`}
        </div>
        {!drawing ? (
          <button
            type="button"
            onClick={startDrawing}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#162e52] hover:bg-[#1f4275] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v-6m-3 3h6M4.5 12.75V6.75m0 0h6M7.5 8.25h6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6.75 20.25v-3m3.75 3v-3m3.75 3v-3" />
            </svg>
            Gambar Ulang
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              drawingRef.current = false;
              drawStartRef.current = null;
              setDrawing(false);
            }}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Batal
          </button>
        )}
      </div>
      <div ref={containerRef} className="w-full h-[360px] rounded-xl overflow-hidden border border-zinc-200 z-0" />
      <p className="text-[10px] text-zinc-400 italic">
        Seret persegi untuk memindahkan area, atau seret titik sudut untuk memperbesar/mempersempit. Klik
        &quot;Gambar Ulang&quot; untuk membuat area baru dengan dua klik.
      </p>
    </div>
  );
}
