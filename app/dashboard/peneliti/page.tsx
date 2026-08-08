'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';
import dynamic from 'next/dynamic';
import kualitas from '@/public/img/Kualitas.webp';
import limbah from '@/public/img/Limbah.webp';
import peta from '@/public/img/Tercemar.webp';
import zona from '@/public/img/ZonaIkan.webp';

const WaveMap = dynamic(() => import('@/components/dashboard/WaveMap'), { ssr: false });

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  tag: string;
  imagePlaceholderColor?: string;
  imageSrc?: string;
  icon: React.ReactNode;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'peta-risiko',
    title: 'Peta risiko pencemaran',
    description: 'Pemetaan visual area berisiko pencemaran laut dan tumpahan minyak terkini.',
    tag: 'Riset & Lingkungan',
    imagePlaceholderColor: 'from-[#1e3427]/85 via-[#182938]/90 to-[#0e1724]',
    imageSrc: peta.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    id: 'prediksi-limbah',
    title: 'Prediksi penyebaran limbah',
    description: 'Simulasi dan permodelan trajektori pergerakan limbah laut berbasis arus.',
    tag: 'Simulasi Arus',
    imagePlaceholderColor: 'from-[#1c383e]/85 via-[#182b3a]/90 to-[#0d1822]',
    imageSrc: limbah.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    id: 'prediksi-kualitas',
    title: 'Prediksi perubahan kualitas ikan laut',
    description: 'Analisis indikator suhu, salinitas, dan kualitas nutrisi habitat ikan.',
    tag: 'Kualitas Hayati',
    imagePlaceholderColor: 'from-[#14375a]/85 via-[#192f4c]/90 to-[#0b1728]',
    imageSrc: kualitas.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    id: 'rekomendasi-zona',
    title: 'Rekomendasi zona penangkapan ikan',
    description: 'Estimasi koordinat titik tangkap ikan optimal dan efisien berbasis telemetri.',
    tag: 'Zona Tangkap',
    imagePlaceholderColor: 'from-[#122842]/85 via-[#162f4e]/90 to-[#0a1626]',
    imageSrc: zona.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
      </svg>
    ),
  },
];

export default function DashboardPenelitiPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<FeatureCard | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        if (uProfile && (uProfile.role === 'peneliti' || uProfile.role === 'nelayan-modern')) {
          setProfile(uProfile);
        } else if (uProfile) {
          const paths: Record<string, string> = {
            nelayan: '/dashboard/nelayan',
            'nelayan-modern': '/dashboard/peneliti',
            masyarakat: '/dashboard/masyarakat',
            peneliti: '/dashboard/peneliti',
          };
          router.push(uProfile.role ? paths[uProfile.role] : '/fill-form');
        } else {
          router.push('/fill-form');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b365d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const isNelayanModern = profile?.role === 'nelayan-modern';
  const displayName = profile?.displayName || (isNelayanModern ? 'Nelayan Modern' : 'User');

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#204473] selection:text-white">

      {/* ── Hero wrapper: background.webp + navbar + greeting + cards ── */}
      <div className="relative w-full">

        {/* Background image */}
        <div className="absolute top-0 inset-x-0 h-[560px] md:h-[600px] z-0 select-none pointer-events-none overflow-hidden">
          <img
            src="/img/background.webp"
            alt="Oceanagara background header"
            className="w-full h-full object-cover object-top"
          />
        </div>

        {/* ── Transparent Navbar ── */}
        <header className="relative z-40 bg-transparent px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold tracking-widest text-sm text-white uppercase hover:text-sky-200 transition-colors">
              OCEANAGARA
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              {isNelayanModern ? 'Dashboard Nelayan Modern' : 'Dashboard Peneliti'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="text-xs font-bold uppercase tracking-wider px-4 py-2 bg-transparent text-white border border-white/40 hover:bg-white hover:text-zinc-900 rounded transition-all duration-200 backdrop-blur-sm"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* ── Greeting + Profile pill + Feature cards ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 pt-8 pb-16">

          {/* Greeting */}
          <div className="space-y-2 max-w-3xl mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal text-white tracking-tight drop-shadow">
              Halo! Selamat datang <span className="font-bold">{displayName}</span>
            </h1>
            <p className="text-sm sm:text-base italic text-sky-100/90 font-light tracking-wide drop-shadow">
              yuk jelajahi berbagai macam fitur yang ada di ocenagara
            </p>
          </div>

          {/* Profile pill */}
          <div className="inline-flex flex-wrap items-center gap-6 p-4 bg-[#162e52]/75 border border-white/20 backdrop-blur-md rounded-xl text-white shadow-xl mb-12">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Peran</span>
                <span className="text-xs font-bold text-white uppercase">{isNelayanModern ? 'Nelayan Modern' : 'Peneliti'}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/20 hidden sm:block" />

            {isNelayanModern ? (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Nama Kapal</span>
                  <span className="text-xs font-semibold text-white">{String(profile?.namaKapal || '-')}</span>
                </div>
                <div className="h-8 w-px bg-white/20 hidden md:block" />
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Sistem Navigasi</span>
                  <span className="text-xs font-semibold text-white">{String(profile?.sistemNavigasi || '-')}</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Bidang Riset</span>
                  <span className="text-xs font-semibold text-white">{String(profile?.bidangRiset || '-')}</span>
                </div>
                <div className="h-8 w-px bg-white/20 hidden md:block" />
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Institusi</span>
                  <span className="text-xs font-semibold text-white">{String(profile?.institusi || '-')}</span>
                </div>
              </>
            )}
          </div>

          {/* ── 4 Feature Cards (always 4-col grid) ── */}
          <div className="grid grid-cols-4 gap-3 md:gap-6">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => {
                  if (card.id === 'peta-risiko') {
                    router.push('/dashboard/peneliti/peta-risiko');
                  } else if (card.id === 'prediksi-limbah') {
                    router.push('/dashboard/peneliti/arus-pencemaran');
                  } else {
                    setSelectedFeature(card);
                  }
                }}
                className="group cursor-pointer"
              >
                {/* MOBILE (< md): compact square icon tile */}
                <div className="md:hidden flex flex-col items-center gap-2">
                  <div className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${card.imagePlaceholderColor} flex items-center justify-center shadow-lg border border-white/20 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 group-hover:border-sky-300/60`}>
                    <div className="text-white/70 group-hover:text-white transition-colors">
                      {card.icon}
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                    {card.title}
                  </p>
                </div>

                {/* DESKTOP (md+): tall image card */}
                <div className="hidden md:flex relative h-80 rounded-[22px] p-6 flex-col justify-between overflow-hidden shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-[#152740] border border-white/20 text-white group-hover:border-sky-300/80">
                  {card.imageSrc && (
                    <img
                      src={card.imageSrc}
                      alt={card.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />

                  <div className="relative z-10">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-white/15 text-sky-100 border border-white/25 backdrop-blur-sm">
                      {card.tag}
                    </span>
                  </div>

                  <div className="relative z-10 space-y-2">
                    <h3 className="text-lg font-bold leading-snug tracking-tight text-white group-hover:text-sky-100">
                      {card.title}
                    </h3>
                    <p className="text-xs line-clamp-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sky-200/90">
                      {card.description}
                    </p>
                    <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold group-hover:translate-x-1 transition-transform text-sky-300">
                      <span>Lihat Fitur</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── BMKG Wave Monitoring Map Widget ── */}
          <div className="mt-12">
            <WaveMap />
          </div>

        </div>
      </div>

      {/* ── Feature Detail Modal ── */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 relative space-y-4 shadow-2xl text-zinc-900">
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-700 bg-zinc-100 border border-zinc-200 rounded">
              {selectedFeature.tag}
            </span>

            <h3 className="text-xl font-extrabold text-[#162e52]">
              {selectedFeature.title}
            </h3>

            <p className="text-sm text-zinc-600 leading-relaxed">
              {selectedFeature.description}
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              {selectedFeature?.id === 'peta-risiko' && (
                <button
                  onClick={() => router.push('/dashboard/peneliti/peta-risiko')}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold uppercase tracking-wider rounded transition-all duration-200 shadow-sm flex items-center gap-2"
                >
                  <span>Buka Fitur</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              )}
              {selectedFeature?.id === 'prediksi-limbah' && (
                <button
                  onClick={() => router.push('/dashboard/peneliti/arus-pencemaran')}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold uppercase tracking-wider rounded transition-all duration-200 shadow-sm flex items-center gap-2"
                >
                  <span>Buka Fitur</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setSelectedFeature(null)}
                className="px-5 py-2.5 bg-[#162e52] hover:bg-[#1f4275] text-white text-xs font-bold uppercase tracking-wider rounded transition-all duration-200 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
