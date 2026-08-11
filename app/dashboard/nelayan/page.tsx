'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';
import pemeliharaanIkan from '@/public/img/NelayanPemeliharaanIkan.png';
import pemasaranIkan from '@/public/img/NelayanPemasaranIkan.png';
import zonaTangkap from '@/public/img/NelayanZonaTangkap.png';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  tag: string;
  imageSrc: string;
  actionText: string;
  icon: React.ReactNode;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'zona-tangkap-ikan-tradisional',
    title: 'Peta & Zona Tangkap Ikan',
    description:
      'Cari lokasi kumpul ikan terdekat (< 12 mil laut) dari pelabuhan Anda. Dilengkapi perkiraan posisi kawanan ikan dan rute hemat bahan bakar.',
    tag: 'Fitur Utama Pesisir',
    imageSrc: zonaTangkap.src,
    actionText: 'Buka Peta Zona Tangkap',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    id: 'edukasi-pemeliharaan-ikan',
    title: 'Edukasi Pemeliharaan Ikan',
    description:
      'Panduan praktis menjaga ikan tangkapan agar tetap segar dan tidak mudah busuk di atas kapal hingga sampai di darat.',
    tag: 'Panduan Praktis',
    imageSrc: pemeliharaanIkan.src,
    actionText: 'Baca Panduan Segar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.115.024.507-.14 1.475-.889 2.77 1.889-.4 3.25-1.125 3.889-1.607A10.716 10.716 0 0 0 12 17.5c4.97 0 9-3.184 9-7.115C21 6.185 16.97 3 12 3Z" />
      </svg>
    ),
  },
  {
    id: 'pemasaran-ikan',
    title: 'Strategi Pemasaran Ikan',
    description:
      'Cara menjual hasil tangkapan dengan harga terbaik di pelelangan (TPI) maupun langsung ke pembeli dan pasar digital.',
    tag: 'Tips Penjualan',
    imageSrc: pemasaranIkan.src,
    actionText: 'Lihat Tips Penjualan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
  },
];

export default function DashboardNelayanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const uProfile = await getUserProfile(user.uid);
        if (uProfile && uProfile.role === 'nelayan') {
          setProfile(uProfile);
        } else if (uProfile) {
          const paths: Record<string, string> = {
            'nelayan': '/dashboard/nelayan',
            'nelayan-modern': '/dashboard/peneliti',
            'masyarakat': '/dashboard/masyarakat',
            'peneliti': '/dashboard/peneliti',
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

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c2d52] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-sky-200 border-t-white rounded-full animate-spin" />
        <p className="text-white text-sm font-semibold">Memuat Dashboard Nelayan…</p>
      </div>
    );
  }

  const displayName = profile?.displayName || 'Bapak Nelayan';

  return (
    <div className="min-h-screen bg-slate-100 text-zinc-900 font-sans flex flex-col">

      {/* Solid Top Header Navigation */}
      <header className="bg-[#0c2d52] text-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-extrabold tracking-widest text-base text-white uppercase hover:text-sky-200 transition-colors">
            OCEANAGARA
          </Link>
          <span className="text-zinc-400 font-bold">/</span>
          <span className="text-sm font-bold text-sky-200 uppercase tracking-wider">
            Dashboard Nelayan
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs sm:text-sm font-bold uppercase tracking-wider px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span>Keluar</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full space-y-6">

        {/* Greeting Banner - Solid Flat Color */}
        <div className="bg-[#0c2d52] text-white p-6 rounded-2xl border border-zinc-700 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#163e6e] text-sky-200 border border-sky-400/40 text-xs font-bold uppercase tracking-wider">
            <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3" />
            </svg>
            <span>Nelayan Tradisional Indonesia</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Selamat Datang, <span className="text-sky-200">{displayName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-2xl font-normal">
            Pilih menu di bawah ini untuk melihat lokasi kumpul ikan terdekat, tips pemeliharaan ikan, dan strategi pemasaran.
          </p>
        </div>

        {/* Profile Info Strip - Solid Flat Color */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-white border border-zinc-300 rounded-2xl text-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0c2d52] text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Status Nelayan</span>
              <span className="text-sm font-extrabold text-[#0c2d52] uppercase">Nelayan Tradisional</span>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-zinc-200 pt-3 sm:pt-0 sm:pl-4">
            <div className="w-10 h-10 rounded-lg bg-[#0c2d52] text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L12 3l9.75 15M2.25 18h19.5" />
              </svg>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Nama Kapal / Perahu</span>
              <span className="text-sm font-extrabold text-zinc-900">{String(profile?.namaKapal || '-')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-zinc-200 pt-3 sm:pt-0 sm:pl-4">
            <div className="w-10 h-10 rounded-lg bg-[#0c2d52] text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Pangkalan / Wilayah</span>
              <span className="text-sm font-extrabold text-zinc-900">{String(profile?.wilayahOperasi || '-')}</span>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid - Flat Solid Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.id}
              href={`/dashboard/nelayan/feature/${card.id}`}
              className="flex flex-col bg-white border border-zinc-300 rounded-2xl overflow-hidden hover:border-[#0c2d52] transition-colors"
            >
              {/* Card Header Image (Clean Solid Overlay) */}
              <div className="relative h-40 w-full bg-[#0c2d52] overflow-hidden border-b border-zinc-200">
                <img
                  src={card.imageSrc}
                  alt={card.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-3 py-1 bg-[#0c2d52] text-white text-xs font-bold uppercase tracking-wider rounded border border-zinc-600">
                    {card.tag}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#0c2d52]">
                    <div className="p-1.5 bg-[#0c2d52] text-white rounded">
                      {card.icon}
                    </div>
                    <h3 className="text-lg font-extrabold text-[#0c2d52]">
                      {card.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="pt-2">
                  <div className="w-full py-3 px-4 bg-[#0c2d52] hover:bg-[#163e6e] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2">
                    <span>{card.actionText}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </main>

      {/* Info Section - Clean Flat Solid */}
      <section className="bg-white border-t border-zinc-300 py-12 px-4 sm:px-8 mt-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#0c2d52] block">
              Bantuan &amp; Panduan Layanan
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0c2d52] uppercase tracking-tight">
              Panduan Lengkap Nelayan Tradisional
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Tiga langkah praktis untuk mengoptimalkan hasil tangkapan dan keselamatan saat melaut.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 border border-zinc-300 rounded-2xl space-y-2">
              <div className="w-8 h-8 rounded bg-[#0c2d52] text-white flex items-center justify-center font-extrabold text-sm">
                1
              </div>
              <h4 className="text-base font-extrabold text-[#0c2d52] uppercase">Cek Zona Tangkap</h4>
              <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                Gunakan peta interaktif untuk melihat titik kumpul ikan terdekat dari pelabuhan Anda (&lt; 12 mil laut).
              </p>
            </div>

            <div className="p-6 bg-slate-50 border border-zinc-300 rounded-2xl space-y-2">
              <div className="w-8 h-8 rounded bg-[#0c2d52] text-white flex items-center justify-center font-extrabold text-sm">
                2
              </div>
              <h4 className="text-base font-extrabold text-[#0c2d52] uppercase">Jaga Kesegaran Ikan</h4>
              <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                Pelajari teknik es dan penanganan ikan di kapal agar mutu tetap tinggi saat dijual.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border border-zinc-300 rounded-2xl space-y-2">
              <div className="w-8 h-8 rounded bg-[#0c2d52] text-white flex items-center justify-center font-extrabold text-sm">
                3
              </div>
              <h4 className="text-base font-extrabold text-[#0c2d52] uppercase">Jual Harga Terbaik</h4>
              <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                Manfaatkan tips pemasaran ke pelelangan (TPI) dan pasar digital untuk keuntungan maksimal.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
