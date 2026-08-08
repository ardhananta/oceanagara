'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getLeaflet } from './leaflet';

export interface LeafletMap {
  mapRef: RefObject<HTMLDivElement | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapInstanceRef: RefObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layerGroupRef: RefObject<any>;
  leafletReady: boolean;
}

/** Load Leaflet JS/CSS on demand, then initialize the map instance */
export function useLeafletMap(): LeafletMap {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Load Leaflet JS & CSS
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;

    const L = getLeaflet();
    const map = L.map(mapRef.current, {
      center: [-2.5, 118.0],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © BMKG Maritim (INAWAVES / INAFLOWS)',
      maxZoom: 18,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
  }, [leafletReady]);

  return { mapRef, mapInstanceRef, layerGroupRef, leafletReady };
}
