'use client';

import { useState } from 'react';
import { REGION_PRESETS } from '@/components/peta-risiko/RiskForm';
import MapRegionPicker, { type RegionBBox } from './MapRegionPicker';
import MapPointPicker from './MapPointPicker';

export interface FishingFormData {
  regionPreset: string;
  regionName: string;
  bbox: RegionBBox;
  date: string;
  departureLat: number;
  departureLon: number;
}

interface FishingFormProps {
  onSubmit: (data: FishingFormData) => void;
  isLoading: boolean;
  /** Judul kartu form (default: "Zona Tangkap Ikan") */
  title?: string;
  /** Deskripsi singkat di bawah judul (default: teks zona tangkap) */
  description?: string;
  /** Label tombol submit (default: "Cari Zona Tangkap") */
  submitLabel?: string;
}

export default function FishingForm({
  onSubmit,
  isLoading,
  title = 'Zona Tangkap Ikan',
  description = 'Rekomendasi koordinat zona penangkapan ikan aktual dari citra satelit (klorofil & suhu NASA), diarahkan menjauhi zona terkontaminasi, lengkap dengan kategori spesies dan arah pergerakan kawanan.',
  submitLabel = 'Cari Zona Tangkap',
}: FishingFormProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [regionPreset, setRegionPreset] = useState('semarang');
  const [date, setDate] = useState(todayStr);
  const [customName, setCustomName] = useState('');
  const [customBbox, setCustomBbox] = useState<RegionBBox>(
    REGION_PRESETS[0].bbox
  );
  const [departureLat, setDepartureLat] = useState(REGION_PRESETS[0].lat);
  const [departureLon, setDepartureLon] = useState(REGION_PRESETS[0].lon);

  const selected = REGION_PRESETS.find((r) => r.id === regionPreset) ?? REGION_PRESETS[0];
  const isMapCustom = regionPreset === 'map-custom';

  const handlePresetSelect = (id: string) => {
    setRegionPreset(id);
    const preset = REGION_PRESETS.find((r) => r.id === id) ?? REGION_PRESETS[0];
    setDepartureLat(preset.lat);
    setDepartureLon(preset.lon);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      alert('Pilih tanggal analisis terlebih dahulu.');
      return;
    }
    if (isMapCustom) {
      onSubmit({
        regionPreset,
        regionName: customName.trim() || 'Area Kustom (Peta)',
        bbox: customBbox,
        date,
        departureLat,
        departureLon,
      });
      return;
    }
    onSubmit({ regionPreset, regionName: selected.name, bbox: selected.bbox, date, departureLat, departureLon });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-extrabold text-[#162e52] tracking-tight">{title}</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Wilayah Perairan</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {REGION_PRESETS.filter((r) => r.id !== 'custom').map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handlePresetSelect(r.id)}
              className={`px-3 py-2.5 rounded-xl text-left border text-[11px] font-bold transition-colors ${
                regionPreset === r.id
                  ? 'bg-[#162e52] text-white border-[#162e52] shadow'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#162e52]/40'
              }`}
            >
              {r.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handlePresetSelect('map-custom')}
            className={`px-3 py-2.5 rounded-xl text-left border text-[11px] font-bold transition-colors ${
              isMapCustom
                ? 'bg-[#162e52] text-white border-[#162e52] shadow'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#162e52]/40'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-12v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0l3.875-1.937c.381-.19.622-.58.622-1.006V8.25" />
              </svg>
              Pilih di Peta (Custom)
            </span>
          </button>
        </div>
      </div>

      {isMapCustom && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Nama Area Kustom</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="cth: Perairan Natuna"
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#162e52]/30"
            />
          </div>
          <MapRegionPicker initialBbox={customBbox} onChange={setCustomBbox} />
        </div>
      )}

      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">
          Titik Berangkat (Pelabuhan / Lokasi Kapal)
        </label>
        <div className="mt-2">
          <MapPointPicker
            initialLat={departureLat}
            initialLon={departureLon}
            onChange={(lat, lon) => {
              setDepartureLat(lat);
              setDepartureLon(lon);
            }}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">Tanggal Analisis</label>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#162e52]/30"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                Memproses…
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 italic">
        Area: {isMapCustom ? (customName.trim() || 'Area Kustom (Peta)') : selected.name} · {date}. Data:
        klorofil-a & SST NASA GIBS, arus BMKG, sampah padat Sentinel-2.
      </p>
    </form>
  );
}
