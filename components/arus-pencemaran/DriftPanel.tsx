"use client";

import { useState } from "react";
import type {
  ArusPencemaranResult,
  FactorySource,
  VesselTrack,
  VesselWasteCandidate,
} from "@/app/types/maritime";
import { fmtDateTime } from "./format";

interface DriftPanelProps {
  result: ArusPencemaranResult;
  onReset: () => void;
  selectedVesselId?: string | null;
  onSelectVessel?: (id: string | null) => void;
  selectedFactoryId?: string | null;
  onSelectFactory?: (id: string | null) => void;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-zinc-200/80 rounded-xl px-4 py-3">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-extrabold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const LIKELIHOOD_STYLE: Record<string, string> = {
  tinggi: "bg-red-50 text-red-700 border-red-300",
  sedang: "bg-amber-50 text-amber-700 border-amber-300",
  rendah: "bg-lime-50 text-lime-700 border-lime-300",
};

function VesselCard({
  v,
  selected,
  onSelect,
}: {
  v: VesselWasteCandidate;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        selected
          ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-300"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-zinc-800 truncate">
            {v.vesselName}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {v.vesselType} · bendera {v.flag} · {v.distanceFromOriginKm} km dari
            buangan
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${LIKELIHOOD_STYLE[v.likelihood]}`}
        >
          {v.likelihood}
        </span>
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">
        {v.reason}
      </p>

      {v.wasteForms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {v.wasteForms.map((w) => (
            <span
              key={w}
              className="text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            Kecepatan
          </p>
          <p className="text-[10px] font-extrabold text-zinc-700">
            {v.speedKnots != null ? `${v.speedKnots.toFixed(1)} kn` : "—"}
          </p>
        </div>
        <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            Hanyut
          </p>
          <p className="text-[10px] font-extrabold text-zinc-700">
            {v.predicted.directionLabel}
          </p>
        </div>
        <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            Jarak/Durasi
          </p>
          <p className="text-[10px] font-extrabold text-zinc-700">
            {v.predicted.distanceKm.toFixed(0)} km · {v.predicted.durationLabel}
          </p>
        </div>
      </div>

      <button
        onClick={() => onSelect(selected ? null : v.vesselId)}
        className={`mt-2.5 w-full text-[10px] font-bold uppercase tracking-wider rounded-lg py-1.5 transition-colors ${
          selected
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        {selected ? "Sembunyikan di Peta" : "Lihat di Peta"}
      </button>
    </div>
  );
}

const FACTORY_KIND_STYLE: Record<string, string> = {
  kilang: "bg-rose-50 text-rose-700 border-rose-300",
  pltu: "bg-orange-50 text-orange-700 border-orange-300",
  "kawasan-industri": "bg-sky-50 text-sky-700 border-sky-300",
  smelter: "bg-violet-50 text-violet-700 border-violet-300",
};

function TrackCard({
  t,
  selected,
  onSelect,
}: {
  t: VesselTrack;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        selected
          ? "border-violet-400 bg-violet-50/60 ring-1 ring-violet-300"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-zinc-800 truncate">
            {t.vesselName}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {t.vesselType} · bendera {t.flag}
          </p>
        </div>
        <span className="shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-300">
          {t.passes.length}× lewat
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {t.passes.map((p, i) => (
          <span
            key={i}
            className="text-[9px] font-semibold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-1.5 py-0.5"
          >
            {fmtDateTime(p.startTime)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            Posisi Terakhir
          </p>
          <p className="text-[10px] font-extrabold text-zinc-700">
            {t.current ? fmtDateTime(t.current.time) : "—"}
          </p>
        </div>
        <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            Kecepatan
          </p>
          <p className="text-[10px] font-extrabold text-zinc-700">
            {t.current?.speedKnots != null
              ? `${t.current.speedKnots.toFixed(1)} kn`
              : "—"}
          </p>
        </div>
      </div>

      {selected && (
        <div className="mt-2.5 space-y-1.5 text-[10px] text-zinc-600">
          {t.wasteDrift && (
            <p>
              <span className="font-bold text-zinc-800">Hanyut limbah:</span>{" "}
              {t.wasteDrift.directionLabel} ·{" "}
              {t.wasteDrift.distanceKm.toFixed(0)} km dalam{" "}
              {t.wasteDrift.durationLabel}
            </p>
          )}
          <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1 border-t border-zinc-100 pt-1.5">
            {t.passes.map((p, i) => (
              <p key={i} className="text-[9px] text-zinc-500">
                {fmtDateTime(p.startTime)} → {fmtDateTime(p.endTime)} ·{" "}
                {p.distanceFromPointKm} km dari titik · {p.eventType}
              </p>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onSelect(selected ? null : t.vesselId)}
        className={`mt-2.5 w-full text-[10px] font-bold uppercase tracking-wider rounded-lg py-1.5 transition-colors ${
          selected
            ? "bg-violet-500 text-white hover:bg-violet-600"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        {selected ? "Sembunyikan di Peta" : "Lihat Riwayat & Rute di Peta"}
      </button>
    </div>
  );
}

function FactoryCard({
  f,
  selected,
  onSelect,
}: {
  f: FactorySource;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        selected
          ? "border-red-400 bg-red-50/60 ring-1 ring-red-300"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-zinc-800">{f.name}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {f.distanceKm} km arah {f.direction} dari titik analisis
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${FACTORY_KIND_STYLE[f.kind] ?? ""}`}
        >
          {f.kind}
        </span>
      </div>

      {f.wasteForms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {f.wasteForms.map((w) => (
            <span
              key={w}
              className="text-[9px] font-semibold text-red-800 bg-red-50 border border-red-200 rounded-md px-1.5 py-0.5"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {f.drift && (
        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
          <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
              Hanyut
            </p>
            <p className="text-[10px] font-extrabold text-zinc-700">
              {f.drift.directionLabel}
            </p>
          </div>
          <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
              Jarak
            </p>
            <p className="text-[10px] font-extrabold text-zinc-700">
              {f.drift.distanceKm.toFixed(0)} km
            </p>
          </div>
          <div className="bg-zinc-50 rounded-lg px-2 py-1.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">
              Durasi
            </p>
            <p className="text-[10px] font-extrabold text-zinc-700">
              {f.drift.durationLabel}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => onSelect(selected ? null : f.name)}
        className={`mt-2.5 w-full text-[10px] font-bold uppercase tracking-wider rounded-lg py-1.5 transition-colors ${
          selected
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        {selected ? "Sembunyikan di Peta" : "Lihat Prediksi Hanyut di Peta"}
      </button>
    </div>
  );
}

export default function DriftPanel({
  result,
  onReset,
  selectedVesselId,
  onSelectVessel,
  selectedFactoryId,
  onSelectFactory,
}: DriftPanelProps) {
  const mode = result.mode ?? "buangan";
  const destTypeLabel =
    result.destination?.type === "coast"
      ? "Terdampar di Pesisir"
      : result.destination?.type === "time-limit"
        ? "Laut Lepas (Batas Simulasi)"
        : result.destination?.type === "no-data"
          ? "Simulasi Terhenti"
          : "Laut Lepas";

  const modeTitle =
    mode === "kapal"
      ? "Hasil Analisis Kapal Melintas"
      : mode === "pabrik"
        ? "Hasil Analisis Pabrik"
        : "Hasil Prediksi Penyebaran";

  // Tab agar panel tetap ringkas: daftar kapal/pabrik disembunyikan di tab
  // tersendiri, bukan menumpuk ke bawah.
  const vesselCount =
    (result.vesselTracks?.length ?? 0) + (result.vesselCandidates?.length ?? 0);
  const factoryCount = result.factorySources?.length ?? 0;
  const tabs = [
    { id: "ringkasan", label: "Ringkasan" },
    ...(vesselCount > 0
      ? [{ id: "kapal", label: `Kapal (${vesselCount})` }]
      : []),
    ...(factoryCount > 0
      ? [{ id: "pabrik", label: `Pabrik (${factoryCount})` }]
      : []),
  ];
  const [tab, setTab] = useState("ringkasan");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="flex gap-1 bg-white border border-zinc-200/80 rounded-2xl p-1 shadow-sm sticky top-0 z-10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t.id
                  ? "bg-[#162e52] text-white shadow"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Ringkasan utama */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">
              {modeTitle}
            </p>
            <h3 className="text-base font-extrabold text-[#162e52] mt-1">
              {result.locationName}
            </h3>
          </div>
          <button
            onClick={onReset}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3 3 3"
              />
            </svg>
            Analisis Baru
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {mode === "buangan" ? (
            <>
              <StatCard
                label="Arah Gerak"
                value={result.directionLabel}
                sub={`Bearing ${result.bearingDeg}°`}
                color="#0284c7"
              />
              <StatCard
                label="Tujuan Akhir"
                value={destTypeLabel}
                sub={
                  result.destination
                    ? `${result.destination.lat.toFixed(3)}, ${result.destination.lon.toFixed(3)}`
                    : "—"
                }
                color="#dc2626"
              />
              <StatCard
                label="Estimasi Waktu"
                value={result.durationLabel}
                sub="sampai titik akhir"
                color="#0d9488"
              />
              <StatCard
                label="Jarak Tempuh"
                value={`${result.totalDistanceKm.toFixed(0)} km`}
                sub={`lurus ${result.straightDistanceKm.toFixed(0)} km`}
                color="#7c3aed"
              />
              <StatCard
                label="Kecepatan Rata-rata"
                value={`${result.avgSpeedKnots.toFixed(2)} kn`}
                sub={`≈ ${(result.avgSpeedKnots * 1.852).toFixed(1)} km/jam`}
                color="#ea580c"
              />
              <StatCard
                label="Arus di Titik Buangan"
                value={
                  result.currentAtOrigin
                    ? `${result.currentAtOrigin.speedMps.toFixed(2)} m/s`
                    : "—"
                }
                sub={
                  result.currentAtOrigin
                    ? `arah ${result.currentAtOrigin.directionDeg}°`
                    : "data tidak tersedia"
                }
                color="#0891b2"
              />
            </>
          ) : mode === "kapal" ? (
            <>
              <StatCard
                label="Kapal Terdeteksi"
                value={String(result.vesselTracks?.length ?? 0)}
                sub={`dalam radius ${result.radiusKm ?? 40} km`}
                color="#7c3aed"
              />
              <StatCard
                label="Total Lintasan"
                value={String(
                  (result.vesselTracks ?? []).reduce(
                    (n, t) => n + t.passes.length,
                    0,
                  ),
                )}
                sub={`jendela ${result.historyDays ?? 30} hari`}
                color="#0284c7"
              />
              <StatCard
                label="Posisi Kapal"
                value={result.vesselTracks?.length ? "Terkini" : "—"}
                sub="event GFW terbaru"
                color="#0d9488"
              />
              <StatCard
                label="Horizon Hanyut"
                value={
                  result.vesselTracks?.length
                    ? `${result.forecastDays ?? 5} hari`
                    : "—"
                }
                sub="drift limbah mengikuti arus"
                color="#ea580c"
              />
            </>
          ) : (
            <>
              <StatCard
                label="Pabrik Terdeteksi"
                value={String(result.factorySources?.length ?? 0)}
                sub={`dalam radius ${result.radiusKm ?? 40} km`}
                color="#dc2626"
              />
              <StatCard
                label="Terdekat"
                value={
                  result.factorySources?.[0]
                    ? `${result.factorySources[0].distanceKm} km`
                    : "—"
                }
                sub={result.factorySources?.[0]?.name ?? "tidak ada"}
                color="#0284c7"
              />
              <StatCard
                label="Jenis Terbanyak"
                value={(() => {
                  const counts: Record<string, number> = {};
                  for (const f of result.factorySources ?? [])
                    counts[f.kind] = (counts[f.kind] ?? 0) + 1;
                  return (
                    Object.entries(counts).sort(
                      (a, b) => b[1] - a[1],
                    )[0]?.[0] ?? "—"
                  );
                })()}
                sub="kilang / PLTU / kawasan industri / smelter"
                color="#7c3aed"
              />
              <StatCard
                label="Arah Hanyut Rata-rata"
                value={(() => {
                  const drifts = (result.factorySources ?? []).filter(
                    (f) => f.drift,
                  );
                  return drifts.length
                    ? (drifts[0].drift?.directionLabel ?? "—")
                    : "—";
                })()}
                sub="dari muara pantai terdekat pabrik"
                color="#ea580c"
              />
            </>
          )}
        </div>

        {/* Bentuk limbah & radius */}
        {(result.wasteForm || typeof result.spillRadiusKm === "number") && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {result.wasteForm && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
                <svg
                  className="w-3 h-3 text-amber-600 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {result.wasteForm}
              </span>
            )}
            {typeof result.spillRadiusKm === "number" &&
              result.spillRadiusKm > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded-lg px-2 py-1">
                  <svg
                    className="w-3 h-3 text-sky-600 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 8.25 21 12m0 0-5.25 3.75M21 12H3"
                    />
                  </svg>
                  Radius awal {result.spillRadiusKm} km
                </span>
              )}
          </div>
        )}
      </div>

      {tab === "ringkasan" && (
        <>
          {/* Analisis AI */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">
              Analisis AI
            </p>
            <p className="text-xs text-zinc-700 leading-relaxed">
              {result.summary}
            </p>
          </div>
        </>
      )}

      {tab === "kapal" && (
        <>
          {/* Riwayat kapal melintas (mode kapal) */}
          {(result.vesselTracks?.length ?? 0) > 0 && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">
                  Riwayat Kapal Melintas ({result.vesselTracks?.length ?? 0})
                </p>
                <span className="text-[9px] text-zinc-400 font-semibold">
                  Global Fishing Watch
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-3">
                Kapal yang melintas dalam radius {result.radiusKm ?? 40} km
                selama {result.historyDays ?? 30} hari terakhir. Klik untuk
                melihat tanggal lewat dan seberapa jauh limbahnya berpotensi
                terhanyut hingga {result.forecastDays ?? 5} hari ke depan.
              </p>
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto scroll-slim pr-1">
                {(result.vesselTracks ?? []).map((t) => (
                  <TrackCard
                    key={t.vesselId}
                    t={t}
                    selected={selectedVesselId === t.vesselId}
                    onSelect={onSelectVessel ?? (() => {})}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "pabrik" && (
        <>
          {/* Pabrik sumber pencemar (mode pabrik) */}
          {(result.factorySources?.length ?? 0) > 0 && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">
                  Pabrik Sumber Pencemar ({result.factorySources?.length ?? 0})
                </p>
                <span className="text-[9px] text-zinc-400 font-semibold">
                  Dataset Nasional
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-3">
                Pabrik dalam radius {result.radiusKm ?? 40} km dari titik
                analisis. Klik untuk melihat prediksi hanyut limbah dari muara
                pantai terdekatnya.
              </p>
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto scroll-slim pr-1">
                {(result.factorySources ?? []).map((f) => (
                  <FactoryCard
                    key={f.name}
                    f={f}
                    selected={selectedFactoryId === f.name}
                    onSelect={onSelectFactory ?? (() => {})}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "kapal" && (
        <>
          {/* Kandidat kapal industri (GFW) */}
          {(result.vesselCandidates?.length ?? 0) > 0 && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  Kandidat Kapal Industri ({result.vesselCandidates.length})
                </p>
                <span className="text-[9px] text-zinc-400 font-semibold">
                  Global Fishing Watch
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mb-3">
                Kapal industri dalam radius ±80 km dari titik buangan yang
                berpotensi menjadi sumber limbah. Klik untuk melihat lintasan
                hanyut potensialnya di peta.
              </p>
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto scroll-slim pr-1">
                {result.vesselCandidates.map((v) => (
                  <VesselCard
                    key={v.vesselId}
                    v={v}
                    selected={selectedVesselId === v.vesselId}
                    onSelect={onSelectVessel ?? (() => {})}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "ringkasan" && (
        <>
          {/* Rekomendasi */}
          {result.recommendations.length > 0 && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">
                Rekomendasi Tindakan
              </p>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-zinc-700 leading-relaxed"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#162e52]/10 text-[#162e52] flex items-center justify-center text-[9px] font-extrabold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detail lintasan & sumber data */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-2">
              Detail Lintasan
            </p>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto scroll-slim pr-1">
              {result.trajectory.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[11px] text-zinc-600 border-b border-zinc-100 pb-1.5 last:border-0 gap-2"
                >
                  <span className="font-semibold text-zinc-800 flex-shrink-0">
                    t+{p.timeOffsetHours} jam
                  </span>
                  <span className="font-mono flex-shrink-0">
                    {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  </span>
                  <span className="truncate">
                    arus {p.directionDeg}° · {p.speedMps.toFixed(2)} m/s
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-zinc-400 mt-3">
              Sumber data: {result.dataSources.join(" · ")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
