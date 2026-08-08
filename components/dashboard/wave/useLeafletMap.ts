'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { loadLeaflet, getLeaflet } from './leaflet';

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

  // Load Leaflet JS & CSS (once, shared across remounts)
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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;

    const L = getLeaflet();
    if (!L) return;

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
