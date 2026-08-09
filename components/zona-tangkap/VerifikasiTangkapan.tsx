'use client';

import { useMemo, useRef, useState } from 'react';
import type {
  FishQualityAnalysis,
  TangkapanVerificationInput,
  TangkapanVerificationVerdict,
} from '@/app/types/maritime';
import { saveFishVerification } from '@/app/service/fishQualityHistory';

interface VerifikasiTangkapanProps {
  analysis: FishQualityAnalysis;
  uid: string | null;
  regionName: string;
  /** ID dokumen riwayat Firestore — verifikasi dilampirkan ke prediksi ini. */
  analysisId?: string | null;
  /** Verifikasi terdahulu yang menempel pada riwayat (dari history). */
  existingVerifications?: Array<{ refId?: string; verdict: TangkapanVerificationVerdict; input: TangkapanVerificationInput }>;
  onSaved?: () => void;
}

interface VerifikasiHistoryItem {
  id?: string;
  verdict: TangkapanVerificationVerdict;
  input: TangkapanVerificationInput;
}

const WEATHER_OPTIONS = [
  { id: 'cerah', label: 'Cerah / Terik', icon: 'sun' },
  { id: 'berawan', label: 'Berawan', icon: 'cloud' },
  { id: 'hujan', label: 'Hujan', icon: 'rain' },
  { id: 'angin-kencang', label: 'Angin Kencang', icon: 'wind' },
];

const HOLD_OPTIONS = [
  { id: '<2', label: '< 2 jam' },
  { id: '2-6', label: '2–6 jam' },
  { id: '6-12', label: '6–12 jam' },
  { id: '12-24', label: '12–24 jam' },
  { id: '>24', label: '> 24 jam' },
];

const EYES_OPTIONS = ['jernih', 'agak-keruh', 'keruh-cekung'];
const GILLS_OPTIONS = ['merah-segar', 'merah-muda', 'coklat-keabu'];
const SMELL_OPTIONS = ['khas-laut', 'amis-ringan', 'amis-menyengat'];
const FLESH_OPTIONS = ['kenyal', 'agak-lembek', 'lembek-berair'];

const OPTION_LABELS: Record<string, string> = {
  jernih: 'Jernih & menonjol',
  'agak-keruh': 'Agak keruh',
  'keruh-cekung': 'Keruh & cekung',
  'merah-segar': 'Merah segar',
  'merah-muda': 'Merah muda',
  'coklat-keabu': 'Coklat keabu-abuan',
  'khas-laut': 'Khas laut segar',
  'amis-ringan': 'Amis ringan',
  'amis-menyengat': 'Amis menyengat',
  kenyal: 'Kenyal & elastis',
  'agak-lembek': 'Agak lembek',
  'lembek-berair': 'Lembek & berair',
};

function WeatherIcon({ kind, className = 'w-4 h-4' }: { kind: string; className?: string }) {
  if (kind === 'cloud') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0 1 11.573-2.226 3.75 3.75 0 0 1 4.133 4.303A4.5 4.5 0 0 1 18 20.25H6.75a5.25 5.25 0 0 1-2.25-10.001z" clipRule="evenodd" />
      </svg>
    );
  }
  if (kind === 'rain') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0 1 11.573-2.226 3.75 3.75 0 0 1 4.133 4.303A4.5 4.5 0 0 1 18 20.25H6.75a5.25 5.25 0 0 1-2.25-10.001z" clipRule="evenodd" />
        <path d="M6.75 21.75a.75.75 0 1 0 1.5 0v-1.5a.75.75 0 1 0-1.5 0v1.5zm4.5 0a.75.75 0 1 0 1.5 0v-1.5a.75.75 0 1 0-1.5 0v1.5zm4.5 0a.75.75 0 1 0 1.5 0v-1.5a.75.75 0 1 0-1.5 0v1.5z" />
      </svg>
    );
  }
  if (kind === 'wind') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h7.5a2.25 2.25 0 1 0-2.25-2.25M3 12h13.5a2.25 2.25 0 1 1-2.25 2.25M3 16.5h7.5a2.25 2.25 0 1 1-2.25 2.25" />
      </svg>
    );
  }
  // sun
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function FreshnessBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#059669' : score >= 45 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Segar' : score >= 45 ? 'Mulai Berubah' : 'Tidak Segar';
  return (
    <span
      className="text-[10px] font-extrabold rounded-xl px-2.5 py-1 border flex-shrink-0"
      style={{ color, background: `${color}14`, borderColor: `${color}55` }}
    >
      {label} · {score}/100
    </span>
  );
}

function VerdictCard({
  verdict,
  degraded,
  photoThumbs,
}: {
  verdict: TangkapanVerificationVerdict;
  degraded?: boolean;
  photoThumbs?: string[];
}) {
  const good = verdict.freshnessScore >= 70;
  const mid = verdict.freshnessScore >= 45;
  const accent = good ? 'emerald' : mid ? 'amber' : 'rose';
  return (
    <div className={`rounded-2xl border p-4 ${good ? 'bg-emerald-50 border-emerald-200' : mid ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-extrabold uppercase tracking-widest text-${accent}-700 flex items-center gap-1.5`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          Hasil Verifikasi Naiad{verdict.photosAnalyzed ? ' · Analisis Foto' : ''}
        </span>
        <FreshnessBadge score={verdict.freshnessScore} />
      </div>

      {(photoThumbs?.length ?? 0) > 0 && (
        <div className="flex gap-2 mb-3">
          {photoThumbs!.map((t, i) => (
            <img
              key={i}
              src={t}
              alt={`Foto tangkapan ${i + 1}`}
              className="w-16 h-16 rounded-lg object-cover border border-white shadow-sm flex-shrink-0"
            />
          ))}
        </div>
      )}

      {verdict.visualFindings && verdict.visualFindings.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Temuan Visual dari Foto</p>
          <ul className="space-y-1">
            {verdict.visualFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-zinc-700 leading-relaxed">
                <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.69a1.5 1.5 0 0 0-2.12 0l-.88.88.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0z" clipRule="evenodd" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-700">{verdict.summary}</p>

      {verdict.changes.length > 0 && (
        <div className="mt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Perubahan Teramati</p>
          <ul className="space-y-1">
            {verdict.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-zinc-700 leading-relaxed">
                <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                </svg>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Saran Penanganan</p>
        <ul className="space-y-1">
          {verdict.storageAdvice.map((a, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] text-zinc-700 leading-relaxed">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      {verdict.risks.length > 0 && (
        <div className="mt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Peringatan</p>
          <ul className="space-y-1">
            {verdict.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-rose-700 leading-relaxed">
                <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" clipRule="evenodd" />
                </svg>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {degraded && (
        <p className="text-[8px] text-zinc-400 italic mt-2.5">
          Heuristik (model AI tidak terjangkau) — interpretasi standar literatur perikanan.
        </p>
      )}
    </div>
  );
}

function PastVerification({ record }: { record: VerifikasiHistoryItem }) {
  const { verdict, input } = record;
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          {input.species} · {OPTION_LABELS[input.eyes]?.toLowerCase() ?? input.eyes} · {OPTION_LABELS[input.smell]?.toLowerCase() ?? input.smell}
        </span>
        <FreshnessBadge score={verdict.freshnessScore} />
      </div>
      {(input.photoThumbs?.length ?? 0) > 0 && (
        <div className="flex gap-1.5 mb-1.5">
          {input.photoThumbs!.slice(0, 3).map((t, i) => (
            <img key={i} src={t} alt={`Foto ${i + 1}`} className="w-10 h-10 rounded-lg object-cover border border-zinc-200 flex-shrink-0" />
          ))}
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-zinc-600 line-clamp-2">{verdict.summary}</p>
    </div>
  );
}

export default function VerifikasiTangkapan({
  analysis,
  uid,
  regionName,
  analysisId,
  existingVerifications,
  onSaved,
}: VerifikasiTangkapanProps) {
  const bestZone = useMemo(() => {
    const s = analysis.scores[0];
    return s ? analysis.zones[s.zoneIndex] : undefined;
  }, [analysis]);

  const [species, setSpecies] = useState(bestZone?.species[0] ?? 'Ikan pelagis campuran');
  const [weather, setWeather] = useState('berawan');
  const [waterTemp, setWaterTemp] = useState<number>(Math.round(bestZone?.meanSst ?? 28));
  const [holdHours, setHoldHours] = useState('2-6');
  const [eyes, setEyes] = useState('jernih');
  const [gills, setGills] = useState('merah-segar');
  const [smell, setSmell] = useState('khas-laut');
  const [flesh, setFlesh] = useState('kenyal');

  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<TangkapanVerificationVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoThumbs, setPhotoThumbs] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const speciesOptions = useMemo(() => {
    const set = new Set<string>();
    analysis.zones.forEach((z) => z.species.forEach((s) => set.add(s)));
    if (set.size === 0) set.add('Ikan pelagis campuran');
    return [...set];
  }, [analysis]);

  const handlePhotosSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setPhotoError(null);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`Maksimal ${MAX_PHOTOS} foto per verifikasi.`);
      return;
    }
    const batch = files.slice(0, remaining);
    for (const file of batch) {
      const compressed = await fileToCompressedDataUrls(file);
      if (!compressed) {
        setPhotoError('Salah satu foto gagal diproses (format tidak didukung).');
        continue;
      }
      setPhotos((prev) => [...prev, compressed.full]);
      setPhotoThumbs((prev) => [...prev, compressed.thumb]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoThumbs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const baseInput: Omit<TangkapanVerificationInput, 'photos' | 'photoThumbs'> = {
        species,
        weather,
        waterTemp,
        holdHours,
        eyes,
        gills,
        smell,
        flesh,
      };
      const input: TangkapanVerificationInput = {
        ...baseInput,
        photos: photos.length > 0 ? photos : undefined,
        photoThumbs: photoThumbs.length > 0 ? photoThumbs : undefined,
      };
      const res = await fetch('/api/ai/verifikasi-tangkapan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, input, photos: photos.length > 0 ? photos : undefined }),
      });
      const payload = await res.json();
      if (!payload?.verdict) {
        throw new Error(payload.error ?? 'Verifikasi gagal');
      }
      const v = payload.verdict as TangkapanVerificationVerdict;
      setVerdict(v);
      if (uid) {
        try {
          await saveFishVerification(uid, {
            analysisId: analysisId ?? null,
            regionName,
            input: {
              ...baseInput,
              photoThumbs: photoThumbs.length > 0 ? photoThumbs : undefined,
            },
            verdict: v,
          });
          onSaved?.();
        } catch (err) {
          console.warn('[VerifikasiTangkapan] save skipped:', err);
        }
      }
    } catch (err) {
      console.error('[VerifikasiTangkapan] Error:', err);
      setError('Gagal memverifikasi tangkapan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

const optionBtn = (selected: boolean, active: boolean) =>
  `px-3 py-2 rounded-xl border text-[10px] font-bold transition-colors flex-1 ${
    selected
      ? 'bg-[#162e52] text-white border-[#162e52] shadow'
      : active
        ? 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#162e52]/40'
        : 'bg-white text-zinc-400 border-zinc-200/60'
  }`;

const MAX_PHOTOS = 3;

/** Baca file foto lalu kompres: versi AI (max 1024px) & thumbnail (max 512px). */
async function fileToCompressedDataUrls(
  file: File
): Promise<{ full: string; thumb: string } | null> {
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

    return { full: toDataUrl(1024, 0.72), thumb: toDataUrl(512, 0.6) };
  } catch (err) {
    console.warn('[VerifikasiTangkapan] photo skip:', err);
    return null;
  }
}

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3 3 0 1 0 6 0c0-1.2-1.5-3-3-5.5-1.5 2.5-3 4.3-3 5.5z" />
              <path strokeLinecap="round" d="M10 21h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#162e52] leading-tight">Verifikasi Tangkapan</h3>
            <p className="text-[10px] text-zinc-400 font-medium">
              AI Model 2 · cek kesegaran ikan setelah ditangkap (cuaca & suhu)
            </p>
          </div>
        </div>
        <svg className="w-5 h-5 text-sky-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
        </svg>
      </div>

      <div className="p-5 space-y-4">
        {(existingVerifications?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Verifikasi Terdahulu ({existingVerifications!.length})
            </p>
            {existingVerifications!.map((r, i) => (
              <PastVerification key={r.refId ?? i} record={r} />
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">Spesies Ditangkap</label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-[11px] font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#162e52]/30 bg-white"
              >
                {speciesOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">Suhu Air saat Menangkap (°C)</label>
              <input
                type="number"
                step="0.5"
                min={10}
                max={40}
                value={waterTemp}
                onChange={(e) => setWaterTemp(Number(e.target.value))}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-[11px] font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#162e52]/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">Cuaca saat Menangkap</label>
            <div className="flex gap-2 mt-1.5">
              {WEATHER_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWeather(w.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-[10px] font-bold transition-colors ${
                    weather === w.id
                      ? 'bg-[#162e52] text-white border-[#162e52] shadow'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-[#162e52]/40'
                  }`}
                >
                  <WeatherIcon kind={w.icon} className="w-3.5 h-3.5 flex-shrink-0" />
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">Lama Penyimpanan sejak Ditangkap</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {HOLD_OPTIONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHoldHours(h.id)}
                  className={optionBtn(holdHours === h.id, true)}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Kondisi Mata', value: eyes, set: setEyes, options: EYES_OPTIONS },
            { label: 'Warna Insang', value: gills, set: setGills, options: GILLS_OPTIONS },
            { label: 'Bau', value: smell, set: setSmell, options: SMELL_OPTIONS },
            { label: 'Tekstur Daging', value: flesh, set: setFlesh, options: FLESH_OPTIONS },
          ].map((group) => (
            <div key={group.label}>
              <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">{group.label}</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {group.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => group.set(o)}
                    className={optionBtn(group.value === o, true)}
                  >
                    {OPTION_LABELS[o] ?? o}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-[#162e52]">Foto Tangkapan (opsional, maks 3)</label>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {photoThumbs.map((t, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={t} alt={`Foto ${i + 1}`} className="w-14 h-14 rounded-xl object-cover border border-zinc-300" />
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
              {photoThumbs.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-14 h-14 rounded-xl border-2 border-dashed border-sky-300 text-sky-600 flex flex-col items-center justify-center gap-0.5 hover:bg-sky-50 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="text-[8px] font-bold">Tambah</span>
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotosSelected}
              />
            </div>
            {photoError && (
              <p className="text-[9px] font-bold text-amber-600 mt-1.5">{photoError}</p>
            )}
            <p className="text-[9px] text-zinc-400 font-medium mt-1.5">
              Foto mata, insang & lendir ikan. Terkirim sebagai Data URL — analisis memakai model vision Naiad.
            </p>
          </div>

          {error && (
            <p className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-5 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menganalisis kesegaran…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Verifikasi Kesegaran Tangkapan
              </>
            )}
          </button>
        </form>

        {verdict && <VerdictCard verdict={verdict} degraded={verdict.degraded} photoThumbs={photoThumbs} />}
      </div>
    </div>
  );
}