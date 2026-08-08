'use client';

import type { RiskAnalysisResult, RiskPoint } from '@/app/types/maritime';

interface RiskPanelProps {
  result: RiskAnalysisResult;
  onReset: () => void;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const RISK_BG: Record<string, string> = {
  critical: 'bg-red-50/80 border-red-200 text-red-950',
  high: 'bg-orange-50/80 border-orange-200 text-orange-950',
  medium: 'bg-yellow-50/80 border-yellow-200 text-yellow-950',
  low: 'bg-emerald-50/80 border-emerald-200 text-emerald-950',
};

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-emerald-600 text-white',
};

const RISK_LABEL: Record<string, string> = {
  critical: 'KRITIS',
  high: 'TINGGI',
  medium: 'SEDANG',
  low: 'RENDAH',
};

function ScoreBadge({ score, level }: { score: number; level: string }) {
  const color = RISK_COLORS[level] ?? '#6b7280';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-zinc-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-zinc-800">{score}</span>
    </div>
  );
}

function RiskPointCard({ point, rank }: { point: RiskPoint; rank: number }) {
  return (
    <div className={`p-4 rounded-2xl border ${RISK_BG[point.riskLevel]} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-zinc-400 w-5">#{rank}</span>
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${RISK_BADGE[point.riskLevel]}`}>
            {RISK_LABEL[point.riskLevel]}
          </span>
        </div>
        <ScoreBadge score={point.riskScore} level={point.riskLevel} />
      </div>

      <p className="text-sm font-bold text-zinc-900 mb-1">{point.riskType}</p>
      <p className="text-xs text-zinc-600 leading-relaxed">{point.description}</p>

      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-zinc-200/60">
        <div className="flex items-center gap-1.5 text-[11px] text-[#162e52] font-mono font-semibold">
          <svg className="w-3.5 h-3.5 text-[#162e52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          {point.lat.toFixed(4)}, {point.lon.toFixed(4)}
        </div>
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
          {point.source}
        </span>
      </div>
    </div>
  );
}

export default function RiskPanel({ result, onReset }: RiskPanelProps) {
  const overallColor = RISK_COLORS[result.overallRiskLevel] ?? '#6b7280';

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto scrollbar-thin text-zinc-900">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-200 bg-zinc-50/50 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: overallColor }} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: overallColor }}>
                Tingkat Risiko {RISK_LABEL[result.overallRiskLevel]}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-[#162e52]">{result.locationName}</h3>
            <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
              Dianalisis pada {new Date(result.analysisTimestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button
            onClick={onReset}
            className="text-xs font-bold uppercase tracking-wider text-[#162e52] bg-white border border-zinc-300 hover:bg-zinc-100 px-3.5 py-2 rounded-xl transition-all shadow-sm flex-shrink-0"
          >
            Form Baru
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 py-5 flex-shrink-0 border-b border-zinc-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-[#162e52] text-white flex items-center justify-center font-bold text-xs">
            AI
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#162e52]">
            Ringkasan Analisis Agentic AI
          </span>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed font-normal">{result.summary}</p>
      </div>

      {/* Risk Points */}
      <div className="px-6 py-5 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
            {result.riskPoints.length} Lokasi Koordinat Risiko Teridentifikasi
          </p>
        </div>
        <div className="space-y-3">
          {result.riskPoints
            .sort((a, b) => b.riskScore - a.riskScore)
            .map((point, i) => (
              <RiskPointCard key={i} point={point} rank={i + 1} />
            ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="px-6 pb-5 flex-shrink-0">
        <div className="bg-[#162e52]/5 border border-[#162e52]/15 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#162e52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider text-[#162e52]">
              Rekomendasi &amp; Penanganan
            </span>
          </div>
          <ol className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2.5 text-xs text-zinc-700 leading-relaxed">
                <span className="text-[#162e52] font-extrabold flex-shrink-0 tabular-nums">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Data sources */}
      <div className="px-6 pb-6 flex-shrink-0 border-t border-zinc-100 pt-4">
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-2">
          Sumber Data Terintegrasi
        </p>
        <div className="flex flex-wrap gap-2">
          {result.dataSources.map((src) => (
            <span key={src} className="px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded-lg text-[10px] text-zinc-600 font-semibold">
              {src}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
