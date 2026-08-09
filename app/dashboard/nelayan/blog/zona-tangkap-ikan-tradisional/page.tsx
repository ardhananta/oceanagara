'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthChange, getUserProfile } from '@/app/service/authentication';
import heroImg from '@/public/img/NelayanZonaTangkap.png';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0c2d52] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function ZonaTangkapIkanTradisionalBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const uProfile = await getUserProfile(user.uid);
      if (!uProfile) {
        router.push('/fill-form');
        return;
      }
      if (uProfile.role !== 'nelayan') {
        const paths: Record<string, string> = {
          masyarakat: '/dashboard/masyarakat',
          'nelayan-modern': '/dashboard/peneliti',
          peneliti: '/dashboard/peneliti',
        };
        router.push(paths[uProfile.role ?? ''] || '/dashboard/nelayan');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-[#0c3060] selection:text-white">

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0c2d52] border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 text-white min-w-0">
          <Link
            href="/"
            className="font-extrabold tracking-widest text-sm text-white hover:text-sky-200 transition-colors flex-shrink-0"
          >
            OCEANAGARA
          </Link>
          <span className="text-white/30 flex-shrink-0">/</span>
          <Link
            href="/dashboard/nelayan"
            className="text-xs text-white/60 hover:text-white transition-colors flex-shrink-0 hidden sm:inline"
          >
            Nelayan
          </Link>
          <span className="text-white/30 flex-shrink-0 hidden sm:inline">/</span>
          <span className="text-xs text-sky-200 font-semibold truncate">Zona Tangkap</span>
        </div>
        <Link
          href="/dashboard/nelayan"
          className="flex-shrink-0 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 border border-white/30 text-white hover:bg-white hover:text-[#0c2d52] rounded-lg transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="hidden sm:inline">Kembali</span>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative h-[62vh] min-h-[420px] flex items-end overflow-hidden">
        <img
          src={heroImg.src}
          alt="Zona Tangkap Ikan Tradisional"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061525]/92 via-[#061525]/45 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 w-full pb-14">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-white/15 border border-white/25 text-sky-200 rounded backdrop-blur-sm">
              Peta Wilayah
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Zona Tangkap Ikan Tradisional
          </h1>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>Segera Hadir</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Informasi Wilayah</span>
          </div>
        </div>
      </section>

      {/* Coming Soon Content */}
      <section className="max-w-4xl mx-auto px-6 md:px-12 py-20 text-center">
        <div className="max-w-lg mx-auto">

          <div className="w-16 h-16 rounded-2xl bg-[#0c2d52]/8 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#0c2d52]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>

          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">
            Konten Dalam Pengembangan
          </span>
          <h2 className="text-2xl font-extrabold text-[#0c2d52] uppercase tracking-tight mb-4">
            Segera Hadir
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed mb-8">
            Halaman ini sedang dalam proses pengembangan. Informasi lengkap mengenai peta zona tangkap ikan tradisional, batas wilayah, area konservasi, dan panduan regulasi kelautan akan tersedia dalam waktu dekat.
          </p>

          <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-8 overflow-hidden">
            <div className="h-full bg-[#0c2d52] rounded-full" style={{ width: '15%' }} />
          </div>

          <Link
            href="/dashboard/nelayan"
            className="inline-flex items-center gap-2.5 px-7 py-3 bg-[#0c2d52] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#1a4a7a] transition-all duration-200 shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali ke Dashboard
          </Link>
        </div>
      </section>

    </div>
  );
}
