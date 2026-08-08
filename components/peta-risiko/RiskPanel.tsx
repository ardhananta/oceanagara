'use client';

import type { RiskAnalysisResult, RiskPoint, RiskSource } from '@/app/types/maritime';
import {
  bearingDeg,
  cardinalFromBearing,
  formatKm,
  nearestCoast,
  nearestPort,
  type NearestCoast,
  type NearestPort,
} from './distances';

interface RiskPanelProps {
  result: RiskAnalysisResult;
  onReset: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  kilang: '#7c3aed',
  pltu: '#ea580c',
  'kawasan-industri': '#dc2626',
  smelter: '#db2777',
  pelabuhan: '#6366f1',
  kapal: '#38bdf8',
  muara: '#0d9488',
};

const SOURCE_ICON: Record<string, string> = {
  kilang: 'M17 3l-3.6 7.2L7 12l6.4 1.8L17 21l3.6-7.2L27 12l-6.4-1.8L17 3z',
  pltu: 'M12 3v2m0 4v2m0 4v2m6-10V7m0 6v2M4 7v2m0 6v2M12 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-9 0h4m10 0h4',
  'kawasan-industri': 'M3 21h18M6 21v-9l6-4 6 4v9m-9-9h6m-6 4h6m-6 4h6',
  smelter: 'M4 17l8-10 8 10H4z',
  pelabuhan: 'M19 14V6m0 0-8 2m8-2 4 2v8M19 6l-4 1m4 7 4 2m-4-2-4 2m4-9v9M7 14V8l-4 2m4-2 8-2m-8 2 4 1',
  kapal: 'M3 18h18m-18 0l3-8 6 2 6-4 3 10M12 6l2-2',
  muara: 'M4 18h16M6 18v-5M10 18v-8M14 18v-5M18 18v-8M3 21h18',
};

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

// Memoize distance computations per coordinate (same point queried by map + panel)
const distCache = new Map<string, { coast: NearestCoast | null; port: NearestPort | null }>();

function getDistances(lat: number, lon: number): { coast: NearestCoast | null; port: NearestPort | null } {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = distCache.get(key);
  if (cached) return cached;
  const result = { coast: nearestCoast(lat, lon), port: nearestPort(lat, lon) };
  distCache.set(key, result);
  return result;
}

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

function SourceChip({ source }: { source: RiskSource }) {
  const color = SOURCE_COLORS[source.kind] ?? '#94a3b8';
  const isProximity = source.kind === 'kapal' || source.kind === 'muara';
  return (
    <div className="bg-white/70 border rounded-lg px-2.5 py-1.5 flex items-start gap-2" style={{ borderColor: color + '55' }}>
      <svg
        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={SOURCE_ICON[source.kind] ?? SOURCE_ICON.kapal} />
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-zinc-900 leading-tight">{source.name}</p>
        <p className="text-[9px] font-semibold text-zinc-500 mt-0.5">
          {isProximity
            ? source.detail ?? source.direction
            : `${formatKm(source.distanceKm)} · ${source.direction}`}
        </p>
      </div>
    </div>
  );
}

function RiskPointCard({ point, rank }: { point: RiskPoint; rank: number }) {
  const { coast, port } = getDistances(point.lat, point.lon);
  const sources = point.nearbySources ?? [];
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

      {/* Waste form & spill radius info */}
      {(point.wasteForm || typeof point.spillRadiusKm === 'number') && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {point.wasteForm && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
              <svg className="w-3 h-3 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Bentuk: {point.wasteForm}
            </span>
          )}
          {typeof point.spillRadiusKm === 'number' && point.spillRadiusKm > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded-lg px-2 py-1">
              <svg className="w-3 h-3 text-sky-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25 21 12m0 0-5.25 3.75M21 12H3" />
              </svg>
              Radius sebaran {formatKm(point.spillRadiusKm)} km
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-600 leading-relaxed">{point.description}</p>

      {/* Distance stats: nearest coast & port */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-white/70 border border-teal-200/70 rounded-xl px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-teal-700 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 18h16M6 18v-5M10 18v-8M14 18v-5M18 18v-8M3 21h18" />
            </svg>
            Pesisir Terdekat
          </p>
          <p className="text-sm font-extrabold text-teal-800 mt-0.5 tabular-nums">
            {coast ? `${formatKm(coast.distanceKm)} km` : '—'}
          </p>
          {coast && coast.distanceKm > 0 && (
            <p className="text-[9px] text-teal-600 font-semibold">
              {cardinalFromBearing(bearingDeg({ lat: point.lat, lon: point.lon }, coast.point))} dari titik
            </p>
          )}
        </div>
        <div className="bg-white/70 border border-indigo-200/70 rounded-xl px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14V6m0 0-8 2m8-2 4 2v8M19 6l-4 1m4 7 4 2m-4-2-4 2m4-9v9M7 14V8l-4 2m4-2 8-2m-8 2 4 1" />
            </svg>
            Pelabuhan Terdekat
          </p>
          <p className="text-sm font-extrabold text-indigo-800 mt-0.5 tabular-nums">
            {port ? `${formatKm(port.distanceKm)} km` : '—'}
          </p>
          {port && (
            <p className="text-[9px] text-indigo-600 font-semibold truncate">{port.port.name}</p>
          )}
        </div>
      </div>

      {/* Sumber pencemaran terdeteksi */}
      {sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-200/60">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-fuchsia-700 flex items-center gap-1 mb-2">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            Sumber Pencemaran Terdeteksi
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {sources.map((src, i) => (
              <SourceChip key={i} source={src} />
            ))}
          </div>
        </div>
      )}

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
