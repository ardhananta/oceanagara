'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { calcDynamicRadius, getCardinalInfo, msToKnots, waveDangerInfo, waveStrokeColor, windStrokeColor } from './calculations';
import { getLeaflet } from './leaflet';
import type { WaveRegionPoint } from './types';

export type MapViewMode = 'wave' | 'wind';

interface UseMapLayersParams {
  leafletReady: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapInstanceRef: RefObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layerGroupRef: RefObject<any>;
  regionPoints: WaveRegionPoint[];
  filterRegion: string;
  showCoverageRadius: boolean;
  mapViewMode: MapViewMode;
  onSelectPoint: (pt: WaveRegionPoint) => void;
}

/** Render telemetry markers + dynamic coverage-radius circles for all regions */
export function useMapLayers({
  leafletReady,
  mapInstanceRef,
  layerGroupRef,
  regionPoints,
  filterRegion,
  showCoverageRadius,
  mapViewMode,
  onSelectPoint,
}: UseMapLayersParams) {
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !layerGroupRef.current) return;

    const L = getLeaflet();
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    layerGroup.clearLayers();

    const activePoints =
      filterRegion === 'all'
        ? regionPoints
        : regionPoints.filter((p) => p.id === filterRegion);

    activePoints.forEach((pt) => {
      const forecast = pt.data?.forecasts?.[0];

      // No real telemetry: render a neutral marker instead of fake values.
      if (!forecast) {
        const noDataHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <span class="absolute h-2.5 w-2.5 rounded-full opacity-70 ${pt.loading ? 'animate-ping' : ''}" style="background:#a1a1aa;margin-bottom:26px;"></span>
            <div style="
              background:#f4f4f5;
              color:#a1a1aa;
              border:1.5px solid #d4d4d8;
              font-size:11px;
              font-weight:700;
              padding:4px 9px;
              border-radius:8px;
              box-shadow:0 2px 6px rgba(0,0,0,0.15);
              white-space:nowrap;
              display:flex;
              align-items:center;
              gap:6px;
              font-family:inherit;
            ">
              <span style="width:7px;height:7px;border-radius:50%;background:#a1a1aa;display:inline-block;"></span>
              <span>${pt.loading ? 'Memuat…' : pt.failed ? 'Gagal dimuat' : 'No data'}</span>
            </div>
          </div>
        `;
        const noDataIcon = L.divIcon({
          className: '',
          html: noDataHtml,
          iconSize: [110, 28],
          iconAnchor: [55, 14],
        });
        const noDataMarker = L.marker([pt.lat, pt.lon], { icon: noDataIcon });
        noDataMarker.bindTooltip(`<b>${pt.name}</b><br/>Telemetri BMKG ${pt.loading ? 'belum dimuat' : pt.failed ? 'gagal dimuat' : 'tidak tersedia'}`, {
          direction: 'top',
          offset: [0, -14],
          opacity: 0.95,
        });
        noDataMarker.on('click', () => onSelectPoint(pt));
        layerGroup.addLayer(noDataMarker);
        return;
      }

      const waveHeight = forecast.waveHeight;
      const wavePeriod = forecast.wavePeriod;
      const windSpeed = forecast.windSpeed;
      const windDir = forecast.windDirection;
      const windKnots = msToKnots(windSpeed);
      const headingDir = (windDir + 180) % 360;

      const dynamicRadiusKm = calcDynamicRadius(pt.baseRadiusKm, waveHeight, windSpeed, wavePeriod);
      const strokeColor = waveStrokeColor(waveHeight);

      // Coverage Radius Circle
      if (showCoverageRadius) {
        const radiusInMeters = dynamicRadiusKm * 1000;
        const circle = L.circle([pt.lat, pt.lon], {
          radius: radiusInMeters,
          color: strokeColor,
          weight: 1.5,
          dashArray: '4, 6',
          fillColor: strokeColor,
          fillOpacity: 0.08,
        });

        circle.on('click', () => onSelectPoint(pt));
        layerGroup.addLayer(circle);

        const innerCircle = L.circle([pt.lat, pt.lon], {
          radius: radiusInMeters * 0.35,
          color: strokeColor,
          weight: 1,
          fillColor: strokeColor,
          fillOpacity: 0.15,
        });
        layerGroup.addLayer(innerCircle);
      }

      const tooltipHtml = `<b>${pt.name}</b><br/>Gelombang: ${waveHeight.toFixed(1)} m &bull; Periode: ${wavePeriod.toFixed(1)} s &bull; Angin: ${windKnots} kt (${windSpeed} m/s)`;

      // Telemetry Marker Badge (Wind & Wave Mode)
      if (mapViewMode === 'wind') {
        const windColor = windStrokeColor(windKnots);

        const windBadgeHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div style="
              background:#0f172a;
              color:${windColor};
              border:1.5px solid ${windColor};
              font-size:11px;
              font-weight:700;
              padding:4px 9px;
              border-radius:8px;
              box-shadow:0 3px 10px rgba(0,0,0,0.3);
              white-space:nowrap;
              display:flex;
              align-items:center;
              gap:6px;
              font-family:inherit;
            ">
              <svg style="width:14px;height:14px;transform:rotate(${headingDir}deg);flex-shrink:0;transition:transform 0.3s;" viewBox="0 0 24 24" fill="none" stroke="${windColor}" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 20V4M7 9l5-5 5 5" />
              </svg>
              <span style="color:#ffffff;">${windKnots} kt</span>
              <span style="color:#94a3b8;font-size:9px;">${windSpeed}m/s</span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: '',
          html: windBadgeHtml,
          iconSize: [110, 28],
          iconAnchor: [55, 14],
        });

        const marker = L.marker([pt.lat, pt.lon], { icon });
        marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -14], opacity: 0.95 });
        marker.on('click', () => onSelectPoint(pt));
        layerGroup.addLayer(marker);
      } else {
        const danger = waveDangerInfo(waveHeight, wavePeriod);
        const iconHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <span class="animate-ping absolute h-3 w-3 rounded-full opacity-60" style="background:${strokeColor};margin-bottom:26px;"></span>
            <div style="
              background:#ffffff;
              color:#0f172a;
              border:1.5px solid ${strokeColor};
              font-size:11px;
              font-weight:700;
              padding:3px 8px;
              border-radius:6px;
              box-shadow:0 2px 6px rgba(0,0,0,0.12);
              white-space:nowrap;
              display:flex;
              align-items:center;
              gap:6px;
              font-family:inherit;
            ">
              <span style="width:7px;height:7px;border-radius:50%;background:${strokeColor};display:inline-block;"></span>
              <span>${waveHeight.toFixed(1)} m</span>
              <span style="color:#64748b;font-size:10px;">${wavePeriod.toFixed(1)}s</span>
              <span style="color:${danger.color};font-size:9px;text-transform:uppercase;">${danger.label}</span>
              <span style="color:#64748b;display:inline-flex;align-items:center;" title="Arah Vektor: ${windDir}° (Ke ${getCardinalInfo(headingDir).full})">
                <svg style="width:12px;height:12px;transform:rotate(${headingDir}deg);transition:transform 0.3s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 20V4M7 9l5-5 5 5" />
                </svg>
              </span>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [130, 26],
          iconAnchor: [65, 13],
        });

        const marker = L.marker([pt.lat, pt.lon], { icon });
        marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -14], opacity: 0.95 });
        marker.on('click', () => onSelectPoint(pt));
        layerGroup.addLayer(marker);
      }
    });

    if (filterRegion !== 'all' && activePoints.length > 0) {
      map.flyTo([activePoints[0].lat, activePoints[0].lon], 7, { duration: 0.8 });
    }
  }, [leafletReady, regionPoints, filterRegion, showCoverageRadius, mapViewMode, mapInstanceRef, layerGroupRef, onSelectPoint]);
}
