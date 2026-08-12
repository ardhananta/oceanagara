'use client';

import type { FishScanIndicator, FishScanResult } from '@/app/types/maritime';

const STATUS_META = {
  good: { label: 'Segar', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  fair: { label: 'Mulai Berubah', cls: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  bad: { label: 'Tidak Segar', cls: 'bg-rose-100 text-rose-700 border-rose-200', bar: 'bg-rose-500' },
} as const;

function IndicatorIcon({ key }: { key: string }) {
  if (key === 'eyes') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    );
  }
  if (key === 'gills') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.105 2.701a1.5 1.5 0 0 1 1.962-.362l.229.141a1.5 1.5 0 0 0 1.962-.362A1.5 1.5 0 0 1 7.322 2.5H7.5a1.5 1.5 0 0 1 1.962.362 1.5 1.5 0 0 0 1.962.362l.229-.141a1.5 1.5 0 0 1 1.962.362L16.1 4.32a1.5 1.5 0 0 0 1.962.362l.229-.141a1.5 1.5 0 0 1 1.962.362l1.084 1.084a1.5 1.5 0 0 1-.362 2.362l-.229.141a1.5 1.5 0 0 0 0 2.581l.229.141a1.5 1.5 0 0 1 .362 2.362l-1.084 1.084a1.5 1.5 0 0 1-1.962.362l-.229-.141a1.5 1.5 0 0 0-1.962.362 1.5 1.5 0 0 1-1.962.362L7.323 22.5H7.5a1.5 1.5 0 0 1-1.962-.362 1.5 1.5 0 0 0-1.962-.362l-.229.141a1.5 1.5 0 0 1-1.962-.362L.301 20.471a1.5 1.5 0 0 1 .362-2.362l.229-.141a1.5 1.5 0 0 0 0-2.581l-.229-.141a1.5 1.5 0 0 1-.362-2.362L1.084 9.9a1.5 1.5 0 0 1 1.962-.362l.229.141a1.5 1.5 0 0 0 1.962-.362L5.616 8.8a1.5 1.5 0 0 1 1.962-.362z" />
    );
  }
  if (key === 'scales') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    );
  }
  if (key === 'slime') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.237a7.5 7.5 0 0 1-2.031.37m-12.002-.37a7.5 7.5 0 0 1-2.031-.37c-.483-.209-.711-.738-.59-1.237L6.75 4.97" />
    );
  }
  if (key === 'abdomen') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4.5-9h9" />
    );
  }
  if (key === 'rigor') {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    );
  }
  return (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
  );
}

function IndicatorRow({ indicator }: { indicator: FishScanIndicator }) {
  const meta = STATUS_META[indicator.status];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <IndicatorIcon key={indicator.key} />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[#162e52] leading-tight">{indicator.name}</p>
            <p className="text-[9px] text-zinc-400 font-semibold">{indicator.score}/100</p>
          </div>
        </div>
        <span className={`text-[9px] font-extrabold rounded-full px-2 py-0.5 border flex-shrink-0 ${meta.cls}`}>
          {meta.label}
        </span>
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed">{indicator.observation}</p>
      <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={{ width: `${indicator.score}%` }}
        />
      </div>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#059669' : score >= 45 ? '#f59e0b' : '#ef4444';
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="#eef2f7" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-[#162e52]" style={{ color }}>
          {score}
        </span>
        <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">/ 100</span>
      </div>
    </div>
  );
}

interface ScanResultProps {
  result: FishScanResult;
  photoThumbs: string[];
  onReset: () => void;
}

export default function ScanResult({ result, photoThumbs, onReset }: ScanResultProps) {
  const good = result.freshnessScore >= 70;
  const mid = result.freshnessScore >= 45;
  const accent = good ? 'emerald' : mid ? 'amber' : 'rose';
  const accentText = { emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[accent];
  const accentBg = { emerald: 'bg-emerald-50 border-emerald-200', amber: 'bg-amber-50 border-amber-200', rose: 'bg-rose-50 border-rose-200' }[accent];

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-5 ${accentBg}`}>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <ScoreGauge score={result.freshnessScore} />

          <div className="min-w-0 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${accentText}`}>
                Hasil Scan {good ? '· Ikan Segar' : mid ? '· Mulai Berubah' : '· Tidak Segar'}
              </span>
              {result.degraded && (
                <span className="text-[8px] font-bold text-zinc-500 bg-white/70 border border-zinc-200 rounded-full px-2 py-0.5">
                  Estimasi (heuristik)
                </span>
              )}
            </div>
            <h4 className="text-base font-extrabold text-[#162e52] mt-0.5">
              {result.species}
            </h4>
            <p className="text-[11px] leading-relaxed text-zinc-600 mt-1">{result.summary}</p>
          </div>
        </div>

        {(photoThumbs?.length ?? 0) > 0 && (
          <div className="flex gap-2 mt-4 justify-center sm:justify-start">
            {photoThumbs.map((t, i) => (
              <img
                key={i}
                src={t}
                alt={`Foto scan ${i + 1}`}
                className="w-14 h-14 rounded-lg object-cover border border-white shadow-sm flex-shrink-0"
              />
            ))}
          </div>
        )}
      </div>

      {result.indicators.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
            Detail Indikator Fisik ({result.indicators.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.indicators.map((ind, i) => (
              <IndicatorRow key={`${ind.key}-${i}`} indicator={ind} />
            ))}
          </div>
        </div>
      )}

      {result.findings.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
            Temuan Visual dari Foto
          </p>
          <ul className="space-y-1.5">
            {result.findings.map((f, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.storageAdvice.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Saran Penanganan
            </p>
            <ul className="space-y-1.5">
              {result.storageAdvice.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[10px] text-zinc-700 leading-relaxed">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.risks.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Peringatan
            </p>
            <ul className="space-y-1.5">
              {result.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[10px] text-rose-700 leading-relaxed">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" clipRule="evenodd" />
                  </svg>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {result.degraded && (
        <p className="text-[9px] text-zinc-400 italic">
          Analisis foto gagal (model vision tidak terjangkau) — hasil merupakan perkiraan berbasis konteks penyimpanan; lakukan inspeksi fisik langsung.
        </p>
      )}

      <button
        onClick={onReset}
        className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 hover:text-sky-900 transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Scan ulang ikan lain
      </button>
    </div>
  );
}