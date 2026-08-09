'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import FishingForm, { type FishingFormData } from '@/components/zona-tangkap/FishingForm';
import LoadingAnalysis from '@/components/peta-risiko/LoadingAnalysis';
import KualitasPanel from '@/components/zona-tangkap/KualitasPanel';
import VerifikasiTangkapan from '@/components/zona-tangkap/VerifikasiTangkapan';
import { onAuthChange, getUserProfile, UserProfile } from '@/app/service/authentication';
import {
  compactAnalysisForHistory,
  deleteFishQualityAnalysis,
  loadFishQualityAnalyses,
  saveFishQualityAnalysis,
  type FishQualityHistoryEntry,
} from '@/app/service/fishQualityHistory';
import { formatHistoryDate } from '@/app/service/analysisHistory';
import type {
  FishQualityAnalysis,
  TangkapanVerificationInput,
  TangkapanVerificationVerdict,
} from '@/app/types/maritime';

const FishingMap = dynamic(() => import('@/components/zona-tangkap/FishingMap'), { ssr: false });

const LOADING_STEPS = [
  'Mengambil citra klorofil & suhu laut (NASA GIBS)…',
  'Mendeteksi zona kontaminasi (sampah padat, minyak, termal)…',
  'Memindai aktivitas kapal penangkap Global Fishing Watch…',
  'Memodelkan kesesuaian habitat & spesies ikan…',
  'Menilai kualitas ikan per zona (suhu, klorofil, limbah)…',
  'AI menganalisis dampak iklim & prediksi kawanan…',
];

type Phase = 'form' | 'loading' | 'result';

export default function AnalisisKualitasIkanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('form');
  const [formData, setFormData] = useState<FishingFormData | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(
    LOADING_STEPS.map((label) => ({ label, done: false, active: false }))
  );
  const [analysis, setAnalysis] = useState<FishQualityAnalysis | null>(null);
  const [history, setHistory] = useState<FishQualityHistoryEntry[]>([]);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        setProfile(uProfile);
        setUid(user.uid);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Muat riwayat prediksi dari Firestore setelah login.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadFishQualityAnalyses(uid).then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const handleFormSubmit = useCallback(async (data: FishingFormData) => {
    setFormData(data);
    setPhase('loading');

    const stepProgress = (index: number) => {
      setLoadingSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          done: i < index,
          active: i === index,
        }))
      );
    };

    try {
      const bbox = data.bbox;

      stepProgress(0);
      await new Promise((r) => setTimeout(r, 500));

      const res = await fetch(
        `/api/maritime/kualitas-ikan?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}&date=${data.date}`
      );
      const payload = await res.json();

      if (payload.scores || payload.summary) {
        setLoadingSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));

        stepProgress(4);
        let analysis = payload as FishQualityAnalysis;
        try {
          const aiRes = await fetch('/api/ai/kualitas-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis }),
          });
          const aiPayload = await aiRes.json();
          if (aiPayload?.aiAnalysis) {
            analysis = { ...analysis, aiAnalysis: aiPayload.aiAnalysis };
          }
        } catch (err) {
          console.warn('[KualitasIkan] AI analysis skipped:', err);
        }

        await new Promise((r) => setTimeout(r, 400));

        setAnalysis(analysis);
        setPhase('result');

        // Simpan prediksi ke Firestore (riwayat per user).
        setSavedHistoryId(null);
        setSavedToHistory(false);
        const currentUid = uid;
        if (currentUid) {
          try {
            const compacted = await compactAnalysisForHistory(analysis);
            const id = await saveFishQualityAnalysis(currentUid, {
              regionName: data.regionName,
              form: data,
              analysis: compacted,
            });
            setSavedHistoryId(id);
            setSavedToHistory(true);
            loadFishQualityAnalyses(currentUid)
              .then((entries) => {
                setHistory(entries);
                setHistoryErr(null);
              })
              .catch(() => {});
          } catch (err) {
            console.warn('[KualitasIkan] save to history skipped:', err);
            setHistoryErr(
              err instanceof Error && /permission|denied/i.test(err.message)
                ? 'Riwayat belum tersimpan — Firestore rules belum di-deploy.'
                : 'Riwayat belum tersimpan (dokumen terlalu besar / offline).'
            );
          }
        }
      } else {
        alert('Gagal memproses analisis kualitas ikan. Silakan coba lagi.');
        setPhase('form');
      }
    } catch (err) {
      console.error('[KualitasIkan] Error:', err);
      alert('Terjadi kesalahan saat memproses data. Silakan coba lagi.');
      setPhase('form');
    }
  }, [uid]);

  const handleResetForm = useCallback(() => {
    setPhase('form');
    setAnalysis(null);
    setFormData(null);
    setSavedHistoryId(null);
    setSavedToHistory(false);
    setLoadingSteps(LOADING_STEPS.map((label) => ({ label, done: false, active: false })));
  }, []);

  const handleLoadHistory = useCallback((entry: FishQualityHistoryEntry) => {
    setFormData(entry.form);
    setAnalysis(entry.analysis);
    setSavedHistoryId(entry.id ?? null);
    setSavedToHistory(true);
    setPhase('result');
  }, []);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteFishQualityAnalysis(uid, id);
      const entries = await loadFishQualityAnalyses(uid);
      setHistory(entries);
    },
    [uid]
  );

  // Muat ulang riwayat setelah verifikasi baru tersimpan (agar lampiran terlihat).
  const handleVerificationSaved = useCallback(() => {
    if (!uid || !savedHistoryId) return;
    loadFishQualityAnalyses(uid)
      .then((entries) => setHistory(entries))
      .catch(() => {});
  }, [uid, savedHistoryId]);

  const qualityScores = useMemo(() => analysis?.scores ?? undefined, [analysis]);

  // Verifikasi terdahulu yang menempel pada dokumen riwayat yang sedang dibuka.
  const currentEntryVerifications = useMemo(() => {
    if (!savedHistoryId) return undefined;
    const entry = history.find((h) => h.id === savedHistoryId);
    return (entry as FishQualityHistoryEntry & {
      verifications?: Array<{ refId?: string; verdict: TangkapanVerificationVerdict; input: TangkapanVerificationInput }>;
    })?.verifications;
  }, [history, savedHistoryId]);

  const stats = useMemo(() => {
    if (!analysis || !formData) return null;
    const ssts = analysis.zones.map((z) => z.meanSst);
    const chls = analysis.zones.map((z) => z.meanChl);
    const phs = analysis.scores.map((s) => s.ph).filter((v): v is number => typeof v === 'number');
    return {
      zones: analysis.scores.length,
      good: analysis.scores.filter((s) => s.qualityScore >= 65).length,
      sstRange:
        ssts.length > 0
          ? `${Math.min(...ssts).toFixed(1)}–${Math.max(...ssts).toFixed(1)}°C`
          : '—',
      chlRange:
        chls.length > 0
          ? `${Math.min(...chls).toFixed(1)}–${Math.max(...chls).toFixed(1)} mg/m³`
          : '—',
      avgPh:
        phs.length > 0
          ? (phs.reduce((a, b) => a + b, 0) / phs.length).toFixed(2)
          : '—',
    };
  }, [analysis, formData]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#162e52]/20 border-t-[#162e52] rounded-full animate-spin" />
      </div>
    );
  }

  const centerLat = formData ? (formData.bbox.north + formData.bbox.south) / 2 : -6.9;
  const centerLon = formData ? (formData.bbox.east + formData.bbox.west) / 2 : 110.4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#162e52] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.79 2.084M11.25 14.25v.008M16.5 3.75h.008M21 21c-8.5-2-11-7-11-13m7.5 6.375c2.5.5 4.75 1.5 6 3.375" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#162e52] tracking-tight">Prediksi Kualitas Ikan</h1>
              <p className="text-[11px] text-zinc-500">
                {profile ? `${profile.fullName ?? profile.email} · Peneliti` : 'Peneliti'}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard/peneliti')}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#162e52] bg-white border border-zinc-300 hover:bg-zinc-100 rounded-xl transition-colors shadow-sm"
          >
            ← Dashboard
          </button>
        </div>

        {phase === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <FishingForm
                onSubmit={handleFormSubmit}
                isLoading={false}
                title="Prediksi Kualitas Ikan Laut"
                description="Analisis kualitas ikan di zona penangkapan terhadap perubahan iklim, suhu air, dan limbah — berbasis citra satelit (klorofil & suhu NASA), jarak ke titik kontaminasi, dan jendela habitat spesies."
                submitLabel="Analisis Kualitas Ikan"
              />
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Riwayat Prediksi</h4>
                    <p className="text-[11px] text-zinc-500">
                      Hasil prediksi tersimpan di Firestore — klik untuk membuka kembali
                    </p>
                  </div>
                </div>

                {historyErr && (
                  <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {historyErr}
                  </p>
                )}

                {history.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic pt-1">
                    Belum ada riwayat. Jalankan analisis pertama Anda untuk menyimpannya.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1 max-h-[400px] overflow-y-auto scroll-slim pr-1">
                    {history.map((entry) => {
                      const good = entry.analysis.scores.filter((s) => s.qualityScore >= 65).length;
                      const best = entry.analysis.scores[0];
                      const badge =
                        good > 0 && good === entry.analysis.scores.length ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white';
                      const badgeLabel = good === 0 ? 'BERISIKO' : `${good}/${entry.analysis.scores.length} BAIK`;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200/70 rounded-xl hover:border-sky-400/60 hover:shadow-sm transition-all group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-900 truncate">{entry.regionName}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {formatHistoryDate(entry.createdAt)} · {entry.analysis.scores.length} zona
                              {best ? ` · pH ${best.ph?.toFixed(2) ?? '—'}` : ''}
                            </p>
                          </div>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded flex-shrink-0 ${badge}`}>
                            {badgeLabel}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleLoadHistory(entry)}
                              title="Buka hasil prediksi"
                              className="w-7 h-7 rounded-lg bg-sky-700 text-white flex items-center justify-center hover:bg-sky-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            </button>
                            <button
                              onClick={() => entry.id && handleDeleteHistory(entry.id)}
                              title="Hapus dari riwayat"
                              className="w-7 h-7 rounded-lg bg-zinc-200 text-zinc-500 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <LoadingAnalysis steps={loadingSteps} locationName={formData?.regionName} />
        )}

        {phase === 'result' && analysis && formData && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-extrabold text-[#162e52]">
                    Visualisasi Kualitas Ikan — {formData.regionName}
                  </h2>
                  {savedToHistory && savedHistoryId && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Tersimpan ke Riwayat
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Warna zona = kualitas ikan · ungu = prediksi lokasi kawanan berikutnya · layer klorofil & suhu aktif secara default
                </p>
              </div>
              <button
                onClick={handleResetForm}
                className="px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Ubah Parameter Form
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="flex items-center gap-3 bg-white border border-zinc-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm5.94-2.56a.75.75 0 0 1 1.06 0l3.75 3.75 3.75-3.75a.75.75 0 1 1 1.06 1.06l-4.28 4.28a.75.75 0 0 1-1.06 0l-4.28-4.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-[#162e52] leading-none tabular-nums">{stats?.zones}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1">Zona Dinilai</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-zinc-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-emerald-600 leading-none tabular-nums">{stats?.good}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1">Zona Baik (≥ 65)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-zinc-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a5 5 0 0 1 3 9c-.6.5-1 1.2-1 2v1.5a2 2 0 0 1-4 0V14c0-.8-.4-1.5-1-2A5 5 0 0 1 12 3zM12 3v1.5M12 19.5V21" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-[#162e52] leading-none tabular-nums truncate">{stats?.sstRange}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1">Suhu Permukaan</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white border border-zinc-200/80 rounded-2xl p-3.5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3 3 0 1 0 6 0c0-1.2-1.5-3-3-5.5-1.5 2.5-3 4.3-3 5.5z" />
                    <path strokeLinecap="round" d="M10 21h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-[#162e52] leading-none tabular-nums truncate">
                    {stats?.avgPh !== '—' ? `pH ${stats?.avgPh}` : '—'}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-1">
                    pH Rata-rata
                  </p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-6">
                  <FishingMap
                    analysis={analysis}
                    centerLat={centerLat}
                    centerLon={centerLon}
                    departure={{ lat: formData.departureLat, lon: formData.departureLon }}
                    qualityScores={qualityScores}
                    nextSchool={analysis.aiAnalysis?.nextSchool ?? null}
                    bbox={formData.bbox}
                    layers={analysis.layers ?? null}
                    heightClass="h-[52vh] lg:h-[calc(100vh-230px)]"
                  />
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="lg:h-[calc(100vh-230px)] lg:overflow-y-auto scroll-slim lg:pr-1.5 space-y-4">
                  <KualitasPanel analysis={analysis} onReset={handleResetForm} />
                  <VerifikasiTangkapan
                    analysis={analysis}
                    uid={uid}
                    regionName={formData.regionName}
                    analysisId={savedHistoryId}
                    existingVerifications={currentEntryVerifications}
                    onSaved={handleVerificationSaved}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}