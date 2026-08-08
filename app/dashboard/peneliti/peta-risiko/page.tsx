'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import RiskForm from '@/components/peta-risiko/RiskForm';
import LoadingAnalysis from '@/components/peta-risiko/LoadingAnalysis';
import RiskPanel from '@/components/peta-risiko/RiskPanel';
import { onAuthChange, getUserProfile, UserProfile } from '@/app/service/authentication';

import type {
  LocationQuery,
  MaritimeDataBundle,
  RiskAnalysisResult,
} from '@/app/types/maritime';

// Leaflet map component dynamically imported to prevent SSR window issues
const RiskMap = dynamic(() => import('@/components/peta-risiko/RiskMap'), { ssr: false });

const LOADING_STEPS = [
  'Agent 1 (Aruna) menyintesis koordinat & parameter wilayah…',
  'Mengambil data perairan BMKG Maritim (cuaca & arus)…',
  'Mengambil data aktivitas kapal Global Fishing Watch (GFW)…',
  'Mengambil posisi real-time kapal AISStream…',
  'Agent 2 (Triton) memodelkan titik risiko pencemaran & koordinat…',
];

type Phase = 'form' | 'loading' | 'result';

async function fetchMaritimeData(location: LocationQuery): Promise<MaritimeDataBundle> {
  const { lat, lon, boundingBox: bb, startDate, endDate } = location;
  const errors: string[] = [];

  const [bmkgRes, gfwRes, aisstreamRes] = await Promise.allSettled([
    fetch(`/api/maritime/bmkg?lat=${lat}&lon=${lon}`).then((r) => r.json()),
    fetch(
      `/api/maritime/gfw?north=${bb.north}&south=${bb.south}&east=${bb.east}&west=${bb.west}&startDate=${startDate}&endDate=${endDate}`
    ).then((r) => r.json()),
    fetch(
      `/api/maritime/aisstream?north=${bb.north}&south=${bb.south}&east=${bb.east}&west=${bb.west}`
    ).then((r) => r.json()),
  ]);

  return {
    bmkg: bmkgRes.status === 'fulfilled' ? bmkgRes.value : (errors.push('BMKG fetch gagal'), null),
    gfw: gfwRes.status === 'fulfilled' ? gfwRes.value : (errors.push('GFW fetch gagal'), null),
    aisstream:
      aisstreamRes.status === 'fulfilled' ? aisstreamRes.value : (errors.push('AISStream fetch gagal'), null),
    fetchedAt: new Date().toISOString(),
    errors,
  };
}

export default function PetaRisikoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>('form');
  const [location, setLocation] = useState<LocationQuery | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(
    LOADING_STEPS.map((label) => ({ label, done: false, active: false }))
  );
  const [result, setResult] = useState<RiskAnalysisResult | null>(null);

  // Auth Verification
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

  // Execute Agentic AI Pipeline from Form Submission
  const handleFormSubmit = useCallback(async (locationQuery: LocationQuery) => {
    setLocation(locationQuery);
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
      // Step 0: Agent 1 parses location parameters
      stepProgress(0);
      await new Promise((r) => setTimeout(r, 600));

      // Step 1: Fetch BMKG Data
      stepProgress(1);
      const maritimeData = await fetchMaritimeData(locationQuery);

      // Step 2 & 3: GFW & AISStream progress animation
      stepProgress(2);
      await new Promise((r) => setTimeout(r, 500));
      stepProgress(3);
      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Agent 2 Risk Analysis Call
      stepProgress(4);
      const agentRes = await fetch('/api/ai/agent2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locationQuery, maritimeData }),
      });
      const agentData = await agentRes.json();

      setLoadingSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));
      await new Promise((r) => setTimeout(r, 400));

      if (agentData.result) {
        setResult(agentData.result);
        setPhase('result');
      } else {
        alert('Gagal memproses analisis AI. Silakan coba lagi.');
        setPhase('form');
      }
    } catch (err) {
      console.error('[PetaRisikoPage] Error:', err);
      alert('Terjadi kesalahan saat memproses data. Silakan coba lagi.');
      setPhase('form');
    }
  }, []);

  const handleResetForm = useCallback(() => {
    setPhase('form');
    setResult(null);
    setLocation(null);
    setLoadingSteps(LOADING_STEPS.map((label) => ({ label, done: false, active: false })));
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1b365d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const isNelayanModern = profile?.role === 'nelayan-modern';

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col selection:bg-[#204473] selection:text-white">
      {/* ── Top Header Bar with Background image ── */}
      <div className="relative w-full bg-[#162e52]">
        <div className="absolute top-0 inset-x-0 h-full select-none pointer-events-none overflow-hidden opacity-40">
          <img
            src="/img/background.webp"
            alt="Oceanagara header background"
            className="w-full h-full object-cover object-top"
          />
        </div>

        <header className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={isNelayanModern ? '/dashboard/peneliti' : '/dashboard/peneliti'}
              className="font-extrabold tracking-widest text-sm text-white uppercase hover:text-sky-200 transition-colors"
            >
              OCEANAGARA
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Peta Risiko Pencemaran
            </span>
          </div>

          <Link
            href="/dashboard/peneliti"
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 bg-white/10 hover:bg-white text-white hover:text-zinc-900 border border-white/30 rounded-xl transition-all duration-200 backdrop-blur-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Kembali ke Dashboard
          </Link>
        </header>

        {/* Header Title Section */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-4 pb-12 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 border border-white/20 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-3 backdrop-blur-sm">
            <span>Agentic AI Feature</span>
            <span>•</span>
            <span className="text-sky-200">Aruna &amp; Triton Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Fitur Peta Risiko Pencemaran Laut
          </h1>
          <p className="text-sm md:text-base text-sky-100/90 max-w-2xl mt-2 font-light leading-relaxed">
            Isi parameter wilayah dan indikator riset di bawah ini. AI kami akan secara otomatis memproses data API maritim (BMKG, GFW, AISStream) dan menampilkan titik koordinat risiko pencemaran secara spesifik.
          </p>
        </div>
      </div>

      {/* ── Main Workspace Content ── */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-12 py-8">
        {/* PHASE 1: FORM FILL */}
        {phase === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form */}
            <div className="lg:col-span-8">
              <RiskForm onSubmit={handleFormSubmit} isLoading={false} />
            </div>

            {/* Right Column: Info Cards & Workflow Info */}
            <div className="lg:col-span-4 space-y-6">
              {/* Agentic AI Overview Card */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-md">
                    AI
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">
                      Sistem 2 Agentic AI
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Pemrosesan data otomatis &amp; terstruktur
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-3.5 bg-zinc-50 border border-zinc-200/60 rounded-xl">
                    <p className="text-xs font-bold text-[#162e52]">Agent 1: Aruna (Gatherer)</p>
                    <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                      Menyintesis input form Anda menjadi koordinat bounding box dan parameter temporal terstruktur.
                    </p>
                  </div>

                  <div className="p-3.5 bg-zinc-50 border border-zinc-200/60 rounded-xl">
                    <p className="text-xs font-bold text-[#162e52]">Agent 2: Triton (Risk Analyzer)</p>
                    <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                      Menganalisis gabungan data cuaca, pergerakan kapal, dan pola limbah untuk menentukan koordinat titik risiko.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Sources Card */}
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-[#162e52] uppercase tracking-wider">
                  Sumber API Maritim Terintegrasi
                </h4>
                <div className="space-y-2 pt-1">
                  {[
                    { name: 'BMKG Public API', desc: 'Suhu, gelombang, dan arus laut' },
                    { name: 'Global Fishing Watch (GFW)', desc: 'Pelacakan aktivitas kapal penangkap ikan' },
                    { name: 'AISStream REST / WS', desc: 'Posisi & pergerakan kapal real-time' },
                  ].map((s) => (
                    <div key={s.name} className="flex items-start gap-2 text-xs">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <div>
                        <span className="font-bold text-zinc-800">{s.name}</span>
                        <span className="text-zinc-500 block text-[11px]">{s.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: LOADING */}
        {phase === 'loading' && (
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm my-8">
            <LoadingAnalysis steps={loadingSteps} locationName={location?.regionName} />
          </div>
        )}

        {/* PHASE 3: RESULT & VISUALIZATION */}
        {phase === 'result' && result && location && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 text-[#162e52]">
                    Hasil Analisis Terbuka
                  </span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-600 font-semibold">{location.regionName}</span>
                </div>
                <h2 className="text-xl font-extrabold text-[#162e52] mt-1">
                  Visualisasi &amp; Koordinat Risiko Pencemaran
                </h2>
              </div>

              <button
                onClick={handleResetForm}
                className="px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Ubah Parameter Form</span>
              </button>
            </div>

            {/* Main Result Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[600px]">
              {/* Map Column */}
              <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-3xl p-3 shadow-sm flex flex-col">
                <div className="flex-1 w-full rounded-2xl overflow-hidden min-h-[480px]">
                  <RiskMap
                    riskPoints={result.riskPoints}
                    centerLat={location.lat}
                    centerLon={location.lon}
                    regionName={location.regionName}
                  />
                </div>
              </div>

              {/* Panel Column */}
              <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                <RiskPanel result={result} onReset={handleResetForm} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
