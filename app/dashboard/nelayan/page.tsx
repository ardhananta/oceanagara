'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, logout, getUserProfile, UserProfile } from '@/app/service/authentication';
import pemeliharaanIkan from '@/public/img/NelayanPemeliharaanIkan.png';
import pemasaranIkan from '@/public/img/NelayanPemasaranIkan.png';
import zonaTangkap from '@/public/img/NelayanZonaTangkap.png';
import FishScanSection from '@/components/scan-ikan/FishScanSection';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  tag: string;
  imagePlaceholderColor: string;
  imageSrc: string;
  icon: React.ReactNode;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'edukasi-pemeliharaan-ikan',
    title: 'Edukasi Pemeliharaan Ikan',
    description:
      'Panduan lengkap teknik pemeliharaan ikan tangkapan agar tetap hidup dan segar, mulai dari penanganan di atas kapal hingga metode penyimpanan yang tepat.',
    tag: 'Teknik Budidaya',
    imagePlaceholderColor: 'from-[#1a3e30]/85 via-[#122a20]/90 to-[#091510]',
    imageSrc: pemeliharaanIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.115.024.507-.14 1.475-.889 2.77 1.889-.4 3.25-1.125 3.889-1.607A10.716 10.716 0 0 0 12 17.5c4.97 0 9-3.184 9-7.115C21 6.185 16.97 3 12 3Z" />
      </svg>
    ),
  },
  {
    id: 'pemasaran-ikan',
    title: 'Pemasaran Ikan',
    description:
      'Strategi dan panduan efektif memasarkan hasil tangkapan ke berbagai saluran distribusi — dari Tempat Pelelangan Ikan hingga pasar digital yang menguntungkan.',
    tag: 'Strategi Penjualan',
    imagePlaceholderColor: 'from-[#3e2a1a]/85 via-[#2e1f12]/90 to-[#1a100a]',
    imageSrc: pemasaranIkan.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    ),
  },
  {
    id: 'zona-tangkap-ikan-tradisional',
    title: 'Zona Tangkap Ikan Tradisional',
    description:
      'Informasi mengenai peta dan batas wilayah penangkapan ikan tradisional yang aman, legal, dan berkelanjutan sesuai regulasi kelautan yang berlaku.',
    tag: 'Peta Wilayah',
    imagePlaceholderColor: 'from-[#0e2a4a]/85 via-[#0d2240]/90 to-[#07121f]',
    imageSrc: zonaTangkap.src,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
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
      <div className="min-h-screen bg-[#0c1f35] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.displayName || 'Nelayan';

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#0c3060] selection:text-white">

      <div className="relative w-full">

        {/* Background Header Image */}
        <div className="absolute top-0 inset-x-0 h-[560px] md:h-[600px] z-0 select-none pointer-events-none overflow-hidden">
          <img
            src="/img/background.webp"
            alt="Oceanagara background header"
            className="w-full h-full object-cover object-top"
          />
          {/* Teal-blue tint overlay to differentiate from masyarakat */}
          <div className="absolute inset-0 bg-[#0a2540]/30" />
        </div>

        {/* Sticky Navbar */}
        <header className="relative z-40 bg-transparent px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold tracking-widest text-sm text-white uppercase hover:text-sky-200 transition-colors">
              OCEANAGARA
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Dashboard Nelayan
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

          {/* Greeting */}
          <div className="space-y-2 max-w-3xl mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal text-white tracking-tight drop-shadow">
              Halo! Selamat datang <span className="font-bold">{displayName}</span>
            </h1>
            <p className="text-sm sm:text-base italic text-sky-100/90 font-light tracking-wide drop-shadow">
              akses panduan pemeliharaan ikan, strategi pemasaran, dan informasi zona tangkap tradisional
            </p>
          </div>

          {/* Profile Info Strip */}
          <div className="inline-flex flex-wrap items-center gap-6 p-4 bg-[#0c2d52]/75 border border-white/20 backdrop-blur-md rounded-xl text-white shadow-xl mb-12">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Peran</span>
                <span className="text-xs font-bold text-white uppercase">Nelayan Tradisional</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Nama Kapal</span>
              <span className="text-xs font-semibold text-white">{String(profile?.namaKapal || '-')}</span>
            </div>
            <div className="h-8 w-px bg-white/20 hidden md:block" />
            <div>
              <span className="text-[10px] uppercase tracking-widest text-sky-200/80 font-bold block">Wilayah Operasi</span>
              <span className="text-xs font-semibold text-white">{String(profile?.wilayahOperasi || '-')}</span>
            </div>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {FEATURE_CARDS.map((card) => (
              <Link
                key={card.id}
                href={`/dashboard/nelayan/blog/${card.id}`}
                className="group cursor-pointer"
              >
                {/* Mobile Card (square icon format) */}
                <div className="md:hidden flex flex-col items-center gap-2">
                  <div
                    className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${card.imagePlaceholderColor} flex items-center justify-center shadow-lg border border-white/20 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 group-hover:border-sky-300/60`}
                  >
                    {card.imageSrc && (
                      <img
                        src={card.imageSrc}
                        alt={card.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-70"
                      />
                    )}
                    <div className="relative z-10 text-white/80 group-hover:text-white transition-colors">
                      {card.icon}
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                    {card.title}
                  </p>
                </div>

                {/* Desktop Card */}
                <div className="hidden md:flex relative h-80 rounded-[22px] p-6 flex-col justify-between overflow-hidden shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-[#0c2040] border border-white/20 text-white group-hover:border-sky-300/80">
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
                      <span>Baca Selengkapnya</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Scan Kualitas Ikan */}
          <FishScanSection />
        </div>
      </div>

      {/* Info Section */}
      <section className="bg-white border-t border-zinc-100 py-16 px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Pusat Informasi Nelayan
            </span>
            <h2 className="text-2xl font-extrabold text-[#0c2d52] uppercase tracking-tight">
              Panduan Lengkap untuk Nelayan Tradisional
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#0c2d52] text-white flex items-center justify-center font-bold text-sm shadow-sm">01</div>
              <h4 className="text-sm font-bold text-[#0c2d52] uppercase tracking-wider">Pemeliharaan Ikan</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pelajari teknik menjaga kesegaran ikan hasil tangkapan di atas kapal, mulai dari penanganan pertama hingga penyimpanan dalam es yang benar.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#0c2d52] text-white flex items-center justify-center font-bold text-sm shadow-sm">02</div>
              <h4 className="text-sm font-bold text-[#0c2d52] uppercase tracking-wider">Strategi Pemasaran</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Optimalkan nilai jual hasil tangkapan melalui saluran distribusi yang tepat, negosiasi harga di TPI, dan pemanfaatan platform digital.
              </p>
            </div>

            <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 hover:border-zinc-400 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#0c2d52] text-white flex items-center justify-center font-bold text-sm shadow-sm">03</div>
              <h4 className="text-sm font-bold text-[#0c2d52] uppercase tracking-wider">Zona Tangkap Aman</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pahami batas wilayah penangkapan ikan tradisional yang ditetapkan, zona konservasi, dan area yang aman dari konflik dengan kapal besar.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
