'use client';

import type { FishQualityAnalysis, FishQualityScore, FishingZone } from '@/app/types/maritime';
import { formatKm } from '@/components/peta-risiko/distances';

interface KualitasPanelProps {
  analysis: FishQualityAnalysis;
  onReset: () => void;
}

const qualityColor = (score: number): string => {
  if (score >= 85) return '#059669';
  if (score >= 65) return '#10b981';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
};

function KuraAiCard({ analysis }: { analysis: FishQualityAnalysis }) {
  const ai = analysis.aiAnalysis;
  if (!ai) return null;

  return (
    <div className="bg-gradient-to-br from-[#12203f] to-[#162e52] rounded-2xl p-4 text-white shadow-lg border border-[#1f4275]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-300">
          Analisis Agentic AI — Kura
        </span>
        {ai.degraded && (
          <span className="text-[8px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 rounded-lg px-1.5 py-0.5 ml-auto">
            Heuristik (AI rate-limited)
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-300 mb-1">Ringkasan</p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.summary}</p>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300 mb-1">
            Perubahan Iklim & Suhu
          </p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.climateImpact}</p>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
            Limbah & Polusi
          </p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.wasteImpact}</p>
        </div>

        <div className="rounded-xl bg-white/10 border border-white/15 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-300 mb-1">
            Prediksi Kawanan Berikutnya
          </p>
          <p className="text-[11px] font-bold text-violet-100 tabular-nums">
            {ai.nextSchool.lat.toFixed(4)}, {ai.nextSchool.lon.toFixed(4)}
          </p>
          <p className="text-[10px] leading-relaxed text-sky-100/80 mt-1">{ai.nextSchool.label}</p>
        </div>

        {ai.risks.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-rose-300 mb-1">Peringatan</p>
            <ul className="space-y-1">
              {ai.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-rose-100 leading-relaxed">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ai.recommendations.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
              Rekomendasi Tindakan
            </p>
            <ul className="space-y-1">
              {ai.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-emerald-50 leading-relaxed">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function QualityZoneCard({ zone, score, rank }: { zone: FishingZone; score: FishQualityScore; rank: number }) {
  const color = qualityColor(score.qualityScore);
  return (
    <div className="bg-zinc-50 border border-zinc-200/70 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0"
            style={{ background: color }}
          >
            {rank}
          </span>
          <p className="text-[11px] font-bold text-zinc-900 tabular-nums truncate">
            {score.lat.toFixed(4)}, {score.lon.toFixed(4)}
          </p>
        </div>
        <span
          className="text-[9px] font-extrabold rounded-lg px-1.5 py-0.5 border flex-shrink-0"
          style={{ color, background: `${color}14`, borderColor: `${color}55` }}
        >
          {score.qualityScore}/100 · {score.qualityLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {score.speciesQuality.map((s) => (
          <span
            key={s.species}
            className={`text-[9px] font-bold rounded-lg px-1.5 py-0.5 border ${
              s.quality >= 70
                ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                : 'text-amber-800 bg-amber-50 border-amber-300'
            }`}
            title={s.note}
          >
            {s.species} · {s.quality}/100
          </span>
        ))}
      </div>

      <div className="mt-2 rounded-lg bg-white border border-zinc-200 px-2 py-1.5">
        <p className="text-[9px] text-zinc-600 font-semibold leading-relaxed">
          {score.pressureSources.join(' · ')}
          {score.nearestContaminantKm !== null && (
            <span className="text-rose-600">
              {' '}· kontaminasi terdekat ±{score.nearestContaminantKm} km
              {score.nearestContaminantLabel ? ` (${score.nearestContaminantLabel})` : ''}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          Suhu {zone.meanSst}°C
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          Klorofil {zone.meanChl} mg/m³
        </span>
        <span
          className={`text-[9px] font-bold rounded-lg px-1.5 py-0.5 border ${
            score.ph !== undefined && score.ph >= 7.5 && score.ph <= 8.5
              ? 'text-sky-800 bg-sky-50 border-sky-300'
              : 'text-amber-800 bg-amber-50 border-amber-300'
          }`}
          title="Estimasi pH permukaan laut (heuristik klorofil × suhu)"
        >
          pH {score.ph?.toFixed(2) ?? '—'}
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          Stres suhu {score.sstStress}/100
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          {formatKm(zone.coastKm)} dari pantai
        </span>
      </div>

      {score.habRisk && (
        <p className="flex items-start gap-1.5 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1.5 mt-1.5">
          <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
          </svg>
          <span>Risiko ledakan alga (HAB) — waspadai kualitas tangkapan</span>
        </p>
      )}
      {score.ph !== undefined && (score.phStress ?? 0) > 40 && (
        <p className="flex items-start gap-1.5 text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded-lg px-2 py-1.5 mt-1.5">
          <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
          </svg>
          <span>pH {score.ph.toFixed(2)} — di luar kisaran optimal 7.5–8.5 (tekanan {score.phStress}/100)</span>
        </p>
      )}
    </div>
  );
}

export default function KualitasPanel({ analysis, onReset }: KualitasPanelProps) {
  const sorted = [...analysis.scores].sort((a, b) => b.qualityScore - a.qualityScore);
  const goodCount = sorted.filter((s) => s.qualityScore >= 65).length;
  const avgPh =
    sorted.length > 0 && sorted.some((s) => s.ph !== undefined)
      ? sorted.reduce((a, s) => a + (s.ph ?? 0), 0) / sorted.filter((s) => s.ph !== undefined).length
      : null;

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-zinc-200 bg-zinc-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                Analisis Kualitas Ikan
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#162e52] leading-snug">
              {goodCount} dari {sorted.length} zona berstatus baik
            </h3>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
              Citra: {analysis.date} · skor 0–100 (tinggi = kualitas lebih baik)
              {avgPh !== null ? ` · pH rata-rata ≈ ${avgPh.toFixed(2)}` : ''}
            </p>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] font-bold uppercase tracking-wider text-[#162e52] bg-white border border-zinc-300 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition-all shadow-sm flex-shrink-0"
          >
            Form Baru
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <KuraAiCard analysis={analysis} />

        {sorted.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-amber-900">Tidak ada zona aman yang dinilai</p>
            <p className="text-[9px] text-amber-800/80 mt-1">{analysis.summary}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-600 leading-relaxed">{analysis.summary}</p>
            <div className="space-y-2">
              {sorted.map((s, i) => {
                const zone = analysis.zones[s.zoneIndex];
                if (!zone) return null;
                return <QualityZoneCard key={`${s.lat}-${s.lon}`} zone={zone} score={s} rank={i + 1} />;
              })}
            </div>
          </>
        )}
        <p className="text-[9px] text-zinc-400 italic leading-relaxed">{analysis.disclaimer}</p>
      </div>
    </div>
  );
}