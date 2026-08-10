'use client';

import { useCallback, useRef, useState } from 'react';
import type { WasteExifInfo, WasteLocationInfo, WasteType } from '@/app/types/maritime';
import { parseExif, toWasteExif } from './exif';

export const MAX_REPORT_PHOTOS = 3;

const WASTE_TYPES: { id: WasteType; label: string; icon: string }[] = [
  { id: 'plastik', label: 'Sampah Plastik', icon: 'bag' },
  { id: 'tumpahan-minyak', label: 'Tumpahan Minyak', icon: 'drop' },
  { id: 'kimia-pabrik', label: 'Limbah Kimia / Pabrik', icon: 'flask' },
  { id: 'organik', label: 'Limbah Organik', icon: 'leaf' },
  { id: 'sampah-campuran', label: 'Sampah Campuran', icon: 'pile' },
  { id: 'lainnya', label: 'Lainnya', icon: 'dots' },
];

function TypeIcon({ kind }: { kind: string }) {
  if (kind === 'drop') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
  }
  if (kind === 'flask') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.643c.232.272.378.647.408 1.037l.044.55a2.25 2.25 0 0 1-2.24 2.485H5.526a2.25 2.25 0 0 1-2.24-2.485l.044-.55c.03-.39.176-.765.408-1.037L5 14.5" />;
  }
  if (kind === 'leaf') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0a19.5 19.5 0 0 0-9 4.5V12a7.5 7.5 0 0 0 9 7.5m-9-15h9m-9 0a19.5 19.5 0 0 1 9-4.5M12 4.5a19.5 19.5 0 0 1 9 4.5V12a7.5 7.5 0 0 1-9 7.5" />;
  }
  if (kind === 'pile') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V17.25a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-4.5m-19.5-3A2.25 2.25 0 0 1 6.75 7.5h10.5a2.25 2.25 0 0 1 2.25 2.25m-19.5 3h19.5m-19.5 3h19.5" />;
  }
  if (kind === 'dots') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />;
  }
  return <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 14.25v1.5A2.25 2.25 0 0 1 13.5 18h-3a2.25 2.25 0 0 1-2.25-2.25v-1.5M12 3.375v9.375m-4.5 0h9" />;
}

async function readPhoto(
  file: File
): Promise<{ full: string; thumb: string; exif: WasteExifInfo | null } | null> {
  try {
    const exifRaw = await parseExif(file);
    const exif = toWasteExif(exifRaw);

    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = raw;
    });

    const toDataUrl = (maxDim: number, quality: number): string => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return raw;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    };

    return { full: toDataUrl(1024, 0.72), thumb: toDataUrl(512, 0.6), exif };
  } catch (err) {
    console.warn('[WasteReportForm] photo skip:', err);
    return null;
  }
}

export interface WasteReportPayload {
  photos: string[];
  thumbs: string[];
  exif: WasteExifInfo | null;
  wasteType: WasteType;
  description: string;
  location: WasteLocationInfo;
}

interface WasteReportFormProps {
  loading: boolean;
  onSubmit: (payload: WasteReportPayload) => void;
  onError: (message: string | null) => void;
}

export default function WasteReportForm({ loading, onSubmit, onError }: WasteReportFormProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [exif, setExif] = useState<WasteExifInfo | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [wasteType, setWasteType] = useState<WasteType>('plastik');
  const [description, setDescription] = useState('');

  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<WasteLocationInfo | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  const requestLocation = useCallback(() => {
    setLocError(null);
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      setLocError('Perangkat tidak mendukung GPS. Masukkan koordinat manual.');
      setManualMode(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setManualMode(false);
        setLocation({
          lat: +pos.coords.latitude.toFixed(6),
          lon: +pos.coords.longitude.toFixed(6),
          accuracyMeters: Math.round(pos.coords.accuracy),
          source: 'gps',
        });
      },
      (err) => {
        setLocating(false);
        const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code?: number }).code) : 0;
        setLocError(
          code === 1
            ? 'Izin lokasi ditolak. Aktifkan akses lokasi atau isi koordinat manual.'
            : 'Gagal mendapatkan lokasi GPS. Isi koordinat manual atau coba lagi.'
        );
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  const applyManual = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setLocError('Koordinat tidak valid. Contoh: -6.2124, 106.8456');
      return;
    }
    setLocError(null);
    setLocation({ lat, lon, accuracyMeters: null, source: 'manual' });
  };

  const addPhotos = async (files: File[]) => {
    setDrafting(true);
    setPhotoError(null);
    const remaining = MAX_REPORT_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`Maksimal ${MAX_REPORT_PHOTOS} foto per laporan.`);
      setDrafting(false);
      return;
    }
    const batch = files.filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    const mergedExif: WasteExifInfo[] = [];
    const okFull: string[] = [];
    const okThumb: string[] = [];
    for (const file of batch) {
      const p = await readPhoto(file);
      if (!p) continue;
      okFull.push(p.full);
      okThumb.push(p.thumb);
      if (p.exif) mergedExif.push(p.exif);
    }
    if (okFull.length > 0) {
      setPhotos((prev) => [...prev, ...okFull]);
      setThumbs((prev) => [...prev, ...okThumb]);
      const gps = mergedExif.find((e) => e.gpsLat && e.gpsLon);
      const time = mergedExif.find((e) => e.capturedAt);
      setExif((prev) => ({
        gpsLat: gps?.gpsLat ?? prev?.gpsLat,
        gpsLon: gps?.gpsLon ?? prev?.gpsLon,
        capturedAt: time?.capturedAt ?? prev?.capturedAt,
      }));
    } else if (batch.length > 0) {
      setPhotoError('Foto gagal diproses (format tidak didukung).');
    }
    setDrafting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (photos.length === 0) {
      setPhotoError('Tambahkan minimal satu foto limbah terlebih dahulu.');
      return;
    }
    if (!location) {
      setLocError('Lokasi pelaporan belum tersedia — aktifkan GPS atau isi koordinat manual.');
      setManualMode(true);
      return;
    }
    onSubmit({
      photos,
      thumbs,
      exif,
      wasteType,
      description: description.trim(),
      location,
    });
  };

  const inputCls =
    'mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#162e52] focus:ring-2 focus:ring-[#162e52]/20 bg-white placeholder:text-zinc-400 disabled:opacity-60 shadow-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Foto */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-[#162e52]">
            Foto Limbah (1–{MAX_REPORT_PHOTOS})
          </label>
          <span className="text-[10px] text-zinc-500 font-extrabold">{photos.length}/{MAX_REPORT_PHOTOS}</span>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap">
          {thumbs.map((src, i) => (
            <div key={i} className="relative flex-shrink-0">
              <img
                src={src}
                alt={`Foto limbah ${i + 1}`}
                className="w-24 h-24 rounded-2xl object-cover border border-zinc-200 shadow-md"
              />
              <button
                type="button"
                aria-label={`Hapus foto ${i + 1}`}
                onClick={() => {
                  setPhotos((p) => p.filter((_, k) => k !== i));
                  setThumbs((t) => t.filter((_, k) => k !== i));
                  setExif(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_REPORT_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={loading || drafting}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/60 hover:bg-sky-50 text-sky-800 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 flex-shrink-0 disabled:opacity-60 shadow-sm"
            >
              {drafting ? (
                <span className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6 text-sky-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z" />
                  </svg>
                  <span className="text-[9px] font-bold text-[#162e52]">Ambil / Pilih</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void addPhotos(files);
          }}
        />
        {photoError && <p className="text-[10px] font-bold text-rose-600 mt-1.5">{photoError}</p>}
        <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-1.5">
          Metadata EXIF (GPS & waktu pengambilan) dibaca otomatis sebelum kompresi untuk validasi keaslian.
        </p>
      </div>

      {/* Lokasi */}
      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-extrabold uppercase tracking-wider text-[#162e52]">
            Lokasi Pelaporan (diambil saat memotret)
          </label>
          {!manualMode && (
            <button
              type="button"
              onClick={requestLocation}
              disabled={loading || locating}
              className="text-[10px] font-extrabold text-sky-700 hover:text-sky-900 flex items-center gap-1 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              Ambil Ulang
            </button>
          )}
        </div>

        {locating ? (
          <div className="flex items-center gap-2.5 py-1 text-[#162e52]">
            <span className="w-4 h-4 border-2 border-[#162e52] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs font-semibold">Mengambil koordinat GPS perangkat…</span>
          </div>
        ) : location ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 space-y-1 text-emerald-900 shadow-sm">
            <p className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
              Lokasi Terkunci
            </p>
            <p className="text-xs text-[#162e52] font-mono font-bold">
              {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
            </p>
            <p className="text-[10px] text-zinc-600 font-medium">
              {location.source === 'gps'
                ? `GPS perangkat · akurasi ±${location.accuracyMeters} m`
                : 'Koordinat input manual'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={requestLocation}
              disabled={loading || locating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-md shadow-[#162e52]/20 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              Gunakan Lokasi Saat Ini
            </button>
            <button
              type="button"
              onClick={() => setManualMode(true)}
              disabled={loading}
              className="w-full text-center text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors underline underline-offset-2"
            >
              atau isi koordinat manual
            </button>
            {locError && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">{locError}</p>}
          </div>
        )}

        {manualMode && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52]">Latitude</label>
              <input
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="-6.2124"
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#162e52]">Longitude</label>
              <input
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="106.8456"
                disabled={loading}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={applyManual}
              disabled={loading || !manualLat || !manualLon}
              className="col-span-2 px-4 py-2.5 rounded-xl bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-extrabold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
            >
              Pakai Koordinat Manual
            </button>
          </div>
        )}
      </div>

      {/* Jenis limbah */}
      <div>
        <label className="text-xs font-extrabold uppercase tracking-wider text-[#162e52] block mb-1.5">
          Jenis Limbah
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WASTE_TYPES.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWasteType(w.id)}
              disabled={loading}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                wasteType === w.id
                  ? 'bg-[#162e52] text-white border-[#162e52] shadow-md shadow-[#162e52]/20 font-extrabold scale-[1.02]'
                  : 'bg-white hover:bg-sky-50 text-zinc-700 border-zinc-200 hover:border-sky-300 font-bold shadow-sm'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <TypeIcon kind={w.icon} />
              </svg>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deskripsi */}
      <div>
        <label className="text-xs font-extrabold uppercase tracking-wider text-[#162e52] block mb-1.5">
          Deskripsi (opsional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="Contoh: gundukan sampah plastik di tepi pantai, tampak baru terbawa arus…"
          disabled={loading}
          className={`${inputCls} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={loading || photos.length === 0 || !location}
        className="w-full px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#162e52] hover:from-emerald-500 hover:to-[#1f4275] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        Kirim & Validasi Laporan
      </button>
    </form>
  );
}