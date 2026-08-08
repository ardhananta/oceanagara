'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ArusAnalysisMode, ArusPencemaranRequest } from '@/app/types/maritime';
import { REGION_PRESETS } from '../peta-risiko/RiskForm';
import { loadLeaflet } from '../dashboard/wave/leaflet';

interface DriftFormProps {
  mode: ArusAnalysisMode;
  onModeChange: (mode: ArusAnalysisMode) => void;
  onSubmit: (request: ArusPencemaranRequest) => void;
  isLoading: boolean;
}

const WASTE_FORMS = [
  'cairan minyak (hydrocarbon film)',
  'limbah cair industri (termal & kimia)',
  'sampah plastik padat terapung',
  'partikel tersuspensi',
  'sedimen terlarut',
  'sisa oli ringan',
];

const MODE_TABS: { id: ArusAnalysisMode; label: string; hint: string }[] = [
  { id: 'buangan', label: 'Titik Buangan', hint: 'Limbah dari titik yang kamu pilih' },
  { id: 'kapal', label: 'Kapal Melintas', hint: 'Riwayat & hanyut limbah dari kapal di radius' },
  { id: 'pabrik', label: 'Pabrik', hint: 'Sumber pencemar industri di radius' },
];

const POINT_COLOR = '#0d9488';
const RADIUS_COLOR = '#6366f1';

/** Peta kecil untuk memilih titik analisis dengan klik. */
function MapPointPicker({
  lat,
  lon,
  radiusKm,
  onPick,
}: {
  lat: number;
  lon: number;
  radiusKm: number;
  onPick: (lat: number, lon: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
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
    if (!leafletReady || !ref.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(ref.current, { center: [lat, lon], zoom: 9, zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB © OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      onPick(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    });
    mapInstanceRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // Redraw marker + radius circle when coords/radius change
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    const layer = L.layerGroup().addTo(map);
    map.setView([lat, lon], Math.max(9, map.getZoom()));
    L.circleMarker([lat, lon], {
      radius: 8,
      color: '#fff',
      weight: 2.5,
      fillColor: POINT_COLOR,
      fillOpacity: 0.95,
    })
      .bindTooltip(`Titik analisis\n${lat.toFixed(4)}, ${lon.toFixed(4)}`, { direction: 'top' })
      .addTo(layer);
    if (radiusKm > 0) {
      L.circle([lat, lon], {
        radius: radiusKm * 1000,
        color: RADIUS_COLOR,
        weight: 1.5,
        dashArray: '4 6',
        fillColor: RADIUS_COLOR,
        fillOpacity: 0.06,
      })
        .bindTooltip(`Radius ${radiusKm} km`)
        .addTo(layer);
    }
    return () => {
      layer.remove();
    };
  }, [leafletReady, lat, lon, radiusKm]);

  return <div ref={ref} className="h-[240px] w-full rounded-xl overflow-hidden border border-zinc-200" />;
}

export default function DriftForm({ mode, onModeChange, onSubmit, isLoading }: DriftFormProps) {
  const [regionPreset, setRegionPreset] = useState('semarang');
  const [customRegionName, setCustomRegionName] = useState('');
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');
  const [wasteForm, setWasteForm] = useState(WASTE_FORMS[0]);
  const [spillRadiusKm, setSpillRadiusKm] = useState('5');
  const [radiusKm, setRadiusKm] = useState('40');
  const [forecastDays, setForecastDays] = useState('5');
  const [includeVesselAnalysis, setIncludeVesselAnalysis] = useState(true);

  const selectedRegion = useMemo(
    () => (regionPreset === 'custom' ? null : REGION_PRESETS.find((r) => r.id === regionPreset)),
    [regionPreset]
  );

  const regionName =
    regionPreset === 'custom'
      ? customRegionName.trim() || 'Lokasi Kustom'
      : selectedRegion?.name ?? 'Laut Jawa (Pesisir Semarang)';

  const originLat = regionPreset === 'custom' ? parseFloat(customLat) : selectedRegion?.lat ?? -6.9;
  const originLon = regionPreset === 'custom' ? parseFloat(customLon) : selectedRegion?.lon ?? 110.4;

  const scanRadiusKm = mode === 'buangan' ? Math.max(0, parseFloat(spillRadiusKm) || 0) : Math.max(1, parseFloat(radiusKm) || 40);

  const canSubmit =
    !isLoading &&
    (regionPreset !== 'custom' ||
      (customRegionName.trim() && Number.isFinite(originLat) && Number.isFinite(originLon)));

  const handlePickOnMap = (lat: number, lon: number) => {
    // Pilih preset terdekat sebagai nama wilayah
    let best = REGION_PRESETS[0];
    let bestD = Infinity;
    for (const r of REGION_PRESETS) {
      const d = (r.lat - lat) ** 2 + (r.lon - lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    setRegionPreset('custom');
    setCustomLat(String(lat));
    setCustomLon(String(lon));
    setCustomRegionName(`Perairan ${best.name}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      regionName,
      originLat,
      originLon,
      mode,
      radiusKm: mode !== 'buangan' ? Math.max(1, parseFloat(radiusKm) || 40) : undefined,
      forecastDays: Math.max(1, Math.min(14, Math.round(parseFloat(forecastDays) || 5))),
      spillRadiusKm: mode === 'buangan' ? Math.max(0, parseFloat(spillRadiusKm) || 0) : undefined,
      wasteForm: mode === 'buangan' ? wasteForm : undefined,
      includeVesselAnalysis: mode === 'buangan' ? includeVesselAnalysis : false,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Jenis analisis */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
          <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
          </svg>
          Jenis Analisis
        </label>
        <div className="grid grid-cols-3 gap-2">
          {MODE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onModeChange(t.id)}
              className={`px-2 py-2 rounded-xl text-[10px] font-bold border transition-all text-center leading-snug ${
                mode === t.id
                  ? 'bg-[#162e52] text-white border-[#162e52] shadow'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-400 mt-1.5">
          {MODE_TABS.find((t) => t.id === mode)?.hint}
        </p>
      </div>

      {/* Wilayah & peta */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
          <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          Titik Analisis
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {REGION_PRESETS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegionPreset(r.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all text-left leading-snug ${
                regionPreset === r.id
                  ? 'bg-[#162e52] text-white border-[#162e52]'
                  : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
        <MapPointPicker lat={originLat} lon={originLon} radiusKm={scanRadiusKm} onPick={handlePickOnMap} />
        <p className="text-[10px] text-zinc-400 mt-1.5">
          Klik peta untuk memilih titik sendiri. Koordinat: {originLat.toFixed(2)}, {originLon.toFixed(2)}
          {regionPreset === 'custom' && ` — ${regionName}`}
        </p>
      </div>

      {/* Custom location */}
      {regionPreset === 'custom' && (
        <div className="space-y-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Nama Lokasi *</label>
            <input
              type="text"
              value={customRegionName}
              onChange={(e) => setCustomRegionName(e.target.value)}
              placeholder="Contoh: Perairan Jepara"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:border-[#162e52]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Latitude *</label>
              <input
                type="number"
                step="0.0001"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                placeholder="-6.9000"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:border-[#162e52]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Longitude *</label>
              <input
                type="number"
                step="0.0001"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                placeholder="110.4000"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:border-[#162e52]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mode buangan: bentuk limbah */}
      {mode === 'buangan' && (
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Bentuk Limbah
          </label>
          <select
            value={wasteForm}
            onChange={(e) => setWasteForm(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:border-[#162e52]"
          >
            {WASTE_FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Radius */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
          <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25 21 12m0 0-5.25 3.75M21 12H3" />
          </svg>
          {mode === 'buangan' ? 'Radius Sebaran Awal (km)' : `Radius Pemindaian (km)`}
        </label>
        <input
          type="number"
          min={mode === 'buangan' ? 0 : 1}
          max={mode === 'buangan' ? 100 : 200}
          step="0.5"
          value={mode === 'buangan' ? spillRadiusKm : radiusKm}
          onChange={(e) => (mode === 'buangan' ? setSpillRadiusKm(e.target.value) : setRadiusKm(e.target.value))}
          className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-xs focus:outline-none focus:border-[#162e52]"
        />
        {mode !== 'buangan' && (
          <p className="text-[10px] text-zinc-400 mt-1.5">
            Mencari {mode === 'kapal' ? 'kapal yang melintas' : 'pabrik sumber pencemar'} dalam radius ini dari titik analisis.
          </p>
        )}
      </div>

      {/* Horizon prediksi hanyut */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">
          <svg className="w-3.5 h-3.5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Horizon Prediksi Hanyut (hari)
        </label>
        <input
          type="number"
          min="1"
          max="14"
          step="1"
          value={forecastDays}
          onChange={(e) => setForecastDays(e.target.value)}
          className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-xs focus:outline-none focus:border-[#162e52]"
        />
        <p className="text-[10px] text-zinc-400 mt-1.5">
          Perkiraan seberapa jauh limbah terhanyut mengikuti arus hingga N hari ke depan (tanpa batas jam tetap; simulasi berhenti saat mencapai pesisir).
        </p>
      </div>

      {/* Mode buangan: analisis kapal industri (GFW) */}
      {mode === 'buangan' && (
        <div>
          <label className="flex items-center justify-between gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-3.5 py-3 cursor-pointer select-none">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700">
              <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              Analisis Kapal Industri (GFW)
            </span>
            <input
              type="checkbox"
              checked={includeVesselAnalysis}
              onChange={(e) => setIncludeVesselAnalysis(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
          </label>
          <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">
            Mencari kandidat kapal industri (tanker/kargo/penangkapan) dalam radius ±80 km
            yang berpotensi menjadi sumber limbah, lalu memperkirakan hanyutan limbahnya.
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-all duration-200 shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Menyiapkan Analisis...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3 19.5l1.8-6h14.4l1.8 6H3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v9M9 7.5h6" />
            </svg>
            <span>
              {mode === 'buangan'
                ? 'Jalankan Prediksi Penyebaran'
                : mode === 'kapal'
                  ? 'Analisis Kapal Melintas'
                  : 'Analisis Pabrik'}
            </span>
          </>
        )}
      </button>
    </form>
  );
}
