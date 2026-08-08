'use client';

import { useEffect, useState } from 'react';
import type {
  RiskAnalysisResult,
  RiskPoint,
  RiskSource,
  SatelliteAnalysis,
  SatelliteAnomaly,
  SatelliteSolidWasteAnalysis,
  SatelliteWasteCandidate,
} from '@/app/types/maritime';
import {
  bearingDeg,
  cardinalFromBearing,
  formatKm,
  nearestCoast,
  nearestPort,
  type NearestCoast,
  type NearestPort,
} from './distances';
import {
  loadMyFeedback,
  loadWasteFeedbackStats,
  saveWasteFeedback,
  type WasteFeedbackStats,
  type WasteVerdict,
} from '@/app/service/wasteFeedback';

interface RiskPanelProps {
  result: RiskAnalysisResult;
  satellite?: SatelliteAnalysis | null;
  /** Deteksi sampah padat terapung Sentinel-2 (indeks FDI) */
  solidWaste?: SatelliteSolidWasteAnalysis | null;
  /** UID peneliti yang login (untuk simpan verifikasi lapangan) */
  uid?: string | null;
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

const ANOMALY_META: Record<SatelliteAnomaly['kind'], { label: string; color: string; bg: string }> = {
  bloom: { label: 'Klorofil tinggi', color: '#b91c1c', bg: 'bg-red-50 border-red-300 text-red-900' },
  slick: { label: 'Area gelap (slick?)', color: '#0f172a', bg: 'bg-zinc-100 border-zinc-400 text-zinc-900' },
  thermal: { label: 'Termal hangat', color: '#c2410c', bg: 'bg-orange-50 border-orange-300 text-orange-900' },
  turbidity: { label: 'Plume sedimen', color: '#7c2d12', bg: 'bg-amber-50 border-amber-300 text-amber-900' },
  cloud: { label: 'Tutupan awan', color: '#64748b', bg: 'bg-slate-100 border-slate-300 text-slate-700' },
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

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200/70 rounded-xl px-3 py-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-extrabold mt-0.5" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-zinc-500 font-semibold">{sub}</p>}
    </div>
  );
}

function SatelliteCard({ satellite }: { satellite: SatelliteAnalysis }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600 leading-relaxed">{satellite.summary}</p>

      <div className="space-y-2">
        {satellite.layers.map((layer) => (
          <div key={layer.layer} className="bg-zinc-50 border border-zinc-200/70 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-zinc-900 leading-tight">{layer.label}</p>
              <span className="text-[9px] font-bold text-zinc-500 flex-shrink-0 tabular-nums">
                {new Date(layer.imageryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-[9px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-300 rounded-lg px-1.5 py-0.5">
                Cakupan {layer.coveragePct}%
              </span>
              {typeof layer.cloudPct === 'number' && layer.cloudPct > 1 && (
                <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-300 rounded-lg px-1.5 py-0.5">
                  Awan {layer.cloudPct}%
                </span>
              )}
              {layer.ph && (
                <span
                  className={`text-[9px] font-bold rounded-lg px-1.5 py-0.5 border ${
                    layer.ph.avg > 8.4
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : layer.ph.avg < 7.5
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-teal-50 border-teal-300 text-teal-900'
                  }`}
                  title={`pH estimasi ${layer.ph.min}–${layer.ph.max}`}
                >
                  pH {layer.ph.avg} ({layer.ph.min}–{layer.ph.max})
                </span>
              )}
              {typeof layer.medianChl === 'number' && (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg px-1.5 py-0.5">
                  Klorofil {layer.medianChl} mg/m³
                </span>
              )}
              {typeof layer.medianSst === 'number' && (
                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-300 rounded-lg px-1.5 py-0.5">
                  Suhu {layer.medianSst}°C
                </span>
              )}
              {layer.anomalies
                .filter((a) => a.kind !== 'cloud')
                .map((a, i) => {
                  const meta = ANOMALY_META[a.kind];
                  return (
                    <span
                      key={i}
                      className={`text-[9px] font-bold rounded-lg px-1.5 py-0.5 border ${meta.bg}`}
                      title={a.note}
                    >
                      {meta.label} · {a.areaKm2.toLocaleString('id-ID')} km²
                      {a.ph ? ` · pH ${a.ph}` : ''}
                      {typeof a.chl === 'number' ? ` · ${a.chl} mg/m³` : ''}
                      {typeof a.sst === 'number' ? ` · ${a.sst}°C` : ''}
                    </span>
                  );
                })}
              {layer.anomalies.filter((a) => a.kind !== 'cloud').length === 0 && (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg px-1.5 py-0.5">
                  Tidak ada anomali
                </span>
              )}
            </div>
            {layer.ph && (layer.ph.acidFraction > 0.02 || layer.ph.alkalineFraction > 0.02) && (
              <p className="text-[9px] text-zinc-500 font-semibold mt-1.5">
                {layer.ph.acidFraction > 0.02
                  ? `${(layer.ph.acidFraction * 100).toFixed(0)}% area cenderung asam (pH < 7.5)`
                  : `${(layer.ph.alkalineFraction * 100).toFixed(0)}% area cenderung basa (pH > 8.4)`}
                {' '}— tanda aktivitas biologis/dekomposisi
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[9px] text-zinc-400 italic leading-relaxed">{satellite.disclaimer}</p>
    </div>
  );
}

const candidateKeyOf = (c: SatelliteWasteCandidate) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

function SolidWasteCard({ solidWaste, uid }: { solidWaste: SatelliteSolidWasteAnalysis; uid?: string | null }) {
  const [stats, setStats] = useState<WasteFeedbackStats | null>(null);
  const [myFeedback, setMyFeedback] = useState<Record<string, WasteVerdict>>({});

  useEffect(() => {
    let cancelled = false;
    loadWasteFeedbackStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    if (uid) {
      loadMyFeedback(
        uid,
        solidWaste.candidates.map(candidateKeyOf)
      ).then((list) => {
        if (cancelled) return;
        const map: Record<string, WasteVerdict> = {};
        for (const f of list) map[f.candidateKey] = f.verdict;
        setMyFeedback(map);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [uid, solidWaste]);

  const submitVerdict = async (c: SatelliteWasteCandidate, verdict: WasteVerdict) => {
    if (!uid) return;
    await saveWasteFeedback({
      uid,
      candidateKey: candidateKeyOf(c),
      lat: c.lat,
      lon: c.lon,
      verdict,
    });
    setMyFeedback((prev) => ({ ...prev, [candidateKeyOf(c)]: verdict }));
    const s = await loadWasteFeedbackStats();
    setStats(s);
  };

  const accuracyLabel = stats && stats.accuracy !== null
    ? `${Math.round(stats.accuracy * 100)}% (${stats.confirmed} tervalidasi dari ${stats.total} laporan)`
    : 'Belum ada laporan verifikasi lapangan';

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600 leading-relaxed">{solidWaste.summary}</p>

      {stats && stats.total > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-teal-900">
            Akurasi terverifikasi lapangan: {accuracyLabel}
          </p>
          <p className="text-[9px] text-teal-700/80 mt-0.5">
            Persentase kandidat yang dikonfirmasi benar-benar limbah oleh peneliti.
          </p>
        </div>
      )}

      {solidWaste.candidates.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-emerald-800">
            Tidak ada kandidat sampah padat terapung yang lolos ambang kepercayaan ≥ 70%
          </p>
          <p className="text-[9px] text-emerald-700/80 mt-1">
            {solidWaste.dates.length > 0
              ? `Citra dianalisis: ${solidWaste.dates
                  .map((d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))
                  .join(', ')} (cakupan bersih ${solidWaste.coveragePct}%).`
              : 'Tidak ada citra bebas awan tersedia.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {solidWaste.candidates.map((c, i) => {
            const key = candidateKeyOf(c);
            const mine = myFeedback[key];
            return (
              <div key={i} className="bg-zinc-50 border border-zinc-200/70 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-zinc-900 tabular-nums">
                    {c.lat.toFixed(4)}, {c.lon.toFixed(4)}
                  </p>
                  <span className="text-[9px] font-extrabold text-rose-800 bg-rose-50 border border-rose-300 rounded-lg px-1.5 py-0.5">
                    Kepercayaan {Math.round(c.confidence * 100)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
                    ≈{(c.areaM2 / 1000).toLocaleString('id-ID')} ribu m²
                  </span>
                  <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
                    {c.observedDates.length}x terlihat ({c.observedDates
                      .map((d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))
                      .join(', ')})
                  </span>
                  <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
                    {formatKm(c.coastKm)} dari pantai
                  </span>
                </div>

                {/* Verifikasi lapangan */}
                {uid && (
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button
                      onClick={() => submitVerdict(c, 'confirmed')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-colors ${
                        mine === 'confirmed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {mine === 'confirmed' ? 'Tervalidasi' : 'Tervalidasi'}
                    </button>
                    <button
                      onClick={() => submitVerdict(c, 'rejected')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-colors ${
                        mine === 'rejected'
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white border-red-300 text-red-700 hover:bg-red-50'
                      }`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                      {mine === 'rejected' ? 'Bukan limbah' : 'Bukan limbah'}
                    </button>
                    {mine && (
                      <span className="text-[9px] text-zinc-500 font-semibold ml-1">
                        {mine === 'confirmed' ? '✓ Terverifikasi oleh Anda' : '✗ Ditandai bukan limbah oleh Anda'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-zinc-400 italic leading-relaxed">{solidWaste.disclaimer}</p>
    </div>
  );
}

export default function RiskPanel({ result, satellite, solidWaste, uid, onReset }: RiskPanelProps) {
  const overallColor = RISK_COLORS[result.overallRiskLevel] ?? '#6b7280';
  const [tab, setTab] = useState('ringkasan');

  const sortedPoints = [...result.riskPoints].sort((a, b) => b.riskScore - a.riskScore);
  const topPoint = sortedPoints[0];

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'titik', label: `Titik Risiko (${result.riskPoints.length})` },
    { id: 'rekomendasi', label: 'Rekomendasi' },
    ...(satellite || solidWaste ? [{ id: 'satelit', label: 'Satelit' }] : []),
  ];

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-200 bg-zinc-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: overallColor }} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: overallColor }}>
                Tingkat Risiko {RISK_LABEL[result.overallRiskLevel]}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#162e52] leading-snug">{result.locationName}</h3>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
              Dianalisis {new Date(result.analysisTimestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] font-bold uppercase tracking-wider text-[#162e52] bg-white border border-zinc-300 hover:bg-zinc-100 px-3 py-1.5 rounded-lg transition-all shadow-sm flex-shrink-0 flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Form Baru
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white border border-zinc-200/80 rounded-xl p-1 mt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${
                tab === t.id
                  ? 'bg-[#162e52] text-white shadow'
                  : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Ringkasan ─────────────────────────────────────────────── */}
      {tab === 'ringkasan' && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Level Keseluruhan"
              value={RISK_LABEL[result.overallRiskLevel]}
              color={overallColor}
            />
            <StatCard
              label="Titik Risiko"
              value={`${result.riskPoints.length}`}
              sub="lokasi teridentifikasi"
              color="#162e52"
            />
            <StatCard
              label="Skor Tertinggi"
              value={topPoint ? `${topPoint.riskScore}/100` : '—'}
              sub={topPoint?.riskType}
              color={topPoint ? RISK_COLORS[topPoint.riskLevel] : '#6b7280'}
            />
            <StatCard
              label="Sumber Data"
              value={`${result.dataSources.length}`}
              sub={result.dataSources.slice(0, 2).join(' · ')}
              color="#0d9488"
            />
          </div>

          {/* AI summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-[#162e52] text-white flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]">
                Ringkasan Analisis Agentic AI
              </span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">{result.summary}</p>
          </div>

          {/* Quick recommendations preview */}
          {result.recommendations.length > 0 && (
            <div className="bg-[#162e52]/5 border border-[#162e52]/15 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#162e52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]">
                  Prioritas Penanganan
                </span>
              </div>
              <ol className="space-y-1.5">
                {result.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-zinc-700 leading-relaxed">
                    <span className="text-[#162e52] font-extrabold flex-shrink-0 tabular-nums">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ol>
              {result.recommendations.length > 3 && (
                <button
                  onClick={() => setTab('rekomendasi')}
                  className="text-[10px] font-bold text-sky-700 hover:underline"
                >
                  Lihat semua {result.recommendations.length} rekomendasi →
                </button>
              )}
            </div>
          )}

          {/* Data sources */}
          <div className="border-t border-zinc-100 pt-3">
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
      )}

      {/* ── TAB: Titik Risiko ──────────────────────────────────────────── */}
      {tab === 'titik' && (
        <div className="p-5 space-y-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
            {result.riskPoints.length} Lokasi Koordinat Risiko Teridentifikasi
          </p>
          {sortedPoints.map((point, i) => (
            <RiskPointCard key={i} point={point} rank={i + 1} />
          ))}
        </div>
      )}

      {/* ── TAB: Rekomendasi ───────────────────────────────────────────── */}
      {tab === 'rekomendasi' && (
        <div className="p-5 space-y-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
            Rekomendasi &amp; Penanganan
          </p>
          <div className="bg-[#162e52]/5 border border-[#162e52]/15 rounded-2xl p-5 space-y-3">
            <ol className="space-y-2.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-zinc-700 leading-relaxed">
                  <span className="text-[#162e52] font-extrabold flex-shrink-0 tabular-nums">{i + 1}.</span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* ── TAB: Satelit ───────────────────────────────────────────────── */}
      {(tab === 'satelit' && (satellite || solidWaste)) && (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-indigo-700 text-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]">
              Analisis Citra Satelit
            </span>
            <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700">
              NASA GIBS
            </span>
          </div>
          {satellite && <SatelliteCard satellite={satellite} />}

          <div className="flex items-center gap-2 mb-1 mt-4">
            <div className="w-6 h-6 rounded-lg bg-rose-700 text-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0-3.5-3.5M12 15l3.5-3.5M5 19h14" />
              </svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#162e52]">
              Sampah Padat Terapung
            </span>
            <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700">
              Sentinel-2 · FDI
            </span>
          </div>
          {solidWaste ? (
            <SolidWasteCard solidWaste={solidWaste} uid={uid} />
          ) : (
            <p className="text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              Analisis sampah padat (Sentinel-2) tidak tersedia untuk sesi ini.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
