'use client';

import React, { useMemo, useState } from 'react';
import type { LocationQuery } from '@/app/types/maritime';
import { regionSourcePreview, type NearbySource } from './sources';

export interface RiskFormData {
  regionPreset: string;
  customRegionName: string;
  startDate: string;
  endDate: string;
  datePreset: 'realtime' | '7d' | '14d' | '30d' | 'custom';
  pollutionTypes: string[];
  additionalNotes: string;
}

interface RiskFormProps {
  onSubmit: (locationQuery: LocationQuery) => void;
  isLoading: boolean;
}

export const REGION_PRESETS = [
  { id: 'semarang', name: 'Laut Jawa (Pesisir Semarang)', lat: -6.9, lon: 110.4, bbox: { north: -5.5, south: -8.0, east: 112.0, west: 108.5 } },
  { id: 'jakarta', name: 'Teluk Jakarta', lat: -5.97, lon: 106.83, bbox: { north: -5.8, south: -6.1, east: 107.0, west: 106.6 } },
  { id: 'makassar', name: 'Selat Makassar', lat: -3.0, lon: 118.0, bbox: { north: -1.0, south: -5.0, east: 120.0, west: 116.0 } },
  { id: 'malaka', name: 'Selat Malaka', lat: 2.5, lon: 101.5, bbox: { north: 4.5, south: 1.0, east: 104.0, west: 99.5 } },
  { id: 'banda', name: 'Laut Banda', lat: -5.0, lon: 128.5, bbox: { north: -3.5, south: -7.0, east: 131.0, west: 126.0 } },
  { id: 'bali', name: 'Perairan Bali & Selat Lombok', lat: -8.5, lon: 115.5, bbox: { north: -8.0, south: -9.2, east: 116.5, west: 114.3 } },
  { id: 'custom', name: 'Ketik Lokasi Lain (Custom)', lat: -6.9, lon: 110.4, bbox: { north: -5.5, south: -8.0, east: 112.0, west: 108.5 } },
];

const POLLUTION_OPTIONS = [
  {
    id: 'minyak',
    label: 'Tumpahan Minyak & Bahan Bakar',
    icon: (
      <svg className="w-5 h-5 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.25 6-7.5 9.75-7.5 13.5a7.5 7.5 0 0 0 15 0c0-3.75-2.25-7.5-7.5-13.5Z" />
      </svg>
    ),
  },
  {
    id: 'industri',
    label: 'Limbah Industri & Termal',
    icon: (
      <svg className="w-5 h-5 text-slate-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3v18M19.5 21V9l-6 3.75V9l-6 3.75V3" />
      </svg>
    ),
  },
  {
    id: 'plastik',
    label: 'Sampah Plastik & Padat',
    icon: (
      <svg className="w-5 h-5 text-sky-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 0 0 9-9c0-4.97-4.03-9-9-9s-9 4.03-9 9a9 9 0 0 0 9 9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
      </svg>
    ),
  },
  {
    id: 'kapal',
    label: 'Aktivitas Kapal & Tanker (GFW)',
    icon: (
      <svg className="w-5 h-5 text-indigo-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3 19.5l1.8-6h14.4l1.8 6H3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v9M9 7.5h6" />
      </svg>
    ),
  },
  {
    id: 'sedimen',
    label: 'Sedimentasi & Runoff Pertanian',
    icon: (
      <svg className="w-5 h-5 text-emerald-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18C8 3 4 7 4 12s4 9 8 9m0-18c4 0 8 4 8 9s-4 9-8 9" />
      </svg>
    ),
  },
];

export default function RiskForm({ onSubmit, isLoading }: RiskFormProps) {
  const [formData, setFormData] = useState<RiskFormData>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      regionPreset: 'semarang',
      customRegionName: '',
      startDate: todayStr,
      endDate: todayStr,
      datePreset: 'realtime',
      pollutionTypes: ['minyak', 'industri', 'plastik'],
      additionalNotes: '',
    };
  });

  const handleDatePreset = (preset: 'realtime' | '7d' | '14d' | '30d' | 'custom') => {
    const end = new Date().toISOString().split('T')[0];

    if (preset === 'realtime') {
      // Mode realtime: mulai dari tanggal terbaru (hari ini)
      setFormData((prev) => ({
        ...prev,
        datePreset: preset,
        startDate: end,
        endDate: end,
      }));
      return;
    }

    let days = 7;
    if (preset === '14d') days = 14;
    if (preset === '30d') days = 30;

    const startMs = new Date().getTime() - days * 86400000;
    const start = new Date(startMs).toISOString().split('T')[0];
    setFormData((prev) => ({
      ...prev,
      datePreset: preset,
      startDate: preset === 'custom' ? prev.startDate : start,
      endDate: preset === 'custom' ? prev.endDate : end,
    }));
  };

  const togglePollutionType = (id: string) => {
    setFormData((prev) => {
      const exists = prev.pollutionTypes.includes(id);
      const updated = exists
        ? prev.pollutionTypes.filter((t) => t !== id)
        : [...prev.pollutionTypes, id];
      return { ...prev, pollutionTypes: updated.length ? updated : [id] };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedRegion = REGION_PRESETS.find((r) => r.id === formData.regionPreset);
    const regionName =
      formData.regionPreset === 'custom' && formData.customRegionName.trim()
        ? formData.customRegionName.trim()
        : selectedRegion?.name || 'Laut Jawa (Pesisir Semarang)';

    const locationQuery: LocationQuery = {
      ready: true,
      regionName,
      lat: selectedRegion?.lat ?? -6.9,
      lon: selectedRegion?.lon ?? 110.4,
      boundingBox: selectedRegion?.bbox ?? { north: -5.5, south: -8.0, east: 112.0, west: 108.5 },
      startDate: formData.startDate,
      endDate: formData.endDate,
      pollutionTypes: formData.pollutionTypes,
      summary: `Analisis risiko pencemaran di ${regionName} untuk periode ${formData.startDate} s/d ${formData.endDate}. Focus: ${formData.pollutionTypes.join(', ')}. ${formData.additionalNotes ? `Catatan: ${formData.additionalNotes}` : ''}`,
    };

    onSubmit(locationQuery);
  };

  // Live preview: industrial pollution sources near the selected region
  const selectedRegion = REGION_PRESETS.find((r) => r.id === formData.regionPreset);
  const regionSources: NearbySource[] = useMemo(
    () => (selectedRegion ? regionSourcePreview(selectedRegion.lat, selectedRegion.lon, 200) : []),
    [selectedRegion]
  );

  const selectedLabels = POLLUTION_OPTIONS.filter((o) => formData.pollutionTypes.includes(o.id)).map((o) => o.label);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-zinc-900 font-sans">
      {/* SECTION 1: Wilayah / Lokasi Target */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            01
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
              Wilayah &amp; Lokasi Perairan Target
            </h3>
            <p className="text-xs text-zinc-500">
              Pilih lokasi perairan di Indonesia atau tentukan area khusus riset Anda.
            </p>
          </div>
        </div>

        {/* Preset Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {REGION_PRESETS.map((r) => {
            const isSelected = formData.regionPreset === r.id;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setFormData({ ...formData, regionPreset: r.id })}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                  isSelected
                    ? 'bg-[#162e52] text-white border-[#162e52] shadow-md'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
              >
                <div className="truncate">{r.name}</div>
              </button>
            );
          })}
        </div>

        {/* Custom Location Input */}
        {formData.regionPreset === 'custom' && (
          <div className="pt-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              Nama Lokasi Spesifik / Koordinat Perairan *
            </label>
            <input
              type="text"
              required
              value={formData.customRegionName}
              onChange={(e) => setFormData({ ...formData, customRegionName: e.target.value })}
              placeholder="Contoh: Perairan Jepara, Pesisir Utara Jawa Tengah"
              className="w-full px-4 py-3 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:border-[#162e52] transition-colors"
            />
          </div>
        )}

        {/* Live preview: pollution sources near selected region */}
        {regionSources.length > 0 && (
          <div className="pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-fuchsia-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              Sumber Pencemaran Potensial di Sekitar Wilayah Ini
            </p>
            <div className="flex flex-wrap gap-1.5">
              {regionSources.map((s, i) => (
                <span key={i} className="text-[10px] font-semibold text-zinc-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg px-2 py-1">
                  {s.name}
                  <span className="text-fuchsia-500 font-bold ml-1">{Math.round(s.distanceKm)} km</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Rentang Waktu Analisis */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            02
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
              Rentang Waktu Observasi
            </h3>
            <p className="text-xs text-zinc-500">
              Pilih periode waktu data histori &amp; real-time yang akan ditarik dari API maritim.
            </p>
          </div>
        </div>

        {/* Date Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'realtime', label: 'Realtime (Tanggal Terbaru)' },
            { id: '7d', label: '7 Hari Terakhir' },
            { id: '14d', label: '14 Hari Terakhir' },
            { id: '30d', label: '30 Hari Terakhir' },
            { id: 'custom', label: 'Kustom Tanggal' },
          ].map((dp) => (
            <button
              type="button"
              key={dp.id}
              onClick={() => handleDatePreset(dp.id as 'realtime' | '7d' | '14d' | '30d' | 'custom')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                formData.datePreset === dp.id
                  ? 'bg-[#162e52] text-white border-[#162e52]'
                  : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {dp.label}
            </button>
          ))}
        </div>

        {/* Realtime mode note */}
        {formData.datePreset === 'realtime' && (
          <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2.5">
            <svg className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-[11px] text-sky-800 font-medium leading-relaxed">
              Mode <b>realtime</b>: observasi dimulai otomatis dari tanggal terbaru (hari ini) — data
              BMKG &amp; GFW diambil secara langsung saat analisis dijalankan.
            </p>
          </div>
        )}

        {/* Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              Tanggal Mulai
            </label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  startDate: e.target.value,
                  datePreset: 'custom',
                })
              }
              className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:border-[#162e52] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              Tanggal Selesai
            </label>
            <input
              type="date"
              required
              value={formData.endDate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  endDate: e.target.value,
                  datePreset: 'custom',
                })
              }
              className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:border-[#162e52] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Target Risiko Pencemaran */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            03
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
              Fokus Indikator &amp; Jenis Pencemaran
            </h3>
            <p className="text-xs text-zinc-500">
              Pilih satu atau lebih indikator risiko pencemaran yang ingin dianalisis oleh AI.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {POLLUTION_OPTIONS.map((opt) => {
            const isChecked = formData.pollutionTypes.includes(opt.id);
            return (
              <div
                key={opt.id}
                onClick={() => togglePollutionType(opt.id)}
                className={`cursor-pointer flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  isChecked
                    ? 'bg-sky-50 border-sky-400/80 text-[#162e52] shadow-sm'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-[#162e52] focus:ring-0 accent-[#162e52]"
                />
                {opt.icon}
                <span className="text-xs font-semibold leading-snug">{opt.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Catatan & Parameter Riset Tambahan */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            04
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
              Catatan &amp; Fokus Riset Tambahan (Opsional)
            </h3>
            <p className="text-xs text-zinc-500">
              Informasi tambahan untuk membantu AI Agent (Aruna &amp; Triton) memfokuskan hasil.
            </p>
          </div>
        </div>

        <textarea
          rows={3}
          value={formData.additionalNotes}
          onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
          placeholder="Misal: Fokuskan pada area dekat muara industri atau dekat koridor pelayaran kapal tanker..."
          className="w-full px-4 py-3 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:border-[#162e52] transition-colors resize-none placeholder:text-zinc-400"
        />
      </div>

      {/* Live summary strip */}
      <div className="bg-[#162e52] text-white rounded-2xl px-5 py-3.5 shadow-lg flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-xs font-bold">
          <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          {formData.regionPreset === 'custom' && formData.customRegionName.trim()
            ? formData.customRegionName.trim()
            : selectedRegion?.name ?? '—'}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
          <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          {formData.startDate} → {formData.endDate}
          {formData.datePreset === 'realtime' && (
            <span className="text-[9px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/40 rounded-lg px-1.5 py-0.5">
              Realtime
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
          <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          {selectedLabels.length} indikator: {selectedLabels.join(' · ')}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-[#162e52] hover:bg-[#1f4275] text-white text-sm font-bold uppercase tracking-wider rounded-2xl transition-all duration-200 shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Menyiapkan Parameter AI...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-sky-300 group-hover:rotate-12 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
              <span>Jalankan Analisis Agentic AI</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
