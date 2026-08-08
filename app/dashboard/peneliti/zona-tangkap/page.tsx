'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import FishingForm, { type FishingFormData } from '@/components/zona-tangkap/FishingForm';
import LoadingAnalysis from '@/components/peta-risiko/LoadingAnalysis';
import FishingPanel from '@/components/zona-tangkap/FishingPanel';
import { onAuthChange, getUserProfile, UserProfile } from '@/app/service/authentication';
import type { FishingZoneAnalysis } from '@/app/types/maritime';

const FishingMap = dynamic(() => import('@/components/zona-tangkap/FishingMap'), { ssr: false });

const LOADING_STEPS = [
  'Mengambil citra klorofil & suhu laut (NASA GIBS)…',
  'Mendeteksi zona kontaminasi (sampah padat, minyak, termal)…',
  'Memindai aktivitas kapal penangkap Global Fishing Watch…',
  'Memodelkan kesesuaian habitat & spesies ikan…',
  'Melacak arah pergerakan kawanan ikan…',
  'AI menganalisis rekomendasi zona & arah migrasi…',
];

type Phase = 'form' | 'loading' | 'result';

export default function ZonaTangkapPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('form');
  const [formData, setFormData] = useState<FishingFormData | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(
    LOADING_STEPS.map((label) => ({ label, done: false, active: false }))
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
        `/api/maritime/zona-tangkap?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}&date=${data.date}`
      );
      const payload = await res.json();

      if (payload.zones || payload.summary) {
        setLoadingSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));

        // Agentic AI: analisis data zona-tangkap (Nala) — rekomendasi zona,
        // arah gerak kawanan, dan saran berbasis aktivitas kapal GFW.
        stepProgress(4);
        let analysis = payload as FishingZoneAnalysis;
        try {
          const aiRes = await fetch('/api/ai/fishing-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis }),
          });
          const aiPayload = await aiRes.json();
          if (aiPayload?.aiAnalysis) {
            analysis = { ...analysis, aiAnalysis: aiPayload.aiAnalysis };
          }
        } catch (err) {
          console.warn('[ZonaTangkap] AI analysis skipped:', err);
        }

        await new Promise((r) => setTimeout(r, 400));

        setAnalysis(analysis);
        setPhase('result');
      } else {
        alert('Gagal memproses analisis zona tangkap. Silakan coba lagi.');
        setPhase('form');
      }
    } catch (err) {
      console.error('[ZonaTangkap] Error:', err);
      alert('Terjadi kesalahan saat memproses data. Silakan coba lagi.');
      setPhase('form');
    }
  }, []);

  const handleResetForm = useCallback(() => {
    setPhase('form');
    setAnalysis(null);
    setLoadingSteps(LOADING_STEPS.map((label) => ({ label, done: false, active: false })));
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#162e52]/20 border-t-[#162e52] rounded-full animate-spin" />
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
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50 to-white pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#162e52] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#162e52] tracking-tight">Zona Tangkap Ikan</h1>
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

        {phase === 'form' && <FishingForm onSubmit={handleFormSubmit} isLoading={false} />}

        {phase === 'loading' && (
          <LoadingAnalysis steps={loadingSteps} locationName={formData?.regionName} />
        )}

        {phase === 'result' && analysis && formData && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#162e52]">
                  Visualisasi Zona Tangkap — {formData.regionName}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Zona hijau = aman dari kontaminasi · panah = arah pergerakan kawanan ikan
                </p>
              </div>
              <button
                onClick={handleResetForm}
                className="px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Ubah Parameter Form
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
                    heightClass="h-[52vh] lg:h-[calc(100vh-160px)]"
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
