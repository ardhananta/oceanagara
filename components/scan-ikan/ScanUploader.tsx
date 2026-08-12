'use client';

import { useRef, useState } from 'react';

export const MAX_SCAN_PHOTOS = 3;

const FISH_SPECIES = [
  'Tongkol',
  'Cakalang',
  'Kembung',
  'Terubuk',
  'Teri',
  'Kakap Merah',
  'Bawal',
  'Bandeng',
  'Kuwe',
  'Selar',
  'Mujair',
  'Lele',
];

interface ScanUploaderProps {
  loading: boolean;
  onScan: (payload: {
    photos: string[];
    species: string;
    holdHours?: string;
    waterTemp?: number;
  }) => void;
  onError?: (message: string | null) => void;
}

/** Baca file foto lalu kompres ke max 1024px JPEG (batas base64 Groq 4MB). */
async function fileToCompressedDataUrl(file: File): Promise<string | null> {
  try {
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

    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (err) {
    console.warn('[ScanUploader] photo skip:', err);
    return null;
  }
}

const HOLD_OPTIONS = [
  { id: '<2', label: '< 2 jam' },
  { id: '2-6', label: '2–6 jam' },
  { id: '6-12', label: '6–12 jam' },
  { id: '12-24', label: '12–24 jam' },
  { id: '>24', label: '> 24 jam' },
];

export default function ScanUploader({ loading, onScan, onError }: ScanUploaderProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [species, setSpecies] = useState('');
  const [holdHours, setHoldHours] = useState<string>('2-6');
  const [useContext, setUseContext] = useState(false);
  const [waterTemp, setWaterTemp] = useState<number>(28);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const draggingCountRef = useRef(0);

  const addFiles = async (files: File[]) => {
    setDrafting(true);
    setPhotoError(null);
    const remaining = MAX_SCAN_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`Maksimal ${MAX_SCAN_PHOTOS} foto per pemindaian.`);
      setDrafting(false);
      return;
    }
    const batch = files.slice(0, remaining);
    const ok: string[] = [];
    for (const file of batch) {
      if (!file.type.startsWith('image/')) continue;
      const compressed = await fileToCompressedDataUrl(file);
      if (compressed) ok.push(compressed);
    }
    if (ok.length > 0) {
      setPhotos((prev) => [...prev, ...ok]);
    } else if (batch.length > 0) {
      setPhotoError('Foto gagal diproses (format tidak didukung).');
    }
    setDrafting(false);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void addFiles(files);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    draggingCountRef.current = 0;
    setDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setPhotoError('Tambahkan minimal satu foto ikan terlebih dahulu.');
      return;
    }
    onError?.(null);
    onScan({
      photos,
      species: species.trim(),
      holdHours: useContext ? holdHours : undefined,
      waterTemp: useContext ? waterTemp : undefined,
    });
  };

  const inputCls =
    'mt-1.5 w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-[11px] font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-600/30 bg-white disabled:opacity-60';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Foto ikan */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-[9px] font-bold uppercase tracking-widest text-sky-100/90">
            Foto Ikan (1–3) — bawa kamera dekat ke mata, insang & tubuh
          </label>
          <span className="text-[9px] text-sky-200/70 font-semibold">{photos.length}/{MAX_SCAN_PHOTOS}</span>
        </div>

        <div className="flex gap-2 mt-2 flex-wrap">
          {photos.map((src, i) => (
            <div key={i} className="relative flex-shrink-0">
              <img
                src={src}
                alt={`Foto ikan ${i + 1}`}
                className="w-24 h-24 rounded-xl object-cover border border-white/25 shadow"
              />
              <button
                type="button"
                aria-label={`Hapus foto ${i + 1}`}
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm text-[10px] font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_SCAN_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                draggingCountRef.current += 1;
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                draggingCountRef.current -= 1;
                if (draggingCountRef.current === 0) setDragOver(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              disabled={loading || drafting}
              className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors flex-shrink-0 disabled:opacity-60 ${
                dragOver
                  ? 'border-sky-300 bg-sky-400/20 text-sky-200'
                  : 'border-sky-300/50 text-sky-200/80 hover:bg-sky-400/10'
              }`}
            >
              {drafting ? (
                <span className="w-5 h-5 border-2 border-sky-200/40 border-t-sky-200 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z" />
                  </svg>
                  <span className="text-[8px] font-bold">Ambil / Pilih</span>
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
          onChange={handleFilesSelected}
        />
        {photoError && (
          <p className="text-[9px] font-bold text-amber-300 mt-1.5">{photoError}</p>
        )}
        <p className="text-[9px] text-sky-200/60 font-medium mt-1.5">
          Seret & lepas foto ke area, atau gunakan kamera. Foto terkirim sebagai Data URL — dianalisis model vision Groq.
        </p>
      </div>

      {/* Spesies */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-sky-100/90">
          Nama Ikan (opsional)
        </label>
        <input
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
          placeholder="Contoh: Tongkol"
          disabled={loading}
          className={inputCls}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FISH_SPECIES.filter((s) => !species || s.toLowerCase().includes(species.toLowerCase())).slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpecies(s)}
              disabled={loading}
              className={`px-2.5 py-1 rounded-full border text-[9px] font-bold transition-colors ${
                species === s
                  ? 'bg-sky-400/25 text-sky-100 border-sky-300/60'
                  : 'bg-white/5 text-sky-200/70 border-white/15 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Konteks penyimpanan (opsional) */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-3">
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-[9px] font-bold uppercase tracking-widest text-sky-100/90">
            Tambah Konteks Penyimpanan (opsional)
          </span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${useContext ? 'bg-sky-400' : 'bg-white/15'}`}>
            <input
              type="checkbox"
              checked={useContext}
              onChange={(e) => setUseContext(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useContext ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        </label>

        {useContext && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-sky-200/80">
                Lama Penyimpanan sejak Ditangkap
              </label>
              <select
                value={holdHours}
                onChange={(e) => setHoldHours(e.target.value)}
                disabled={loading}
                className={inputCls}
              >
                {HOLD_OPTIONS.map((h) => (
                  <option key={h.id} value={h.id}>{h.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-sky-200/80">
                Suhu Air saat Menangkap (°C)
              </label>
              <input
                type="number"
                step="0.5"
                min={10}
                max={40}
                value={waterTemp}
                onChange={(e) => setWaterTemp(Number(e.target.value))}
                disabled={loading}
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || photos.length === 0}
        className="w-full px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-sky-900/40 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Scan Kualitas Ikan
      </button>
    </form>
  );
}