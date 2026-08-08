"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ArusPencemaranResult,
  DriftPoint,
  FactorySource,
  VesselTrack,
} from "@/app/types/maritime";
import { loadLeaflet } from "../dashboard/wave/leaflet";
import { fmtDateTime } from "./format";

interface DriftMapProps {
  result: ArusPencemaranResult;
  selectedVesselId?: string | null;
  onSelectVessel?: (id: string | null) => void;
  selectedFactoryId?: string | null;
  onSelectFactory?: (id: string | null) => void;
  heightClass?: string;
}

const ORIGIN_COLOR = "#0d9488";
const DEST_COLOR = "#dc2626";
const LINE_COLOR = "#0284c7";
const VESSEL_COLOR = "#d97706";
const VESSEL_TRAJ_COLOR = "#b45309";
const RADIUS_COLOR = "#6366f1";
const TRACK_PASS_COLOR = "#64748b";
const FACTORY_COLOR = "#dc2626";

const LIKELIHOOD_COLOR: Record<string, string> = {
  tinggi: "#dc2626",
  sedang: "#d97706",
  rendah: "#65a30d",
};

/** Panah kecil berisi arah arus pada tiap titik lintasan. */
function arrowHtml(directionDeg: number, color: string): string {
  return `
    <div style="width:14px;height:14px;transform:rotate(${directionDeg}deg);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1">
        <path d="M12 2l2.6 6.8a4.4 4.4 0 0 1-5.2 0L12 2zM6.5 20.5l5.5-3 5.5 3-1 2h-9l-1-2zM9 10.6c.9.3 1.9.5 3 .5s2.1-.2 3-.5l-.5 7.4h-5L9 10.6z"/>
      </svg>
    </div>
  `;
}

export default function DriftMap({
  result,
  selectedVesselId,
  onSelectVessel,
  selectedFactoryId,
  onSelectFactory,
  heightClass = "h-[520px] lg:h-[720px]",
}: DriftMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundsRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  // Load Leaflet once (shared singleton loader)
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (!cancelled) setLeafletReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [result.origin.lat, result.origin.lon],
      zoom: 9,
      zoomControl: true,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© CartoDB © OpenStreetMap",
        maxZoom: 18,
      },
    ).addTo(map);
    if (L.control.scale)
      L.control
        .scale({ metric: true, imperial: false, position: "bottomright" })
        .addTo(map);
    mapInstanceRef.current = map;
  }, [leafletReady, result.origin.lat, result.origin.lon]);

  // Draw trajectory + markers
  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    const layer = L.layerGroup().addTo(map);
    const pts: [number, number][] = result.trajectory.map((p) => [
      p.lat,
      p.lon,
    ]);
    const extraBounds: [number, number][] = [];

    // Lingkaran radius pemindaian
    if (typeof result.radiusKm === "number" && result.radiusKm > 0) {
      L.circle([result.origin.lat, result.origin.lon], {
        radius: result.radiusKm * 1000,
        color: RADIUS_COLOR,
        weight: 1.5,
        dashArray: "4 6",
        fillColor: RADIUS_COLOR,
        fillOpacity: 0.05,
      })
        .bindTooltip(`Radius pemindaian ${result.radiusKm} km`, {
          direction: "top",
        })
        .addTo(layer);
    }

    // Polyline lintasan
    if (pts.length > 1) {
      L.polyline(pts, { color: LINE_COLOR, weight: 3, opacity: 0.9 }).addTo(
        layer,
      );
    }

    // Titik origin
    L.circleMarker([result.origin.lat, result.origin.lon], {
      radius: 9,
      color: "#fff",
      weight: 2.5,
      fillColor: ORIGIN_COLOR,
      fillOpacity: 0.95,
    })
      .bindTooltip(
        `<b>Titik Buangan</b><br/>${result.origin.lat.toFixed(4)}, ${result.origin.lon.toFixed(4)}${result.wasteForm ? `<br/>${result.wasteForm}` : ""}`,
        { direction: "top" },
      )
      .addTo(layer);

    // Titik tujuan
    if (result.destination) {
      L.circleMarker([result.destination.lat, result.destination.lon], {
        radius: 8,
        color: "#fff",
        weight: 2.5,
        fillColor: DEST_COLOR,
        fillOpacity: 0.95,
      })
        .bindTooltip(`<b>Titik Akhir</b><br/>${result.destination.label}`, {
          direction: "top",
        })
        .addTo(layer);
    }

    // Panah arah per titik lintasan (kecuali origin)
    result.trajectory.forEach((p: DriftPoint, i: number) => {
      if (i === 0) return;
      const marker = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "",
          html: arrowHtml(p.directionDeg, LINE_COLOR),
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        zIndexOffset: 400,
      });
      marker.bindTooltip(
        `<b>t+${p.timeOffsetHours} jam</b><br/>Arus ${p.directionDeg}° · ${p.speedMps.toFixed(2)} m/s<br/>${p.cumulativeDistanceKm.toFixed(1)} km dari buangan`,
        { direction: "top", opacity: 0.9 },
      );
      marker.addTo(layer);
    });

    // Kandidat kapal industri (GFW) — marker amber, klik untuk memilih
    const vessels = result.vesselCandidates ?? [];
    vessels.forEach((v) => {
      const marker = L.marker([v.lat, v.lon], {
        icon: L.divIcon({
          className: "",
          html: `
            <div style="width:20px;height:20px;transform:rotate(45deg);border-radius:4px;border:2px solid ${LIKELIHOOD_COLOR[v.likelihood] ?? "#fff"};background:${VESSEL_COLOR};box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>
            <div style="position:absolute;top:1px;left:1px;width:14px;height:14px;transform:rotate(0deg);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 3c1.6 0 3 1.2 3 2.8v9.4L12 21l-3-5.8V5.8C9 4.2 10.4 3 12 3z"/></svg>
            </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        zIndexOffset: 600,
      });
      marker.bindTooltip(
        `<b>${v.vesselName}</b><br/>${v.vesselType} · bendera ${v.flag}<br/>Potensi: ${v.likelihood.toUpperCase()}<br/>${v.distanceFromOriginKm} km dari buangan<br/>Prediksi hanyut: ${v.predicted.directionLabel} · ${v.predicted.durationLabel}`,
        { direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => {
        onSelectVessel?.(v.vesselId);
      });
      marker.addTo(layer);
    });

    // Lintasan prediksi kapal yang dipilih (putus-putus)
    const selectedVessel = vessels.find((v) => v.vesselId === selectedVesselId);
    if (selectedVessel && selectedVessel.predicted.trajectory.length > 0) {
      const vPts: [number, number][] = selectedVessel.predicted.trajectory.map(
        (p) => [p.lat, p.lon],
      );
      if (vPts.length > 1) {
        L.polyline(vPts, {
          color: VESSEL_TRAJ_COLOR,
          weight: 2.5,
          opacity: 0.85,
          dashArray: "6 6",
        }).addTo(layer);
      }
      const last = vPts[vPts.length - 1];
      if (last) {
        L.circleMarker(last, {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: VESSEL_TRAJ_COLOR,
          fillOpacity: 0.95,
        })
          .bindTooltip(
            `<b>Limbah ${selectedVessel.vesselName}</b><br/>Setelah ${selectedVessel.predicted.durationLabel}<br/>${selectedVessel.predicted.directionLabel} · ${selectedVessel.predicted.distanceKm.toFixed(0)} km`,
            { direction: "top" },
          )
          .addTo(layer);
      }
    }

    // ── Mode KAPAL: riwayat melintas + posisi kini + prediksi rute ───────────
    const tracks: VesselTrack[] = result.vesselTracks ?? [];
    tracks.forEach((t) => {
      if (!t.current) return;
      const heading = t.current.heading;
      const isSelected = t.vesselId === selectedVesselId;
      const marker = L.marker([t.current.lat, t.current.lon], {
        icon: L.divIcon({
          className: "",
          html: `
            <div style="width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:${RADIUS_COLOR};box-shadow:0 1px 5px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;${heading != null ? `transform:rotate(${heading}deg);` : ""}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 3c1.6 0 3 1.2 3 2.8v9.4L12 21l-3-5.8V5.8C9 4.2 10.4 3 12 3z"/></svg>
            </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: isSelected ? 800 : 700,
      });
      marker.bindTooltip(
        `<b>${t.vesselName}</b><br/>${t.vesselType} · bendera ${t.flag}<br/>${t.passes.length}× lewat · posisi ${fmtDateTime(t.current.time)}${heading != null ? `<br/>Arah ${heading}° · ${t.current.speedKnots?.toFixed(1) ?? "?"} kn` : ""}${t.wasteDrift ? `<br/><span style="color:#b45309">Limbah hanyut: ${t.wasteDrift.directionLabel} · ${t.wasteDrift.durationLabel}</span>` : ""}<br/>Klik untuk lihat riwayat & hanyut limbah`,
        { direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => {
        onSelectVessel?.(t.vesselId);
      });
      marker.addTo(layer);

      // Arah hanyut limbah dari SETIAP kapal: garis + panah pendek searah arus.
      // Untuk kapal yang dipilih, panah pendek diganti lintasan hanyut penuh.
      const wd = t.wasteDrift;
      if (wd && wd.trajectory.length > 1 && !isSelected) {
        const start: [number, number] = [t.current.lat, t.current.lon];
        const rad = (wd.bearingDeg * Math.PI) / 180;
        const segKm = 8; // panjang indikator yang selalu terlihat (~8 km)
        const end: [number, number] = [
          start[0] + (segKm * Math.cos(rad)) / 111.32,
          start[1] +
            (segKm * Math.sin(rad)) /
              (111.32 * Math.cos((start[0] * Math.PI) / 180)),
        ];
        L.polyline([start, end], {
          color: VESSEL_TRAJ_COLOR,
          weight: 2.5,
          opacity: 0.9,
          dashArray: "2 4",
        }).addTo(layer);
        L.marker(end, {
          icon: L.divIcon({
            className: "",
            html: arrowHtml(wd.bearingDeg, VESSEL_TRAJ_COLOR),
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
          zIndexOffset: 650,
        })
          .bindTooltip(
            `<b>Limbah ${t.vesselName}</b><br/>Hanyut ${wd.directionLabel} (${wd.bearingDeg}°) mengikuti arus<br/>~${wd.distanceKm.toFixed(0)} km · ${wd.durationLabel}`,
            { direction: "top", opacity: 0.9 },
          )
          .addTo(layer);
        extraBounds.push(end);
      }
    });

    const selTrack = tracks.find((t) => t.vesselId === selectedVesselId);
    if (selTrack) {
      // Riwayat lewat: garis + titik berlabel tanggal
      const passPts: [number, number][] = selTrack.passes.map((p) => [
        p.lat,
        p.lon,
      ]);
      if (passPts.length > 1) {
        L.polyline(passPts, {
          color: TRACK_PASS_COLOR,
          weight: 2,
          opacity: 0.8,
        }).addTo(layer);
      }
      selTrack.passes.forEach((p) => {
        L.circleMarker([p.lat, p.lon], {
          radius: 5,
          color: "#fff",
          weight: 1.5,
          fillColor: TRACK_PASS_COLOR,
          fillOpacity: 0.95,
        })
          .bindTooltip(
            `<b>${selTrack.vesselName} lewat</b><br/>${fmtDateTime(p.startTime)} → ${fmtDateTime(p.endTime)}<br/>${p.distanceFromPointKm} km dari titik analisis`,
            { direction: "top" },
          )
          .addTo(layer);
      });

      // Hanyut limbah dari posisi kapal saat ini (kuning putus-putus) + titik akhir
      if (selTrack.wasteDrift && selTrack.wasteDrift.trajectory.length > 1) {
        L.polyline(
          selTrack.wasteDrift.trajectory.map(
            (p) => [p.lat, p.lon] as [number, number],
          ),
          {
            color: VESSEL_TRAJ_COLOR,
            weight: 2,
            opacity: 0.9,
            dashArray: "3 7",
          },
        ).addTo(layer);
        const wd = selTrack.wasteDrift;
        const wdEnd = wd.trajectory[wd.trajectory.length - 1];
        L.circleMarker([wdEnd.lat, wdEnd.lon], {
          radius: 6,
          color: "#fff",
          weight: 1.5,
          fillColor: VESSEL_TRAJ_COLOR,
          fillOpacity: 0.95,
        })
          .bindTooltip(
            `<b>Batas hanyut limbah ${selTrack.vesselName}</b><br/>${wd.directionLabel} (${wd.bearingDeg}°) · ${wd.distanceKm.toFixed(0)} km dalam ${wd.durationLabel}`,
            { direction: "top" },
          )
          .addTo(layer);
        extraBounds.push([wdEnd.lat, wdEnd.lon]);
      }

      passPts.forEach((pt) => extraBounds.push(pt));
    }

    // ── Mode PABRIK: marker + hanyut dari muara pabrik ───────────────────────
    const factories: FactorySource[] = result.factorySources ?? [];
    factories.forEach((f) => {
      const marker = L.marker([f.lat, f.lon], {
        icon: L.divIcon({
          className: "",
          html: `
            <div style="width:20px;height:20px;transform:rotate(45deg);border-radius:4px;border:2px solid #fff;background:${FACTORY_COLOR};box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;">
              <div style="width:8px;height:8px;transform:rotate(-45deg);border-radius:1px;background:#fff;"></div>
            </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        zIndexOffset: 600,
      });
      marker.bindTooltip(
        `<b>${f.name}</b><br/>${f.kind} · ${f.distanceKm} km arah ${f.direction}<br/>${f.wasteForms.slice(0, 2).join(" · ")}<br/>Klik untuk lihat prediksi hanyut`,
        { direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => {
        onSelectFactory?.(f.name);
      });
      marker.addTo(layer);
    });

    const selFactory = factories.find((f) => f.name === selectedFactoryId);
    if (
      selFactory &&
      selFactory.drift &&
      selFactory.drift.trajectory.length > 1
    ) {
      const fPts: [number, number][] = selFactory.drift.trajectory.map((p) => [
        p.lat,
        p.lon,
      ]);
      L.polyline(fPts, {
        color: FACTORY_COLOR,
        weight: 2.5,
        opacity: 0.9,
        dashArray: "4 8",
      }).addTo(layer);
      const fd = selFactory.drift.destination;
      if (fd) {
        L.circleMarker([fd.lat, fd.lon], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: FACTORY_COLOR,
          fillOpacity: 0.95,
        })
          .bindTooltip(
            `<b>Limbah ${selFactory.name}</b><br/>${selFactory.drift.directionLabel} · ${selFactory.drift.distanceKm.toFixed(0)} km<br/>${selFactory.drift.durationLabel}<br/>${fd.label}`,
            { direction: "top" },
          )
          .addTo(layer);
      }
      fPts.forEach((pt) => extraBounds.push(pt));
    }

    // Fit bounds
    const bounds = L.latLngBounds(
      pts.length > 1 ? pts : [[result.origin.lat, result.origin.lon]],
    );
    if (result.destination)
      bounds.extend([result.destination.lat, result.destination.lon]);
    if (result.radiusKm) {
      const deg = Math.max(0.5, result.radiusKm / 111);
      bounds.extend([result.origin.lat + deg, result.origin.lon + deg]);
      bounds.extend([result.origin.lat - deg, result.origin.lon - deg]);
    }
    extraBounds.forEach((pt) => bounds.extend(pt));
    boundsRef.current = bounds;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });

    return () => {
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leafletReady,
    result.analysisTimestamp,
    result.origin.lat,
    result.origin.lon,
    result.radiusKm,
    selectedVesselId,
    selectedFactoryId,
  ]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
      <div ref={mapRef} className={`w-full ${heightClass}`} />

      {/* Legend */}
      <div className="absolute top-4 left-4 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl shadow-lg max-w-[230px]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#162e52]">
            Legenda
          </p>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="p-1 rounded-md text-zinc-500 hover:text-[#162e52] hover:bg-zinc-100 transition-colors"
            aria-label={legendOpen ? "Tutup legenda" : "Buka legenda"}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${legendOpen ? "" : "-rotate-90"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 15.75 7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
        </div>
        {legendOpen && (
          <div className="px-3 pb-3 space-y-2 max-h-[55vh] overflow-y-auto scroll-slim border-t border-zinc-100 pt-2.5">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: ORIGIN_COLOR }}
              />
              <span className="text-[10px] text-zinc-600 font-semibold">
                Titik Buangan
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: DEST_COLOR }}
              />
              <span className="text-[10px] text-zinc-600 font-semibold">
                Titik Akhir (Prediksi)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-0 border-t-[3px] inline-block"
                style={{ borderColor: LINE_COLOR }}
              />
              <span className="text-[10px] text-zinc-600 font-semibold">
                Lintasan Limbah (6 jam/step)
              </span>
            </div>
            {(result.vesselCandidates?.length ?? 0) > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-[3px] inline-block"
                    style={{ background: VESSEL_COLOR }}
                  />
                  <span className="text-[10px] text-zinc-600 font-semibold">
                    Kandidat Kapal Industri (GFW)
                  </span>
                </div>
                {selectedVesselId && (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-0 border-t-2 inline-block"
                      style={{
                        borderColor: VESSEL_TRAJ_COLOR,
                        borderStyle: "dashed",
                      }}
                    />
                    <span className="text-[10px] text-zinc-600 font-semibold">
                      Lintasan Potensial Kapal Terpilih
                    </span>
                  </div>
                )}
              </>
            )}
            {(result.vesselTracks?.length ?? 0) > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ background: RADIUS_COLOR }}
                  />
                  <span className="text-[10px] text-zinc-600 font-semibold">
                    Kapal Melintas (posisi kini)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-0 border-t-2 inline-block"
                    style={{
                      borderColor: VESSEL_TRAJ_COLOR,
                      borderStyle: "dashed",
                    }}
                  />
                  <span className="text-[10px] text-zinc-600 font-semibold">
                    Arah Hanyut Limbah (per kapal)
                  </span>
                </div>
                {selectedVesselId && (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-0 border-t-2 inline-block"
                        style={{ borderColor: TRACK_PASS_COLOR }}
                      />
                      <span className="text-[10px] text-zinc-600 font-semibold">
                        Riwayat Kapal Terpilih
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-0 border-t-2 inline-block"
                        style={{
                          borderColor: VESSEL_TRAJ_COLOR,
                          borderStyle: "dashed",
                        }}
                      />
                      <span className="text-[10px] text-zinc-600 font-semibold">
                        Lintasan Hanyut Limbah Kapal
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {(result.factorySources?.length ?? 0) > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-[3px] inline-block"
                    style={{ background: FACTORY_COLOR }}
                  />
                  <span className="text-[10px] text-zinc-600 font-semibold">
                    Pabrik Sumber Pencemar
                  </span>
                </div>
                {selectedFactoryId && (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-0 border-t-2 inline-block"
                      style={{
                        borderColor: FACTORY_COLOR,
                        borderStyle: "dashed",
                      }}
                    />
                    <span className="text-[10px] text-zinc-600 font-semibold">
                      Prediksi Hanyut Pabrik Terpilih
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tombol pas tampilan ke hasil analisis */}
      <button
        onClick={() => {
          const m = mapInstanceRef.current;
          const b = boundsRef.current;
          if (m && b) m.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
        }}
        className="absolute bottom-5 left-4 z-[999] flex items-center gap-1.5 bg-white/95 backdrop-blur border border-zinc-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-zinc-600 hover:text-[#162e52] hover:bg-white shadow-md transition-colors"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 3.75H6.75A2.25 2.25 0 0 0 4.5 6v2.25M15 3.75h2.25A2.25 2.25 0 0 1 19.5 6v2.25m0 9V20.25A2.25 2.25 0 0 1 17.25 22.5H15m-6 0H6.75A2.25 2.25 0 0 1 4.5 20.25V18"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 11.25h6m0 0v-1.5m0 1.5v1.5"
          />
        </svg>
        Pas ke Hasil
      </button>

      {/* Region label */}
      <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur border border-zinc-200 rounded-xl px-3 py-2 max-w-[220px] shadow-lg">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Wilayah Analisis
        </p>
        <p className="text-xs text-zinc-800 font-semibold mt-0.5 line-clamp-2">
          {result.locationName}
        </p>
      </div>
    </div>
  );
}
