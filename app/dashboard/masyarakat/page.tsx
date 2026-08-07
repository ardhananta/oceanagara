'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';
import kualitasIkan from '@/public/img/MasyarakatKualitasIkan.png';
import pengolahanIkan from '@/public/img/MasyarakatPengolahanIkan.png';
import airLaut from '@/public/img/MasyarakatAirLaut.png';

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
    id: 'kualitas-ikan',
    title: 'Cara Membedakan Kualitas Ikan',
    description: 'Panduan lengkap mengenali ciri ikan segar dan tidak segar berdasarkan tampilan mata, insang, aroma, tekstur daging, dan sisik.',
    tag: 'Panduan Konsumen',
    imagePlaceholderColor: 'from-[#1a3e2a]/85 via-[#152e22]/90 to-[#0c1a12]',
    imageSrc: kualitasIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    id: 'pengolahan-ikan',
    title: 'Cara Pengolahan Ikan yang Benar',
    description: 'Langkah-langkah higienis pengolahan ikan dari pendinginan, pencucian, pembersihan hingga penyimpanan yang aman dan bernutrisi.',
    tag: 'Keamanan Pangan',
    imagePlaceholderColor: 'from-[#3e2a1a]/85 via-[#2e1f12]/90 to-[#1a100a]',
    imageSrc: pengolahanIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 19.5v-2.25a3.75 3.75 0 0 0-7.5 0V19.5m7.5 0H3.75m11.25 0h3.75M3.75 19.5h3.75" />
      </svg>
    ),
  },
  {
    id: 'kondisi-air-laut',
    title: 'Edukasi Kondisi Air Laut',
    description: 'Memahami parameter kualitas air laut: kejernihan, salinitas, pH, oksigen terlarut, dan biota indikator untuk ekosistem yang sehat.',
    tag: 'Ekosistem Laut',
    imagePlaceholderColor: 'from-[#0e2a4a]/85 via-[#0d2240]/90 to-[#07121f]',
    imageSrc: airLaut.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.115.024.507-.14 1.475-.889 2.77 1.889-.4 3.25-1.125 3.889-1.607A10.716 10.716 0 0 0 12 17.5c4.97 0 9-3.184 9-7.115C21 6.185 16.97 3 12 3Z" />
      </svg>
    ),
  },
];

const MODAL_DETAIL: Record<string, { lines: string[]; steps?: string[]; params?: { label: string; value: string }[] }> = {
  'kualitas-ikan': {
    lines: [
      'Periksa mata: ikan segar memiliki mata jernih, cembung, dan tidak keruh.',
      'Cek insang: warna merah cerah menandakan ikan masih segar.',
      'Uji aroma: ikan segar berbau amis laut ringan, bukan busuk atau amonia.',
      'Tekan daging: daging kenyal dan membal kembali adalah tanda kesegaran.',
      'Amati sisik: melekat kuat, mengkilap, dan tidak mudah lepas.',
      'Perhatikan warna kulit: cerah dan mengkilap sesuai warna aslinya.',
      'Cek lendir: tipis dan jernih, bukan tebal dan berbau.',
      'Lihat rongga perut: tidak kembung atau bergas.',
    ],
  },
  'pengolahan-ikan': {
    lines: ['Ikuti 6 langkah kritis ini untuk memastikan ikan aman dan bergizi saat dikonsumsi:'],
    steps: [
      'Segera dinginkan ikan dengan es batu (0-4 derajat C) setelah ditangkap.',
      'Cuci dengan air mengalir bersih, bersihkan insang dan rongga perut.',
      'Keluarkan isi perut sesegera mungkin sebagai sumber utama bakteri.',
      'Pisahkan ikan dari bahan makanan lain di lemari pendingin.',
      'Masak hingga suhu bagian dalam minimal 70 derajat C untuk membunuh patogen.',
      'Simpan sisa masakan dalam wadah tertutup dan konsumsi dalam 1-2 hari.',
    ],
  },
  'kondisi-air-laut': {
    lines: ['Kenali 5 parameter penting kualitas air laut untuk ekosistem yang sehat:'],
    params: [
      { label: 'Kejernihan dan Warna', value: 'Air biru jernih, visibilitas minimal 10 meter, tanpa lapisan minyak.' },
      { label: 'Salinitas', value: '30-35 PSU untuk laut tropis yang sehat dan stabil.' },
      { label: 'pH', value: '7.8-8.3 (sedikit basa) optimal untuk pertumbuhan terumbu karang.' },
      { label: 'Oksigen Terlarut (DO)', value: 'Minimal 6 mg/L agar biota laut dapat hidup dengan optimal.' },
      { label: 'Biota Indikator', value: 'Karang hidup, lamun, dan keragaman ikan menandakan ekosistem sehat.' },
    ],
  },
};

export default function DashboardMasyarakatPage() {
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
        if (uProfile && uProfile.role === 'masyarakat') {
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

  const displayName = profile?.displayName || 'Sahabat Laut';
  const modalContent = selectedFeature ? MODAL_DETAIL[selectedFeature.id] : null;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#204473] selection:text-white">

      <div className="relative w-full">

        <div className="absolute top-0 inset-x-0 h-[560px] md:h-[600px] z-0 select-none pointer-events-none overflow-hidden">
          <img
            src="/img/background.webp"
            alt="Oceanagara background header"
            className="w-full h-full object-cover object-top"
          />
        </div>

        <header className="relative z-40 bg-transparent px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold tracking-widest text-sm text-white uppercase hover:text-sky-200 transition-colors">
              OCEANAGARA
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Dashboard Masyarakat
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

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 pt-8 pb-16">

          <div className="space-y-2 max-w-3xl mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal text-white tracking-tight drop-shadow">
              Halo! Selamat datang <span className="font-bold">{displayName}</span>
            </h1>
            <p className="text-sm sm:text-base italic text-sky-100/90 font-light tracking-wide drop-shadow">
              pelajari informasi penting seputar kualitas ikan, cara pengolahan, dan kondisi ekosistem laut
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-6 p-4 bg-[#162e52]/75 border border-white/20 backdrop-blur-md rounded-xl text-white shadow-xl mb-12">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Peran</span>
                <span className="text-xs font-bold text-white uppercase">Masyarakat Umum</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Nama</span>
              <span className="text-xs font-semibold text-white">{profile?.displayName || '-'}</span>
            </div>
            <div className="h-8 w-px bg-white/20 hidden md:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Akses</span>
              <span className="text-xs font-semibold text-white">Portal Informasi Kelautan</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => setSelectedFeature(card)}
                className="group cursor-pointer"
              >
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
                      <span>Lihat Info</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <section className="bg-white border-t border-zinc-100 py-16 px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Pusat Edukasi &amp; Informasi
            </span>
            <h2 className="text-2xl font-extrabold text-[#162e52] uppercase tracking-tight">
              Wawasan Kelautan untuk Masyarakat
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">01</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Kenali Kualitas Ikan</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pelajari 8 indikator utama membedakan ikan segar dan tidak layak konsumsi untuk melindungi kesehatan keluarga.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">02</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Pengolahan Higienis</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Ikuti 6 langkah pengolahan ikan yang benar dari pendinginan hingga penyimpanan untuk menjaga nutrisi dan keamanan pangan.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#162e52] text-white flex items-center justify-center font-bold text-sm shadow-sm">03</div>
              <h4 className="text-sm font-bold text-[#162e52] uppercase tracking-wider">Ekosistem Air Laut</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pahami 5 parameter kualitas air laut dan peran penting ekosistem pesisir untuk kehidupan biota laut dan kesejahteraan nelayan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {selectedFeature && modalContent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 relative space-y-4 shadow-2xl text-zinc-900 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              X
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

            {modalContent.lines && (
              <div className="space-y-1.5">
                {modalContent.lines.map((line, i) => (
                  <p key={i} className="text-xs text-zinc-600 leading-relaxed">{line}</p>
                ))}
              </div>
            )}

            {modalContent.steps && (
              <ol className="space-y-2">
                {modalContent.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-zinc-700">
                    <span className="w-5 h-5 rounded-full bg-[#162e52] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}

            {modalContent.params && (
              <div className="space-y-2">
                {modalContent.params.map((param, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <span className="w-5 h-5 rounded-full bg-[#162e52] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#162e52] mb-0.5">{param.label}</p>
                      <p className="text-xs text-zinc-600 leading-relaxed">{param.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
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