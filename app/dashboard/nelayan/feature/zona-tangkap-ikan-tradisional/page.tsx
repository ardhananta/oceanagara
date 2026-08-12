'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import FishingForm, { type FishingFormData } from '@/components/zona-tangkap/FishingForm';
import LoadingAnalysis from '@/components/peta-risiko/LoadingAnalysis';
import FishingPanel from '@/components/zona-tangkap/FishingPanel';
import { onAuthChange, getUserProfile, UserProfile } from '@/app/service/authentication';
import type { FishingZoneAnalysis } from '@/app/types/maritime';

const FishingMap = dynamic(() => import('@/components/zona-tangkap/FishingMap'), { ssr: false });

const TRADITIONAL_LOADING_STEPS = [
  'Mengambil citra klorofil-a & suhu laut pesisir (NASA GIBS)…',
  'Mendeteksi zona kumpul ikan terdekat (< 12 mil laut)…',
  'Mengkalkulasi estimasi perkiraan posisi kawanan ikan…',
  'Menganalisis pergerakan arus & keamanan perahu…',
  'Melacak estimasi jarak tempuh & hemat BBM perahu tradisional…',
  'AI Nala menyusun rekomendasi titik tangkap pesisir terbaik…',
];

type Phase = 'form' | 'loading' | 'result';

export default function ZonaTangkapIkanTradisionalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('form');
  const [formData, setFormData] = useState<FishingFormData | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(
    TRADITIONAL_LOADING_STEPS.map((label) => ({ label, done: false, active: false }))
  );
  const [analysis, setAnalysis] = useState<FishingZoneAnalysis | null>(null);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        setProfile(uProfile);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  const vesselInfo = {
    namaKapal: String(profile?.namaKapal || 'Perahu Motor Tempel'),
    jenisKapal: String(profile?.jenisKapal || 'Perahu Kayu Tradisional'),
    ukuranKapal: String(profile?.ukuranKapal || '< 5 GT'),
    wilayahOperasi: String(profile?.wilayahOperasi || '-'),
  };

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
      await new Promise((r) => setTimeout(r, 400));
      stepProgress(1);

      const res = await fetch(
        `/api/maritime/zona-tangkap?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}&date=${data.date}&depLat=${data.departureLat}&depLon=${data.departureLon}&userRole=nelayan_tradisional`
      );
      const payload = await res.json();

      if (payload.zones || payload.summary) {
        stepProgress(2);
        await new Promise((r) => setTimeout(r, 300));
        stepProgress(3);

        let analysisData = payload as FishingZoneAnalysis;
        try {
          const aiRes = await fetch('/api/ai/fishing-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              analysis: analysisData,
              userRole: 'nelayan_tradisional',
              vesselInfo,
            }),
          });
          const aiPayload = await aiRes.json();
          if (aiPayload?.aiAnalysis) {
            analysisData = { ...analysisData, aiAnalysis: aiPayload.aiAnalysis };
          }
        } catch (err) {
          console.warn('[ZonaTangkapTradisional] AI analysis skipped:', err);
        }

        stepProgress(4);
        await new Promise((r) => setTimeout(r, 300));
        setLoadingSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));

        setAnalysis(analysisData);
        setPhase('result');
      } else {
        alert('Gagal memproses kalkulasi zona tangkap pesisir. Silakan coba lagi.');
        setPhase('form');
      }
    } catch (err) {
      console.error('[ZonaTangkapTradisional] Error:', err);
      alert('Terjadi kesalahan saat memproses data. Silakan coba lagi.');
      setPhase('form');
    }
  }, [vesselInfo]);

  const handleResetForm = useCallback(() => {
    setPhase('form');
    setAnalysis(null);
    setLoadingSteps(TRADITIONAL_LOADING_STEPS.map((label) => ({ label, done: false, active: false })));
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0c2d52] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-sky-200 border-t-white rounded-full animate-spin" />
        <p className="text-white text-sm font-semibold">Memuat Peta Zona Tangkap…</p>
      </div>
    );
  }

  const centerLat = formData ? (formData.bbox.north + formData.bbox.south) / 2 : -6.9;
  const centerLon = formData ? (formData.bbox.east + formData.bbox.west) / 2 : 110.4;

  const targetZone =
    analysis && analysis.zones.length > 0
      ? analysis.aiAnalysis?.recommendedZoneIndex !== undefined &&
        analysis.zones[analysis.aiAnalysis.recommendedZoneIndex]
        ? analysis.zones[analysis.aiAnalysis.recommendedZoneIndex]
        : [...analysis.zones].sort((a, b) => b.score - a.score)[0]
      : null;

  return (
    <div className="min-h-screen bg-slate-100 pb-16 font-sans">

      {/* Solid Top Header Navigation */}
      <header className="bg-[#0c2d52] text-white px-4 sm:px-8 py-4 flex items-center justify-between mb-6 border-b border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="font-extrabold tracking-widest text-base text-white uppercase hover:text-sky-200 transition-colors flex-shrink-0">
            OCEANAGARA
          </Link>
          <span className="text-zinc-400 font-bold">/</span>
          <Link href="/dashboard/nelayan" className="text-sm font-bold text-white/80 hover:text-white transition-colors truncate">
            Dashboard Nelayan
          </Link>
          <span className="text-zinc-400 font-bold hidden sm:inline">/</span>
          <span className="text-sm font-bold text-sky-200 truncate hidden sm:inline">
            Zona Tangkap Pesisir
          </span>
        </div>
        <Link
          href="/dashboard/nelayan"
          className="flex-shrink-0 inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider px-4 py-2 bg-white text-[#0c2d52] hover:bg-sky-100 rounded-lg transition-colors"
        >
          ← Kembali ke Dashboard
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">

        {/* Solid Vessel Specs Banner */}
        <div className="bg-[#0c2d52] text-white rounded-2xl p-5 sm:p-6 border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#163e6e] flex items-center justify-center text-sky-200 flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L12 3l9.75 15M2.25 18h19.5" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-bold text-sky-200 uppercase tracking-wider block">Data Kapal Terdaftar Anda</span>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {vesselInfo.namaKapal} <span className="text-xs font-normal text-sky-200">({vesselInfo.jenisKapal} · {vesselInfo.ukuranKapal})</span>
              </h3>
              <p className="text-xs text-zinc-300 mt-0.5">Pangkalan: {vesselInfo.wilayahOperasi}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-[#163e6e] border border-sky-400/40 text-sky-200 text-xs font-bold rounded-lg uppercase tracking-wider flex-shrink-0">
            Kalkulasi Khusus Kapal Ini
          </span>
        </div>

        {phase === 'form' && (
          <FishingForm
            onSubmit={handleFormSubmit}
            isLoading={false}
            title="Kalkulator Zona Tangkap Pesisir Terdekat"
            description={`Analisis otomatis disesuaikan dengan spesifikasi kapal Anda (${vesselInfo.namaKapal}) untuk menghitung jarak, waktu tempuh, dan konsumsi BBM.`}
            submitLabel="Cari Titik Tangkap Ikan Sekarang"
          />
        )}

        {phase === 'loading' && (
          <LoadingAnalysis steps={loadingSteps} locationName={formData?.regionName} />
        )}

        {phase === 'result' && analysis && formData && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-zinc-300">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#0c2d52]">
                  Hasil Lokasi Ikan — {formData.regionName}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 mt-1 font-medium flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Lingkaran Hijau = Titik kumpul ikan terdekat
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-bold text-sky-700">
                    <svg className="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l-8 4v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" />
                    </svg>
                    Pelabuhan Anda
                  </span>
                  <span>•</span>
                  <span className="font-bold text-zinc-700">Garis Putus-putus = Rute Paling Hemat BBM</span>
                </p>
              </div>
              <button
                onClick={handleResetForm}
                className="px-5 py-2.5 bg-[#0c2d52] hover:bg-[#163e6e] text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Ulangi Cari Zona Tangkap
              </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-6">
                  <FishingMap
                    analysis={analysis}
                    centerLat={centerLat}
                    centerLon={centerLon}
                    departure={{ lat: formData.departureLat, lon: formData.departureLon }}
                    targetZone={targetZone}
                    heightClass="h-[65vh] lg:h-[calc(100vh-140px)] min-h-[580px]"
                  />
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="lg:h-[calc(100vh-160px)] lg:overflow-y-auto scroll-slim lg:pr-1.5">
                  <FishingPanel
                    analysis={analysis}
                    onReset={handleResetForm}
                    departure={{ lat: formData.departureLat, lon: formData.departureLon }}
                    targetZone={targetZone}
                    vesselInfo={vesselInfo}
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
