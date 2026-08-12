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

  // Hasilkan opsi tanggal slidable (14 hari terakhir sampai hari ini)
  const generateDateOptions = () => {
    const options = [];
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayLabel = daysIndo[d.getDay()];
      if (i === 0) dayLabel = 'Hari Ini';
      if (i === 1) dayLabel = 'Kemarin';

      options.push({
        dateStr,
        dayLabel,
        dayNum: d.getDate(),
        monthLabel: monthsIndo[d.getMonth()],
        year: d.getFullYear(),
      });
    }
    return options;
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-300 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto space-y-7">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#0c2d52] tracking-tight">{title}</h2>
        <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed font-normal">{description}</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#0c2d52] block">
          1. Pilih Wilayah Perairan Pesisir
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {REGION_PRESETS.filter((r) => r.id !== 'custom').map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handlePresetSelect(r.id)}
              className={`px-4 py-3 rounded-xl text-left border-2 text-xs sm:text-sm font-bold transition-colors ${
                regionPreset === r.id
                  ? 'bg-[#0c2d52] text-white border-[#0c2d52]'
                  : 'bg-slate-50 text-zinc-800 border-zinc-300 hover:border-[#0c2d52] hover:bg-slate-100'
              }`}
            >
              {r.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handlePresetSelect('map-custom')}
            className={`px-4 py-3 rounded-xl text-left border-2 text-xs sm:text-sm font-bold transition-colors ${
              isMapCustom
                ? 'bg-[#0c2d52] text-white border-[#0c2d52]'
                : 'bg-slate-50 text-zinc-800 border-zinc-300 hover:border-[#0c2d52] hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-12v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0l3.875-1.937c.381-.19.622-.58.622-1.006V8.25" />
              </svg>
              Pilih di Peta
            </span>
          </button>
        </div>
      </div>

      {isMapCustom && (
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-zinc-300">
          <div>
            <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#0c2d52]">Nama Wilayah Khusus</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="cth: Perairan Jepara / Natuna"
              className="mt-1.5 w-full px-4 py-3 rounded-xl border-2 border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#0c2d52]"
            />
          </div>
          <MapRegionPicker initialBbox={customBbox} onChange={setCustomBbox} />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#0c2d52] block">
          2. Titik Berangkat (Pelabuhan / Pangkalan Kapal Anda)
        </label>
        <p className="text-xs text-zinc-600">Gunakan GPS atau klik di peta untuk menentukan lokasi keberangkatan perahu Anda.</p>
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

      {/* Step 3: Slidable Date Picker (Flat Solid Style) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <label className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#0c2d52]">
            3. Pilih Tanggal Rencana Melaut (Geser / Slide Kartu)
          </label>
          <span className="text-xs font-bold text-[#0c2d52] bg-slate-100 border border-zinc-300 px-3 py-1 rounded-lg">
            Terpilih: {date}
          </span>
        </div>

        {/* Slidable Date Carousel with Navigation Arrows */}
        <div className="relative px-2">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('date-slider-container');
              if (el) el.scrollBy({ left: -220, behavior: 'smooth' });
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#0c2d52] text-white flex items-center justify-center -ml-3 hover:bg-[#163e6e] transition-colors border-2 border-white"
            title="Geser Ke Kiri"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Date Slider Horizontal Scroll Container */}
          <div
            id="date-slider-container"
            className="flex items-center gap-3 overflow-x-auto py-2 px-1 scrollbar-none snap-x snap-mandatory scroll-smooth"
          >
            {generateDateOptions().map((item) => {
              const isSelected = date === item.dateStr;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setDate(item.dateStr)}
                  className={`min-w-[105px] sm:min-w-[120px] py-3.5 px-3 rounded-2xl flex flex-col items-center justify-center snap-start transition-colors border-2 text-center flex-shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0c2d52] text-white border-[#0c2d52]'
                      : 'bg-slate-50 text-zinc-800 border-zinc-300 hover:border-[#0c2d52] hover:bg-slate-100'
                  }`}
                >
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-sky-200' : 'text-zinc-500'}`}>
                    {item.dayLabel}
                  </span>
                  <span className={`text-2xl font-black my-0.5 ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {item.dayNum}
                  </span>
                  <span className={`text-xs font-bold ${isSelected ? 'text-zinc-200' : 'text-zinc-600'}`}>
                    {item.monthLabel} {item.year}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('date-slider-container');
              if (el) el.scrollBy({ left: 220, behavior: 'smooth' });
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#0c2d52] text-white flex items-center justify-center -mr-3 hover:bg-[#163e6e] transition-colors border-2 border-white"
            title="Geser Ke Kanan"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Calendar Picker Fallback */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-600 pt-1">
          <span>Geser kartu tanggal di atas, atau tentukan tanggal khusus dari kalender:</span>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border-2 border-zinc-300 text-xs text-zinc-900 font-bold bg-white focus:outline-none focus:border-[#0c2d52]"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-4 bg-[#0c2d52] hover:bg-[#163e6e] disabled:opacity-50 text-white text-sm sm:text-base font-extrabold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
              Memproses Analisis…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>

      <div className="p-3.5 bg-slate-50 border-2 border-zinc-300 rounded-xl flex items-start gap-2.5">
        <svg className="w-5 h-5 text-[#0c2d52] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs sm:text-sm text-zinc-900 font-medium leading-relaxed">
          <strong>Keterangan:</strong> Hasil kalkulasi akan menampilkan lokasi keberadaan ikan terdekat dari pelabuhan Anda (&lt; 12 mil laut) berbasis klorofil-a &amp; suhu laut NASA GIBS, serta rekomendasi rute hemat BBM.
        </p>
      </div>
    </form>
  );
}
