'use client';

import { useState } from 'react';
import type { FishingZone, FishingZoneAnalysis } from '@/app/types/maritime';
import { bearingDeg, cardinalFromBearing, formatKm, haversineKm, type GeoPoint } from '@/components/peta-risiko/distances';

interface FishingPanelProps {
  analysis: FishingZoneAnalysis;
  onReset: () => void;
  departure?: { lat: number; lon: number } | null;
  targetZone?: FishingZone | null;
}

const scoreColor = (score: number): string => {
  if (score >= 0.85) return '#059669';
  if (score >= 0.75) return '#10b981';
  if (score >= 0.65) return '#84cc16';
  return '#facc15';
};

function NavigationCard({
  departure,
  targetZone,
}: {
  departure: GeoPoint;
  targetZone: FishingZone;
}) {
  const [speedKn, setSpeedKn] = useState(8);

  const distKm = haversineKm(departure, { lat: targetZone.lat, lon: targetZone.lon });
  const bearing = bearingDeg(departure, { lat: targetZone.lat, lon: targetZone.lon });
  const cardinal = cardinalFromBearing(bearing);
  const etaHours = distKm / (speedKn * 1.852);
  const etaLabel =
    etaHours < 1
      ? `${Math.max(1, Math.round(etaHours * 60))} mnt`
      : `${Math.floor(etaHours)} j ${Math.round((etaHours % 1) * 60)} mnt`;

  return (
    <div className="bg-gradient-to-br from-sky-700 to-[#0c4a6e] rounded-2xl p-4 text-white shadow-lg border border-sky-500/40">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2 h-2 rounded-full bg-sky-300 animate-pulse" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-200">
          Navigasi Menuju Zona
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-sky-300 mb-0.5">Jarak</p>
          <p className="text-sm font-extrabold tabular-nums">{formatKm(distKm)} km</p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-sky-300 mb-0.5">Arah</p>
          <p className="text-sm font-extrabold tabular-nums">{cardinal} <span className="text-[10px] font-bold text-sky-200">({Math.round(bearing)}°)</span></p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-sky-300 mb-0.5">ETA ({speedKn} kn)</p>
          <p className="text-sm font-extrabold tabular-nums">{etaLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-sky-200">Kecepatan</span>
        <input
          type="range"
          min={3}
          max={20}
          value={speedKn}
          onChange={(e) => setSpeedKn(Number(e.target.value))}
          className="flex-1 accent-sky-300"
        />
        <span className="text-[10px] font-bold tabular-nums text-sky-100 w-8 text-right">{speedKn} kn</span>
      </div>

      <p className="text-[9px] text-sky-100/80 leading-relaxed mt-2.5">
        Dari ({departure.lat.toFixed(4)}, {departure.lon.toFixed(4)}) menuju zona terbaik (
        {targetZone.lat.toFixed(4)}, {targetZone.lon.toFixed(4)}). Garis biru putus-putus di peta = rute langsung.
      </p>
    </div>
  );
}

function AiAnalysisCard({ analysis }: { analysis: FishingZoneAnalysis }) {
  const ai = analysis.aiAnalysis;
  if (!ai) return null;

  const best = ai.recommendedZoneIndex !== undefined ? analysis.zones[ai.recommendedZoneIndex] : null;

  return (
    <div className="bg-gradient-to-br from-[#0b2e59] to-[#162e52] rounded-2xl p-4 text-white shadow-lg border border-[#1f4275]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300">
          Analisis Agentic AI
        </span>
        {ai.degraded && (
          <span className="text-[8px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 rounded-lg px-1.5 py-0.5 ml-auto">
            Heuristik (AI rate-limited)
          </span>
        )}
      </div>

      {best && (
        <div className="mb-3 rounded-xl bg-white/10 border border-white/15 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-sky-300 mb-1">
            Zona Terbaik — {best.lat.toFixed(4)}, {best.lon.toFixed(4)}
          </p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.recommendation}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[9px] font-bold text-emerald-200 bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-1.5 py-0.5">
              Skor {(best.score * 100).toFixed(0)}/100
            </span>
            <span className="text-[9px] font-bold text-white/80 bg-white/10 border border-white/20 rounded-lg px-1.5 py-0.5">
              ±{best.areaKm2.toLocaleString('id-ID')} km²
            </span>
            {best.nearbyVessels !== undefined && (
              <span className="text-[9px] font-bold text-amber-200 bg-amber-500/20 border border-amber-400/40 rounded-lg px-1.5 py-0.5">
                {best.nearbyVessels} kapal penangkap ±30 km
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-sky-300 mb-1">
            Arah Pergerakan Kawanan
          </p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.movementAnalysis}</p>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300 mb-1">
            Global Fishing Watch (AIS/VMS Kapal Komersial)
          </p>
          <p className="text-[11px] leading-relaxed text-sky-50">{ai.gfwSuggestion}</p>
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

function ZoneCard({ zone, rank }: { zone: FishingZone; rank: number }) {
  const color = scoreColor(zone.score);
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
            {zone.lat.toFixed(4)}, {zone.lon.toFixed(4)}
          </p>
        </div>
        <span
          className="text-[9px] font-extrabold rounded-lg px-1.5 py-0.5 border flex-shrink-0"
          style={{ color, background: `${color}14`, borderColor: `${color}55` }}
        >
          Skor {(zone.score * 100).toFixed(0)}/100
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {zone.species.length > 0 ? (
          zone.species.map((s) => (
            <span key={s} className="text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded-lg px-1.5 py-0.5">
              {s}
            </span>
          ))
        ) : (
          <span className="text-[9px] font-bold text-zinc-500 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
            Spesies campuran
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          ±{zone.areaKm2.toLocaleString('id-ID')} km²
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          Suhu {zone.meanSst}°C
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          Klorofil {zone.meanChl} mg/m³
        </span>
        <span className="text-[9px] font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg px-1.5 py-0.5">
          {formatKm(zone.coastKm)} dari pantai
        </span>
        {zone.nearbyVessels !== undefined && (
          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-1.5 py-0.5">
            {zone.nearbyVessels} kapal penangkap ±30km
            {zone.vesselHeading !== undefined ? ` · heading ${zone.vesselHeading}°` : ''}
          </span>
        )}
      </div>

      <div className="flex items-start gap-1.5 mt-2 text-[9px] text-zinc-600 font-semibold bg-white border border-zinc-200 rounded-lg px-2 py-1.5">
        <svg className="w-3 h-3 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="#0ea5e9">
          <path d="M12 2l4.5 9.5L12 9l-4.5 2.5L12 2zM12 9v13" />
        </svg>
        <span>{zone.movementLabel}{zone.currentSpeed !== undefined ? ` (arus ${zone.currentSpeed} m/s ke ${zone.currentDirection}°)` : ''}</span>
      </div>

      {zone.flagged && (
        <p className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1.5 mt-1.5">
          ⚠ {zone.flagged}
        </p>
      )}
    </div>
  );
}

export default function FishingPanel({ analysis, onReset, departure, targetZone }: FishingPanelProps) {
  const sorted = [...analysis.zones].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-zinc-200 bg-zinc-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                Zona Tangkap Ikan
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#162e52] leading-snug">
              {sorted.length} zona aman direkomendasikan
            </h3>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
              Citra: {analysis.date} · {analysis.avoidedCount} titik kontaminasi dihindari · {analysis.rejectedZones} zona potensial ditolak
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
        {departure && targetZone && (
          <NavigationCard departure={departure} targetZone={targetZone} />
        )}

        <AiAnalysisCard analysis={analysis} />

        {sorted.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-amber-900">Belum ada zona yang lolos verifikasi</p>
            <p className="text-[9px] text-amber-800/80 mt-1">{analysis.summary}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-600 leading-relaxed">{analysis.summary}</p>
            <div className="space-y-2">
              {sorted.map((z, i) => (
                <ZoneCard key={`${z.lat}-${z.lon}`} zone={z} rank={i + 1} />
              ))}
            </div>
          </>
        )}
        <p className="text-[9px] text-zinc-400 italic leading-relaxed">{analysis.disclaimer}</p>
      </div>
    </div>
  );
}
