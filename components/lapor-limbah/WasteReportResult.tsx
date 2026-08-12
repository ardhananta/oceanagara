'use client';

import type { WasteLocationInfo, WasteReportValidation } from '@/app/types/maritime';

const STATUS_META = {
  verified: {
    label: 'TERVERIFIKASI',
    short: 'Laporan Sah',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ring: 'text-emerald-600',
  },
  suspected: {
    label: 'PERLU DIUJI',
    short: 'Mencurigakan',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
    ring: 'text-amber-600',
  },
  rejected: {
    label: 'DITOLAK',
    short: 'Tidak Sah',
    cls: 'bg-rose-100 text-rose-800 border-rose-300',
    ring: 'text-rose-600',
  },
} as const;

function CheckIcon({ ok }: { ok: 'ok' | 'warn' | 'fail' }) {
  if (ok === 'ok') {
    return (
      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  if (ok === 'warn') {
    return (
      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

interface WasteReportResultProps {
  validation: WasteReportValidation;
  location: WasteLocationInfo;
  thumbs: string[];
  reportCode?: string | null;
  saveError?: string | null;
  duplicate?: boolean;
  onReset: () => void;
}

export default function WasteReportResult({
  validation,
  location,
  thumbs,
  reportCode,
  saveError,
  duplicate,
  onReset,
}: WasteReportResultProps) {
  const meta = STATUS_META[validation.status];
  const photoOk = validation.photoCheck.genuine;
  const timeOk = validation.timestampCheck.verdict === 'valid' || validation.timestampCheck.verdict === 'unverifiable';

  return (
    <div className="space-y-4">
      {/* Ringkasan status */}
      <div className="rounded-2xl border p-5 bg-white">
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <div className="relative w-24 h-24 flex-shrink-0 mx-auto sm:mx-0">
            <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90">
              <circle cx="52" cy="52" r="44" fill="none" stroke="#eef2f7" strokeWidth="10" />
              <circle
                cx="52"
                cy="52"
                r="44"
                fill="none"
                stroke={validation.status === 'verified' ? '#059669' : validation.status === 'suspected' ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(validation.confidence / 100) * 276.5} 276.5`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-zinc-800">{validation.confidence}</span>
              <span className="text-[7px] font-extrabold uppercase tracking-wider text-zinc-400">Keyakinan</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <span className={`inline-block px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full border ${meta.cls}`}>
              {meta.label}
            </span>
            <h4 className="text-base font-extrabold text-[#162e52] mt-2">
              {validation.summary}
            </h4>
            {reportCode && (
              <p className="text-[10px] font-bold text-zinc-500 mt-1.5 font-mono">
                {reportCode}{duplicate ? ' · laporan serupa sudah tercatat' : ''}
              </p>
            )}
            {saveError && (
              <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
                {saveError}
              </p>
            )}
          </div>
        </div>

        {thumbs.length > 0 && (
          <div className="flex gap-2 mt-4 justify-center sm:justify-start">
            {thumbs.map((t, i) => (
              <img key={i} src={t} alt={`Foto laporan ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-zinc-200 shadow-sm flex-shrink-0" />
            ))}
          </div>
        )}
      </div>

      {/* 3 lapis validasi */}
      <div className="grid sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/60">
          <div className="flex items-center gap-2.5">
            <CheckIcon ok={photoOk ? 'ok' : 'fail'} />
            <p className="text-[11px] font-extrabold text-zinc-800">Keaslian Foto</p>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">
            {validation.photoCheck.genuine
              ? `${validation.photoCheck.wasteType} di ${validation.photoCheck.environment} — terlihat asli (skor ${validation.photoCheck.score}/100).`
              : `Foto tidak meyakinkan sebagai rekaman asli (skor ${validation.photoCheck.score}/100): ${validation.photoCheck.note}`}
          </p>
          {validation.photoCheck.riskSigns.length > 0 && (
            <ul className="mt-2 space-y-1">
              {validation.photoCheck.riskSigns.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[9px] text-rose-700 leading-relaxed">
                  <span className="mt-1 w-1 h-1 rounded-full bg-rose-500 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/60">
          <div className="flex items-center gap-2.5">
            <CheckIcon ok={validation.locationCheck.verdict === 'match' ? 'ok' : validation.locationCheck.verdict === 'mismatch' ? 'fail' : 'warn'} />
            <p className="text-[11px] font-extrabold text-zinc-800">Lokasi</p>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">
            {validation.locationCheck.note}
          </p>
          <p className="text-[9px] text-zinc-500 font-mono mt-2">
            {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
            {location.accuracyMeters ? ` · ±${location.accuracyMeters} m` : ''}
            {location.source === 'manual' ? ' · input manual' : ''}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/60">
          <div className="flex items-center gap-2.5">
            <CheckIcon ok={timeOk ? 'ok' : 'warn'} />
            <p className="text-[11px] font-extrabold text-zinc-800">Waktu</p>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">
            {validation.timestampCheck.note}
          </p>
          {validation.timestampCheck.photoTime && (
            <p className="text-[9px] text-zinc-500 font-mono mt-2">
              EXIF: {new Date(validation.timestampCheck.photoTime).toLocaleString('id-ID')}
            </p>
          )}
        </div>
      </div>

      {/* Temuan & rekomendasi */}
      {validation.findings.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
            Temuan Visual
          </p>
          <ul className="space-y-1.5">
            {validation.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[10px] text-zinc-700 leading-relaxed">
                <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.69a1.5 1.5 0 0 0-2.12 0l-.88.88.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0z" clipRule="evenodd" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          Rekomendasi Tindak Lanjut
        </p>
        <ul className="space-y-1.5">
          {validation.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-[10px] text-zinc-700 leading-relaxed">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {validation.degraded && (
        <p className="text-[9px] text-zinc-400 italic">
          Validasi AI tidak terjangkau — hasil ini berbasis cek geospasial (GPS & waktu EXIF) saja. Peneliti tetap dapat meninjau foto secara manual.
        </p>
      )}

      <button
        onClick={onReset}
        className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 hover:text-sky-900 transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Buat laporan lain
      </button>
    </div>
  );
}