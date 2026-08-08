"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

import DriftForm from "@/components/arus-pencemaran/DriftForm";
import LoadingPrediction from "@/components/arus-pencemaran/LoadingPrediction";
import DriftPanel from "@/components/arus-pencemaran/DriftPanel";
import {
  onAuthChange,
  getUserProfile,
  UserProfile,
} from "@/app/service/authentication";
import {
  deleteDriftPrediction,
  loadDriftPredictions,
  saveDriftPrediction,
  type DriftHistoryEntry,
} from "@/app/service/driftHistory";
import { formatHistoryDate } from "@/app/service/analysisHistory";
import type {
  ArusAnalysisMode,
  ArusPencemaranRequest,
  ArusPencemaranResult,
} from "@/app/types/maritime";

const DriftMap = dynamic(
  () => import("@/components/arus-pencemaran/DriftMap"),
  { ssr: false },
);

type Phase = "form" | "loading" | "result";

const LOADING_STEPS_LABEL: Record<ArusAnalysisMode, string[]> = {
  buangan: [
    "Mengambil data arus laut (BMKG / Copernicus)…",
    "Mengambil aktivitas kapal industri (Global Fishing Watch)…",
    "Menjalankan simulasi drift Lagrangian…",
    "Menganalisis arah, kandidat kapal, dan estimasi waktu tiba…",
  ],
  kapal: [
    "Mengambil riwayat kapal melintas (GFW 30 hari)…",
    "Mengelompokkan lintasan & posisi terkini tiap kapal…",
    "Menghitung potensi hanyut limbah tiap kapal…",
    "Menganalisis sumber pencemaran dari tiap kapal…",
  ],
  pabrik: [
    "Mencari pabrik sumber pencemar dalam radius…",
    "Menjalankan simulasi hanyut dari muara pabrik…",
    "Menganalisis limbah khas tiap jenis pabrik…",
  ],
};

export default function ArusPencemaranPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mode, setMode] = useState<ArusAnalysisMode>("buangan");
  const [phase, setPhase] = useState<Phase>("form");
  const [request, setRequest] = useState<ArusPencemaranRequest | null>(null);
  const [, setLoadingSteps] = useState(
    LOADING_STEPS_LABEL.buangan.map((label) => ({
      label,
      done: false,
      active: false,
    })),
  );
  const [result, setResult] = useState<ArusPencemaranResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<DriftHistoryEntry[]>([]);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(
    null,
  );

  // Auth Verification
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        const uProfile = await getUserProfile(user.uid);
        setProfile(uProfile);
        setUid(user.uid);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Load history when signed in
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadDriftPredictions(uid).then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const handleSubmit = useCallback(
    async (req: ArusPencemaranRequest) => {
      setRequest(req);
      setErrorMsg(null);
      setPhase("loading");
      setLoadingSteps(
        LOADING_STEPS_LABEL[req.mode ?? "buangan"].map((label, i) => ({
          label,
          done: false,
          active: i === 0,
        })),
      );

      const stepProgress = (idx: number) => {
        setLoadingSteps((prev) =>
          prev.map((s, i) => ({ ...s, done: i < idx, active: i === idx })),
        );
      };

      try {
        stepProgress(1);
        await new Promise((r) => setTimeout(r, 600));

        stepProgress(2);
        const res = await fetch("/api/ai/arus-pencemaran", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        const data = await res.json();

        setLoadingSteps((prev) =>
          prev.map((s) => ({ ...s, done: true, active: false })),
        );
        await new Promise((r) => setTimeout(r, 400));

        if (data.result) {
          setResult(data.result as ArusPencemaranResult);
          setPhase("result");
          setSelectedVesselId(null);
          setSelectedFactoryId(null);

          // Simpan ke riwayat Firestore untuk SEMUA mode analisis.
          if (uid) {
            setSavedToHistory(false);
            setSaveWarning(null);
            saveDriftPrediction(uid, {
              regionName: data.result.locationName,
              destinationLabel: data.result.destination?.label ?? "",
              durationLabel: data.result.durationLabel,
              result: data.result,
            })
              .then(() => {
                setSavedToHistory(true);
                loadDriftPredictions(uid).then((entries) =>
                  setHistory(entries),
                );
              })
              .catch((err) => {
                console.warn(
                  "[ArusPencemaranPage] Gagal menyimpan riwayat:",
                  err,
                );
                setSaveWarning(
                  "Hasil analisis berhasil dihitung, tetapi gagal tersimpan ke riwayat — periksa koneksi atau izin Firestore.",
                );
              });
          }
        } else {
          setErrorMsg(
            data.error ?? "Gagal memproses prediksi. Silakan coba lagi.",
          );
          setPhase("form");
        }
      } catch (err) {
        console.error("[ArusPencemaranPage] Error:", err);
        setErrorMsg(
          "Terjadi kesalahan saat memproses data. Silakan coba lagi.",
        );
        setPhase("form");
      }
    },
    [uid],
  );

  const handleReset = useCallback(() => {
    setPhase("form");
    setResult(null);
    setRequest(null);
    setErrorMsg(null);
    setSaveWarning(null);
    setSelectedVesselId(null);
    setSelectedFactoryId(null);
  }, []);

  const handleLoadHistory = useCallback((entry: DriftHistoryEntry) => {
    setResult(entry.result);
    setPhase("result");
    setSelectedVesselId(null);
    setSelectedFactoryId(null);
    window.scrollTo({ top: 0 });
  }, []);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDriftPrediction(uid, id);
      loadDriftPredictions(uid).then((entries) => setHistory(entries));
    },
    [uid],
  );

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#162e52] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Bar */}
      <div className="bg-[#162e52] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/peneliti"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Kembali ke Dashboard"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">
                Prediksi Penyebaran Limbah
              </h1>
              <p className="text-[11px] text-sky-200/80">
                Berbasis arus laut BMKG · {profile?.displayName || "Peneliti"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* PHASE: FORM */}
        {phase === "form" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm sticky top-6">
                <h2 className="text-sm font-bold text-[#162e52] uppercase tracking-wider mb-1">
                  Titik Buangan &amp; Parameter
                </h2>
                <p className="text-xs text-zinc-500 mb-5">
                  Tentukan lokasi analisis untuk memprediksi penyebaran limbah,
                  melacak kapal yang melintas, atau menilai pabrik sumber
                  pencemar di sekitarnya.
                </p>
                <DriftForm
                  mode={mode}
                  onModeChange={setMode}
                  onSubmit={handleSubmit}
                  isLoading={false}
                />
              </div>
            </div>

            {/* Intro / History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero */}
              <div className="relative overflow-hidden rounded-2xl bg-[#162e52] text-white p-8 shadow-sm">
                <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-sky-500/20 blur-2xl" />
                <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-teal-400/20 blur-2xl" />
                <div className="relative space-y-3 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest text-sky-200">
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
                        d="M3.75 12h16.5m-16.5 3.75h16.5M3 19.5l1.8-6h14.4l1.8 6H3Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v9M9 7.5h6"
                      />
                    </svg>
                    Simulasi Drift Lagrangian
                  </span>
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    Ke mana limbah akan terbawa arus?
                  </h3>
                  <p className="text-sm text-sky-100/90 leading-relaxed">
                    Sistem mengambil vektor arus laut real-time dari BMKG di
                    titik buangan, lalu mensimulasikan pergerakan limbah langkah
                    demi langkah (setiap 6 jam) hingga 14 hari ke depan.
                    Hasilnya: arah gerak, lintasan, titik akhir (terdampar di
                    pesisir atau lepas di laut), jarak tempuh, dan estimasi
                    waktu tiba.
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-3 max-w-md">
                    {[
                      { v: "1", l: "Vektor arus BMKG" },
                      { v: "6 jam", l: "Langkah simulasi" },
                      { v: "14 hari", l: "Horizon prediksi" },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5"
                      >
                        <p className="text-sm font-extrabold text-sky-200">
                          {s.v}
                        </p>
                        <p className="text-[10px] text-sky-100/70">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* History */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
                    Riwayat Prediksi
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {history.length} tersimpan
                  </span>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400">
                    <svg
                      className="w-10 h-10 mx-auto mb-2 text-zinc-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    <p className="text-xs">
                      Belum ada prediksi yang tersimpan.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {history.map((entry) => (
                      <li
                        key={entry.id}
                        className="group flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-sky-50/60 hover:border-sky-200 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#162e52]/10 text-[#162e52] flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.75 12h16.5m-16.5 3.75h16.5M3 19.5l1.8-6h14.4l1.8 6H3Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4.5v9M9 7.5h6"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-800 truncate">
                            {entry.regionName}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {entry.destinationLabel} · {entry.durationLabel}
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            {formatHistoryDate(entry.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLoadHistory(entry)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#162e52] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#1f4275] transition-colors"
                        >
                          Buka
                        </button>
                        <button
                          onClick={() =>
                            entry.id && handleDeleteHistory(entry.id)
                          }
                          className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Hapus riwayat"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PHASE: LOADING */}
        {phase === "loading" && (
          <LoadingPrediction regionName={request?.regionName ?? "—"} />
        )}

        {/* PHASE: RESULT */}
        {phase === "result" && result && (
          <div className="space-y-6">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">
                {errorMsg}
              </div>
            )}

            {savedToHistory && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-xl px-4 py-2.5">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Hasil prediksi tersimpan ke riwayat.
              </div>
            )}

            {saveWarning && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold rounded-xl px-4 py-2.5">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
                {saveWarning}
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-6">
                  <DriftMap
                    result={result}
                    selectedVesselId={selectedVesselId}
                    onSelectVessel={setSelectedVesselId}
                    selectedFactoryId={selectedFactoryId}
                    onSelectFactory={setSelectedFactoryId}
                    heightClass="h-[52vh] lg:h-[calc(100vh-140px)]"
                  />
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="lg:h-[calc(100vh-140px)] lg:overflow-y-auto scroll-slim lg:pr-1.5">
                  <DriftPanel
                    key={result.analysisTimestamp}
                    result={result}
                    onReset={handleReset}
                    selectedVesselId={selectedVesselId}
                    onSelectVessel={setSelectedVesselId}
                    selectedFactoryId={selectedFactoryId}
                    onSelectFactory={setSelectedFactoryId}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
