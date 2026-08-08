'use client';

import { useCallback, useState } from 'react';
import { INDONESIA_MARINE_REGIONS, LONG_PERIOD_SWELL_S } from './wave/constants';
import {
  buildTrendPeriodPoints,
  buildTrendPoints,
  calcDynamicRadius,
  formatBaserun,
  formatCountdown,
  formatForecastTime,
  getCardinalInfo,
  isLongPeriodSwell,
  msToKnots,
  waveDangerInfo,
  waveStrokeColor,
} from './wave/calculations';
import type { WaveRegionPoint } from './wave/types';
import { useLeafletMap } from './wave/useLeafletMap';
import { useMapLayers, type MapViewMode } from './wave/useMapLayers';
import { useVelocityCanvas } from './wave/useVelocityCanvas';
import { useWaveMapData } from './wave/useWaveMapData';

export default function WaveMap() {
  const {
    regionPoints,
    windGrid,
    windFieldMeta,
    lastUpdatedTime,
    autoRefreshCountdown,
    isLoading,
    isRefreshing,
    fetchError,
    refreshAll,
  } = useWaveMapData();
  const { mapRef, mapInstanceRef, layerGroupRef, leafletReady } = useLeafletMap();

  const [selectedPoint, setSelectedPoint] = useState<WaveRegionPoint | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('wind');
  const [showCoverageRadius, setShowCoverageRadius] = useState<boolean>(true);

  const handleSelectPoint = useCallback((pt: WaveRegionPoint) => setSelectedPoint(pt), []);

  useMapLayers({
    leafletReady,
    mapInstanceRef,
    layerGroupRef,
    regionPoints,
    filterRegion,
    showCoverageRadius,
    mapViewMode,
    onSelectPoint: handleSelectPoint,
  });
  useVelocityCanvas({ leafletReady, mapInstanceRef, mapViewMode, windGrid });

  const windGridMissing = windFieldMeta?.source !== 'bmkg-inawaves' || !windGrid;
  const dangerousRegions = regionPoints
    .filter((p) => (p.data?.forecasts?.[0]?.waveHeight ?? 0) >= 2.5)
    .map((p) => p.name.split('(')[0].trim());

  // Long-period swell detection (wave mean period ≥ 12s with ≥ moderate waves)
  const swellRegions = regionPoints
    .filter((p) => {
      const f = p.data?.forecasts?.[0];
      return isLongPeriodSwell(f?.waveHeight ?? 0, f?.wavePeriod ?? 7);
    })
    .map((p) => p.name.split('(')[0].trim());

  // Selected point forecast trend series for the mini chart
  const selectedForecasts = selectedPoint?.data?.forecasts ?? [];
  const trendPoints = buildTrendPoints(selectedForecasts);
  const trendPeriodPoints = buildTrendPeriodPoints(selectedForecasts);

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5 font-sans text-zinc-900">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-xs ${windGridMissing ? 'bg-amber-600' : 'bg-[#162e52]'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${windGridMissing ? 'bg-amber-200' : 'bg-sky-400'}`} />
              BMKG Pusmar API23 • Velocity Streamline Engine
            </span>
            {lastUpdatedTime && (
              <span className="text-[10px] font-mono text-zinc-400">
                Pembaruan: {lastUpdatedTime}
              </span>
            )}
            {windFieldMeta?.baserun && (
              <span className="text-[10px] font-mono text-zinc-400" title="Modelrun BMKG INAWAVES">
                Modelrun: {formatBaserun(windFieldMeta.baserun)}
              </span>
            )}
            <span className="text-[10px] font-mono text-zinc-400" title="Auto-refresh data BMKG">
              Auto {formatCountdown(autoRefreshCountdown)}
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#162e52] tracking-tight">
            Prakiraan Tinggi Gelombang &amp; Arah Angin
          </h3>
        </div>

        {/* View Mode Switcher & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Mode Switcher Tabs */}
          <div className="bg-zinc-100 p-1 rounded-xl flex items-center border border-zinc-200">
            <button
              onClick={() => setMapViewMode('wave')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mapViewMode === 'wave'
                ? 'bg-[#162e52] text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
                }`}
            >
              Tinggi Gelombang
            </button>
            <button
              onClick={() => setMapViewMode('wind')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mapViewMode === 'wind'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
                }`}
            >
              Arah Angin
            </button>
          </div>

          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-3.5 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 bg-white focus:outline-none focus:border-[#162e52] transition-colors"
          >
            <option value="all">Seluruh Wilayah Perairan</option>
            {INDONESIA_MARINE_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCoverageRadius((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${showCoverageRadius
              ? 'bg-[#162e52] text-white border-[#162e52]'
              : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
              }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Jangkauan Radius</span>
          </button>

          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            title="Refresh Data BMKG"
            className="p-2 border border-zinc-300 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-700 flex-shrink-0 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* Danger Alert Strip */}
      {(dangerousRegions.length > 0 || swellRegions.length > 0) && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            {dangerousRegions.length > 0 && (
              <>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
                  Peringatan: Gelombang Tinggi (&ge; 2.5 m) Terdeteksi
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  {dangerousRegions.join(' • ')}. Hati-hati untuk pelayaran dan aktivitas laut.
                </p>
              </>
            )}
            {swellRegions.length > 0 && (
              <>
                <p className={`text-xs font-bold uppercase tracking-wider ${dangerousRegions.length > 0 ? 'text-orange-700 mt-1.5' : 'text-orange-700'}`}>
                  Peringatan: Swell Periode Panjang (&ge; {LONG_PERIOD_SWELL_S}s)
                </p>
                <p className="text-[11px] text-orange-700 mt-0.5">
                  {swellRegions.join(' • ')}. Gelombang periode panjang berisiko tinggi bagi kapal kecil &amp; wilayah pesisir.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {windGridMissing && mapViewMode === 'wind' && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Grid angin INAWAVES tidak dapat diambil dari BMKG saat ini, sehingga animasi streamline tidak tersedia.
            Data badge marker tetap dari API BMKG bila berhasil dimuat.
          </p>
        </div>
      )}

      {fetchError && (
        <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-[11px] text-orange-700">
            Seluruh permintaan telemetri BMKG gagal. Kemungkinan server BMKG tidak terjangkau — coba refresh secara manual.
          </p>
        </div>
      )}

      {/* Map & Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Map Container */}
        <div className="lg:col-span-8 relative rounded-xl overflow-hidden border border-zinc-200 min-h-[460px] bg-zinc-100">
          <div ref={mapRef} className="w-full h-full min-h-[460px]" />

          {/* Minimal Legend matching BMKG Web Scale Bar */}
          <div className="absolute top-3 left-3 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl p-3 shadow-sm space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              {mapViewMode === 'wave' ? 'Skala Tinggi Gelombang BMKG' : 'Skala Kecepatan Angin (Knots)'}
            </p>
            {mapViewMode === 'wave' ? (
              [
                { color: '#10b981', label: '0.5 - 1.25 m (Rendah)' },
                { color: '#f59e0b', label: '1.25 - 2.50 m (Sedang)' },
                { color: '#f97316', label: '2.50 - 4.00 m (Tinggi)' },
                { color: '#ef4444', label: '> 4.00 m (Sangat Tinggi)' },
              ].map((leg) => (
                <div key={leg.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: leg.color }} />
                  <span className="text-[10px] text-zinc-700 font-semibold">{leg.label}</span>
                </div>
              ))
            ) : (
              [
                { color: '#0284c7', label: '< 10 kt (Angin Sepoi)' },
                { color: '#10b981', label: '10 - 20 kt (Angin Sedang)' },
                { color: '#f59e0b', label: '20 - 30 kt (Angin Kencang)' },
                { color: '#ef4444', label: '> 30 kt (Badai / Ekstrem)' },
              ].map((leg) => (
                <div key={leg.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: leg.color }} />
                  <span className="text-[10px] text-zinc-700 font-semibold">{leg.label}</span>
                </div>
              ))
            )}
            {mapViewMode === 'wave' && (
              <p className="text-[9px] text-zinc-500 font-semibold pt-1 border-t border-zinc-100">
                Periode rata-rata: {LONG_PERIOD_SWELL_S}s+ = swell panjang (berbahaya)
              </p>
            )}
            {mapViewMode === 'wind' && windGridMissing && (
              <p className="text-[9px] text-amber-600 font-bold pt-1 border-t border-zinc-100 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Animasi tidak tersedia (grid BMKG belum dimuat)
              </p>
            )}
          </div>

          {/* Selected Region Info Drawer */}
          {selectedPoint && selectedPoint.data?.forecasts?.[0] && (
            <div className="absolute bottom-3 left-3 right-3 z-[999] bg-white border border-zinc-200 rounded-xl p-4 shadow-lg text-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#162e52]">
                        {selectedPoint.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#162e52] text-white">
                        BMKG Verified
                      </span>
                      {(() => {
                        const danger = waveDangerInfo(selectedPoint.data!.forecasts![0].waveHeight, selectedPoint.data!.forecasts![0].wavePeriod);
                        return (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border" style={{ color: danger.color, borderColor: danger.color, background: `${danger.color}14` }}>
                            {danger.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">
                        {selectedPoint.lat.toFixed(2)}, {selectedPoint.lon.toFixed(2)}
                      </span>
                      <button
                        onClick={() => setSelectedPoint(null)}
                        className="text-zinc-400 hover:text-zinc-800 p-1"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                    <span>Valid: {formatForecastTime(selectedPoint.data.forecasts[0].time)}</span>
                    <span>•</span>
                    <span>{selectedPoint.data.forecasts.length} titik prakiraan BMKG</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tinggi Gelombang</span>
                      <span className="text-base font-extrabold text-[#162e52]">
                        {selectedPoint.data.forecasts[0].waveHeight.toFixed(2)} m
                      </span>
                    </div>

                    <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Kecepatan &amp; Vektor Angin</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <svg
                          className="w-4 h-4 text-sky-600 flex-shrink-0 transition-transform"
                          style={{ transform: `rotate(${(selectedPoint.data.forecasts[0].windDirection + 180) % 360}deg)` }}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4M7 9l5-5 5 5" />
                        </svg>
                        <span className="text-xs font-extrabold text-zinc-800">
                          {msToKnots(selectedPoint.data.forecasts[0].windSpeed)} kt
                        </span>
                        <span className="text-[10px] text-zinc-500 font-normal">({selectedPoint.data.forecasts[0].windSpeed} m/s)</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                        Dari {getCardinalInfo(selectedPoint.data.forecasts[0].windDirection).full} ({selectedPoint.data.forecasts[0].windDirection}°)
                      </span>
                    </div>

                    <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Jangkauan Radius Area</span>
                      <span className="text-base font-extrabold text-zinc-800">
                        {calcDynamicRadius(selectedPoint.baseRadiusKm, selectedPoint.data.forecasts[0].waveHeight, selectedPoint.data.forecasts[0].windSpeed, selectedPoint.data.forecasts[0].wavePeriod)} km
                      </span>
                    </div>

                    <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Periode Gelombang</span>
                      <span className="text-base font-extrabold text-[#162e52]">
                        {(selectedPoint.data.forecasts[0].wavePeriod ?? 7).toFixed(1)} s
                      </span>
                      <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
                        Swell: {(selectedPoint.data.forecasts[0].swellPeriod ?? 7).toFixed(1)}s
                        {(selectedPoint.data.forecasts[0].wavePeriod ?? 7) >= LONG_PERIOD_SWELL_S && (
                          <span className="text-orange-600 font-bold"> • Panjang</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Forecast Trend Mini Chart */}
                  {trendPoints.length > 1 && (
                    <div className="bg-zinc-50 rounded-lg border border-zinc-100 p-2.5">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5">
                        Tren Tinggi Gelombang &amp; Periode (Prakiraan BMKG)
                      </span>
                      <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="w-full h-11">
                        <polyline
                          points={trendPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#162e52"
                          strokeWidth={1.6}
                          vectorEffect="non-scaling-stroke"
                        />
                        {trendPoints.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={1.8}
                            fill={waveStrokeColor(p.value)}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                        <polyline
                          points={trendPeriodPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth={1.2}
                          strokeDasharray="2, 2"
                          vectorEffect="non-scaling-stroke"
                        />
                        {trendPeriodPoints.map((p, i) => (
                          <circle
                            key={`p${i}`}
                            cx={p.x}
                            cy={p.y}
                            r={1.3}
                            fill={p.long ? '#f97316' : '#94a3b8'}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                      <div className="flex justify-between text-[9px] font-mono text-zinc-400 mt-0.5">
                        <span>{formatForecastTime(selectedForecasts[0].time)}</span>
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 border-t-2 border-[#162e52] inline-block" /> Tinggi
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 border-t-2 border-dashed border-zinc-400 inline-block" /> Periode
                          </span>
                        </span>
                        <span>{formatForecastTime(selectedForecasts[selectedForecasts.length - 1].time)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: Region Directory */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#162e52] uppercase tracking-wider">
                Daftar Telemetri BMKG
              </h4>
              <span className="text-[10px] font-bold text-zinc-400">
                {regionPoints.length} Sektor
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin pr-1">
              {isLoading && (
                <>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-zinc-200 rounded-lg p-3 animate-pulse">
                      <div className="h-3 w-32 bg-zinc-200 rounded mb-2" />
                      <div className="h-2.5 w-40 bg-zinc-100 rounded" />
                    </div>
                  ))}
                </>
              )}
              {regionPoints.map((pt) => {
                const hasData = Boolean(pt.data?.forecasts?.length);
                const wh = pt.data?.forecasts?.[0]?.waveHeight ?? 0;
                const wp = pt.data?.forecasts?.[0]?.wavePeriod ?? 0;
                const windDir = pt.data?.forecasts?.[0]?.windDirection ?? 0;
                const windSpd = pt.data?.forecasts?.[0]?.windSpeed ?? 0;
                const windKt = msToKnots(windSpd);
                const headingDir = (windDir + 180) % 360;

                let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (wh >= 1.25 && wh < 2.5) badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                if (wh >= 2.5) badgeStyle = 'bg-red-50 text-red-700 border-red-200';
                // Long-period swell escalation also flags the badge
                if (isLongPeriodSwell(wh, wp) && wh < 2.5) badgeStyle = 'bg-orange-50 text-orange-700 border-orange-200';

                const isSelected = selectedPoint?.id === pt.id;

                return (
                  <div
                    key={pt.id}
                    onClick={() => {
                      setSelectedPoint(pt);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([pt.lat, pt.lon], 7, { duration: 0.8 });
                      }
                    }}
                    className={`cursor-pointer flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected
                      ? 'bg-[#162e52] text-white border-[#162e52]'
                      : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-900'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-semibold truncate max-w-[150px]">{pt.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {hasData ? (
                          <>
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-sky-200' : 'text-zinc-500'}`}>
                              {windKt} kt ({getCardinalInfo(windDir).abbr})
                            </span>
                            <span className="text-zinc-300">•</span>
                            <div className="flex items-center gap-1 text-[10px] font-semibold">
                              <svg
                                className={`w-3 h-3 transition-transform ${isSelected ? 'text-sky-300' : 'text-sky-600'}`}
                                style={{ transform: `rotate(${headingDir}deg)` }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4M7 9l5-5 5 5" />
                              </svg>
                              <span className={isSelected ? 'text-white' : 'text-zinc-700'}>{windSpd} m/s</span>
                            </div>
                            <span className="text-zinc-300">•</span>
                            <span className={`text-[10px] font-semibold ${isSelected ? 'text-orange-200' : wp >= LONG_PERIOD_SWELL_S ? 'text-orange-600' : 'text-zinc-500'}`}>
                              {wp.toFixed(1)}s
                            </span>
                          </>
                        ) : (
                          <span className={`text-[10px] font-semibold ${isSelected ? 'text-amber-200' : 'text-amber-600'}`}>
                            {pt.loading ? 'Memuat data…' : pt.failed ? 'Gagal dimuat' : 'Data tidak tersedia'}
                          </span>
                        )}
                      </div>
                    </div>

                    {hasData ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${isSelected ? 'bg-white text-[#162e52] border-white' : badgeStyle}`}>
                        {wh.toFixed(1)} m
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${isSelected ? 'bg-white/20 text-white border-white/40' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                        {pt.loading ? '…' : '—'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Minimal Info Note */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1 text-xs text-zinc-600">
            <p className="font-bold text-[#162e52]">Sumber Resmi BMKG Pusmar API23</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Seluruh data ditarik 100% dari API BMKG (gelombang: tinggi, periode rata-rata &amp; swell; angin: kecepatan, arah &amp; medan vektor). Periode &ge; {LONG_PERIOD_SWELL_S}s menandakan swell panjang berisiko tinggi. Data diperbarui otomatis setiap menit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
